import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["ncert.nic.in", "www.ncert.nic.in"]);

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

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const pdfUrl = isAllowedPdfUrl(rawUrl);
  if (!pdfUrl) {
    return NextResponse.json({ error: "URL is not an allowlisted NCERT PDF" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let upstream: Response;
    try {
      upstream = await fetch(pdfUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ncrt-books-pdf-proxy/0.1; +https://github.com/SINGH202/ncrt-books)",
          Accept: "application/pdf,*/*",
          Referer: "https://ncert.nic.in/textbook.php",
        },
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "application/pdf";
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      return NextResponse.json(
        { error: "Upstream response was not a PDF" },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=0, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }
}
