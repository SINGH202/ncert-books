import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["ncert.nic.in", "www.ncert.nic.in"]);
const UPSTREAM_TIMEOUT_MS = 22_000;
const MAX_ATTEMPTS = 3;

function isAllowedPdfUrl(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
  if (!parsed.pathname.startsWith("/textbook/pdf/")) return null;
  if (!parsed.pathname.toLowerCase().endsWith(".pdf")) return null;
  return parsed;
}

function alternateHostUrl(pdfUrl: URL): URL | null {
  const alt = new URL(pdfUrl.toString());
  if (pdfUrl.hostname === "ncert.nic.in") {
    alt.hostname = "www.ncert.nic.in";
    return alt;
  }
  if (pdfUrl.hostname === "www.ncert.nic.in") {
    alt.hostname = "ncert.nic.in";
    return alt;
  }
  return null;
}

function upstreamCandidates(pdfUrl: URL): URL[] {
  const alt = alternateHostUrl(pdfUrl);
  return alt ? [pdfUrl, alt] : [pdfUrl];
}

async function fetchOnce(
  pdfUrl: URL,
  rangeHeader: string | null,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (compatible; ncrt-books-pdf-proxy/0.2; +https://github.com/SINGH202/ncert-books)",
      Accept: "application/pdf,*/*",
      Referer: "https://ncert.nic.in/textbook.php",
    };
    if (rangeHeader) headers.Range = rangeHeader;

    return await fetch(pdfUrl.toString(), {
      headers,
      redirect: "follow",
      // Cache successful upstream PDFs at the platform edge for a week.
      next: { revalidate: 604800 },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchUpstream(
  pdfUrl: URL,
  rangeHeader: string | null,
): Promise<Response> {
  let lastError: unknown;
  const candidates = upstreamCandidates(pdfUrl);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const target = candidates[attempt % candidates.length];
    try {
      const upstream = await fetchOnce(target, rangeHeader);

      // Missing chapters (esp. Prelims) — fail fast, no retries.
      if (upstream.status === 404) return upstream;
      if (upstream.ok || upstream.status === 206) return upstream;

      if (![408, 429, 500, 502, 503, 504].includes(upstream.status)) {
        return upstream;
      }

      lastError = new Error(`Upstream returned ${upstream.status}`);
    } catch (error) {
      lastError = error;
    }

    const delay = Math.min(1600, 300 * 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch PDF");
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const pdfUrl = isAllowedPdfUrl(rawUrl);
  if (!pdfUrl) {
    return NextResponse.json(
      { error: "URL is not an allowlisted NCERT PDF" },
      { status: 400 },
    );
  }

  try {
    const rangeHeader = request.headers.get("range");
    const upstream = await fetchUpstream(pdfUrl, rangeHeader);

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/pdf";
    if (
      !contentType.includes("pdf") &&
      !contentType.includes("octet-stream") &&
      !contentType.includes("application/octet-stream")
    ) {
      return NextResponse.json(
        { error: "Upstream response was not a PDF" },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    // Long browser/CDN cache — NCERT chapter PDFs are immutable by URL.
    headers.set(
      "Cache-Control",
      "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
    );
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "X-Proxy-Upstream-Host",
      upstream.url ? new URL(upstream.url).hostname : pdfUrl.hostname,
    );

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }
}
