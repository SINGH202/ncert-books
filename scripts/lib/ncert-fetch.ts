import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type FetchImpl = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type CurlImpl = (url: string, timeoutMs: number) => Promise<string>;

export type FetchNcertOptions = {
  fetchImpl?: FetchImpl;
  curlImpl?: CurlImpl;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  headers?: Record<string, string>;
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_ATTEMPTS = 4;

export const NCERT_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (compatible; ncrt-books-catalog-sync/0.2; +https://github.com/SINGH202/ncrt-books)",
  Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
  Referer: "https://ncert.nic.in/textbook.php",
};

export function alternateNcertHost(url: string): string | null {
  const parsed = new URL(url);
  if (parsed.hostname === "ncert.nic.in") {
    parsed.hostname = "www.ncert.nic.in";
    return parsed.toString();
  }
  if (parsed.hostname === "www.ncert.nic.in") {
    parsed.hostname = "ncert.nic.in";
    return parsed.toString();
  }
  return null;
}

export function ncertUpstreamCandidates(url: string): string[] {
  const alt = alternateNcertHost(url);
  return alt ? [url, alt] : [url];
}

export function ncertCurlArgs(url: string, timeoutMs: number): string[] {
  const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
  return [
    "--silent",
    "--show-error",
    "--location",
    "--fail",
    "--http1.1",
    "--compressed",
    "--connect-timeout",
    "20",
    "--max-time",
    String(timeoutSec),
    "--retry",
    "2",
    "--retry-delay",
    "2",
    "--retry-all-errors",
    "-A",
    NCERT_FETCH_HEADERS["User-Agent"],
    "-e",
    NCERT_FETCH_HEADERS.Referer,
    url,
  ];
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchNcertHtmlWithCurl(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  let lastError: unknown;
  for (const target of ncertUpstreamCandidates(url)) {
    try {
      const { stdout } = await execFileAsync(
        "curl",
        ncertCurlArgs(target, timeoutMs),
        {
          maxBuffer: 12 * 1024 * 1024,
          encoding: "utf8",
        },
      );
      if (!stdout.trim()) {
        throw new Error(`curl returned empty body from ${target}`);
      }
      return stdout;
    } catch (error) {
      lastError = error;
      console.warn(
        `curl fetch failed for ${target}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("curl fetch failed");
}

export async function fetchNcertResponse(
  url: string,
  options: FetchNcertOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;
  const candidates = ncertUpstreamCandidates(url);
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const target = candidates[attempt % candidates.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(target, {
        headers: { ...NCERT_FETCH_HEADERS, ...options.headers },
        redirect: "follow",
        signal: controller.signal,
      });

      if (response.ok || response.status === 206 || response.status === 404) {
        return response;
      }
      if (!RETRYABLE_STATUSES.has(response.status)) {
        return response;
      }

      lastError = new Error(`Upstream returned ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }

    if (attempt + 1 < maxAttempts) {
      const delayMs = 400 * (attempt + 1);
      console.warn(
        `NCERT fetch failed for ${target}; retry ${attempt + 2}/${maxAttempts} in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch NCERT URL");
}

export async function fetchNcertText(
  url: string,
  options: FetchNcertOptions = {},
): Promise<string> {
  try {
    const response = await fetchNcertResponse(url, options);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }
    return await response.text();
  } catch (error) {
    const curl = options.curlImpl ?? fetchNcertHtmlWithCurl;
    console.warn(
      `Node fetch failed (${error instanceof Error ? error.message : error}); trying curl`,
    );
    return curl(url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }
}
