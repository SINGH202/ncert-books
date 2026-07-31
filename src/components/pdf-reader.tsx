"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Typography } from "@/components/typography";
import type { Book, Chapter } from "@/lib/types";

type PdfReaderProps = {
  book: Book;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDocument = any;

type ChapterMeta = {
  chapter: Chapter;
  pageCount: number;
  available: boolean | null;
};

function proxiedPdfUrl(officialUrl: string): string {
  return `/api/pdf?url=${encodeURIComponent(officialUrl)}`;
}

function resolveLocation(
  metas: ChapterMeta[],
  globalPage: number,
): { metaIndex: number; pageInChapter: number } | null {
  let remaining = globalPage;
  for (let i = 0; i < metas.length; i += 1) {
    const meta = metas[i];
    if (meta.available !== true || meta.pageCount === 0) continue;
    if (remaining <= meta.pageCount) {
      return { metaIndex: i, pageInChapter: remaining };
    }
    remaining -= meta.pageCount;
  }
  return null;
}

function controlButtonClassName(extra?: string) {
  return [
    "touch-target inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 disabled:opacity-40",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function PdfReader({ book }: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pdfCacheRef = useRef<Map<number, PdfDocument>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsRef = useRef<any>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [metas, setMetas] = useState<ChapterMeta[]>(() =>
    book.chapters.map((chapter) => ({
      chapter,
      pageCount: 0,
      available: null,
    })),
  );
  const [globalPage, setGlobalPage] = useState(1);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [stageWidth, setStageWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [indexing, setIndexing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const totalPages = useMemo(
    () =>
      metas.reduce(
        (sum, meta) => sum + (meta.available === true ? meta.pageCount : 0),
        0,
      ),
    [metas],
  );

  const location = useMemo(
    () => resolveLocation(metas, globalPage),
    [metas, globalPage],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateWidth = () => {
      setStageWidth(stage.clientWidth);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function probeChapter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfjs: any,
      index: number,
      keepInCache: boolean,
    ): Promise<ChapterMeta> {
      const chapter = book.chapters[index];
      try {
        const pdf = await pdfjs.getDocument({
          url: proxiedPdfUrl(chapter.pdfUrl),
        }).promise;
        if (cancelled) {
          await pdf.destroy();
          return { chapter, pageCount: 0, available: false };
        }
        if (keepInCache) {
          pdfCacheRef.current.set(index, pdf);
        } else {
          await pdf.destroy();
        }
        return { chapter, pageCount: pdf.numPages, available: true };
      } catch {
        return { chapter, pageCount: 0, available: false };
      }
    }

    async function bootstrap() {
      setReady(false);
      setIndexing(true);
      setError(null);
      setGlobalPage(1);
      pdfCacheRef.current.forEach((pdf) => {
        void pdf.destroy?.();
      });
      pdfCacheRef.current.clear();

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        pdfjsRef.current = pdfjs;

        const initial = book.chapters.map((chapter) => ({
          chapter,
          pageCount: 0,
          available: null as boolean | null,
        }));
        setMetas(initial);

        let firstAvailable = -1;
        for (let i = 0; i < book.chapters.length; i += 1) {
          if (cancelled) return;
          const meta = await probeChapter(pdfjs, i, firstAvailable === -1);
          initial[i] = meta;
          setMetas([...initial]);
          if (meta.available && firstAvailable === -1) {
            firstAvailable = i;
            setReady(true);
          }
        }

        if (!cancelled) {
          if (firstAvailable === -1) {
            setError(
              "Could not load any chapter PDFs from NCERT. Try again or open the book on the official portal.",
            );
          }
          setIndexing(false);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to initialize the PDF reader.");
          setIndexing(false);
        }
      }
    }

    void bootstrap();

    const cache = pdfCacheRef.current;
    return () => {
      cancelled = true;
      cache.forEach((pdf) => {
        void pdf.destroy?.();
      });
      cache.clear();
    };
  }, [book, retryToken]);

  useEffect(() => {
    let cancelled = false;

    async function ensureChapter(metaIndex: number): Promise<PdfDocument | null> {
      const cached = pdfCacheRef.current.get(metaIndex);
      if (cached) return cached;
      const pdfjs = pdfjsRef.current;
      const meta = metas[metaIndex];
      if (!pdfjs || meta?.available !== true) return null;

      const pdf = await pdfjs.getDocument({
        url: proxiedPdfUrl(meta.chapter.pdfUrl),
      }).promise;
      if (cancelled) {
        await pdf.destroy();
        return null;
      }
      pdfCacheRef.current.set(metaIndex, pdf);

      const keep = new Set(
        [metaIndex - 1, metaIndex, metaIndex + 1].filter((i) => i >= 0),
      );
      for (const [key, value] of pdfCacheRef.current.entries()) {
        if (!keep.has(key)) {
          void value.destroy?.();
          pdfCacheRef.current.delete(key);
        }
      }
      return pdf;
    }

    async function renderPage() {
      if (!location || !canvasRef.current || stageWidth <= 0) return;
      setRendering(true);
      try {
        const pdf = await ensureChapter(location.metaIndex);
        if (location.metaIndex + 1 < metas.length) {
          void ensureChapter(location.metaIndex + 1);
        }
        if (!pdf || cancelled) return;

        const page = await pdf.getPage(location.pageInChapter);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(0.5, (stageWidth - 8) / baseViewport.width);
        const scale = fitScale * zoomFactor;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        if (!cancelled) setError(null);
      } catch {
        if (!cancelled) {
          setError(
            "Failed to render this page. You can retry or open the book on NCERT.",
          );
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [location, metas, zoomFactor, stageWidth]);

  const currentChapterTitle =
    location != null ? metas[location.metaIndex]?.chapter.title : null;

  const pageLabel = !ready
    ? "Loading…"
    : totalPages > 0
      ? `${globalPage} / ${totalPages}`
      : "No pages";

  return (
    <div className="flex min-h-[70dvh] flex-col gap-0 sm:gap-4">
      <div className="sticky top-[calc(3.25rem+var(--safe-top))] z-10 border-y border-line bg-background/95 backdrop-blur sm:top-0 sm:rounded-xl sm:border">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 sm:hidden">
          <button
            type="button"
            className={controlButtonClassName("justify-self-start")}
            disabled={globalPage <= 1 || !ready}
            aria-label="Previous page"
            onClick={() => setGlobalPage((page) => Math.max(1, page - 1))}
          >
            <Typography variant="button">Prev</Typography>
          </button>
          <Typography variant="small" className="text-center font-medium text-foreground">
            {pageLabel}
          </Typography>
          <button
            type="button"
            className={controlButtonClassName("justify-self-end")}
            disabled={!ready || totalPages === 0 || globalPage >= totalPages}
            aria-label="Next page"
            onClick={() =>
              setGlobalPage((page) => Math.min(totalPages, page + 1))
            }
          >
            <Typography variant="button">Next</Typography>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 sm:hidden">
          <Typography variant="small" className="min-w-0 flex-1 truncate">
            {currentChapterTitle ?? "Preparing reader"}
            {indexing && ready ? " · indexing…" : ""}
          </Typography>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className={controlButtonClassName("px-2.5")}
              aria-label="Zoom out"
              onClick={() =>
                setZoomFactor((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))
              }
            >
              <Typography variant="button">−</Typography>
            </button>
            <Typography variant="small" className="w-10 text-center">
              {Math.round(zoomFactor * 100)}%
            </Typography>
            <button
              type="button"
              className={controlButtonClassName("px-2.5")}
              aria-label="Zoom in"
              onClick={() =>
                setZoomFactor((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))
              }
            >
              <Typography variant="button">+</Typography>
            </button>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 p-3 sm:flex">
          <button
            type="button"
            className={controlButtonClassName()}
            disabled={globalPage <= 1 || !ready}
            onClick={() => setGlobalPage((page) => Math.max(1, page - 1))}
          >
            <Typography variant="button">Previous</Typography>
          </button>
          <button
            type="button"
            className={controlButtonClassName()}
            disabled={!ready || totalPages === 0 || globalPage >= totalPages}
            onClick={() =>
              setGlobalPage((page) => Math.min(totalPages, page + 1))
            }
          >
            <Typography variant="button">Next</Typography>
          </button>
          <Typography variant="small" className="px-2">
            {!ready
              ? "Loading book…"
              : totalPages > 0
                ? `Page ${globalPage} / ${totalPages}`
                : "No pages"}
            {currentChapterTitle ? ` · ${currentChapterTitle}` : ""}
            {indexing && ready ? " · indexing…" : ""}
          </Typography>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className={controlButtonClassName()}
              onClick={() =>
                setZoomFactor((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))
              }
            >
              <Typography variant="button">−</Typography>
            </button>
            <Typography variant="small">{Math.round(zoomFactor * 100)}%</Typography>
            <button
              type="button"
              className={controlButtonClassName()}
              onClick={() =>
                setZoomFactor((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))
              }
            >
              <Typography variant="button">+</Typography>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-3 mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 sm:mx-0">
          <Typography
            variant="bodyMedium"
            className="text-red-700 dark:text-red-300"
          >
            {error}
          </Typography>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <button
              type="button"
              className={controlButtonClassName("w-full sm:w-auto")}
              onClick={() => setRetryToken((value) => value + 1)}
            >
              <Typography variant="button">Retry</Typography>
            </button>
            <a
              href={book.ncertBookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex items-center justify-center"
            >
              <Typography variant="link">Open on NCERT</Typography>
            </a>
          </div>
        </div>
      ) : null}

      <div
        ref={stageRef}
        className="flex flex-1 justify-center overflow-auto bg-[#ebe6dc] px-0 py-3 dark:bg-zinc-900 sm:rounded-xl sm:border sm:border-line sm:px-4 sm:py-4"
      >
        {!ready ? (
          <Typography variant="bodyMedium" className="px-4 py-8">
            Loading book…
          </Typography>
        ) : (
          <div className="relative w-full max-w-full">
            {rendering ? (
              <Typography
                variant="small"
                className="absolute right-2 top-2 z-[1] rounded-md bg-background/90 px-2 py-1"
              >
                Rendering…
              </Typography>
            ) : null}
            <canvas ref={canvasRef} className="mx-auto block max-w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
