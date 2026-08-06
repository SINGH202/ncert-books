"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PdfSearchBar } from "@/components/pdf-search-bar";
import { Typography } from "@/components/typography";
import { controlButtonClassName } from "@/lib/control-button-class";
import { trackEvent } from "@/lib/analytics";
import { openPdfDocument } from "@/lib/pdf-cache";
import { computeFitScale, paintPageToCanvas } from "@/lib/pdf-render";
import {
  findMatchesOnPage,
  toViewportRects,
  type PdfSearchMatch,
  type PdfSearchRect,
} from "@/lib/pdf-search";
import type { Book, Chapter, FitMode } from "@/lib/types";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

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

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

function sumAvailablePages(
  metas: Array<{ available: boolean | null; pageCount: number }>,
): number {
  return metas.reduce(
    (sum, meta) => sum + (meta.available === true ? meta.pageCount : 0),
    0,
  );
}

async function waitForCanvas(
  getCanvas: () => HTMLCanvasElement | null,
  isStale: () => boolean,
): Promise<HTMLCanvasElement | null> {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (isStale()) return null;
    const canvas = getCanvas();
    if (canvas?.isConnected) return canvas;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }
  return getCanvas();
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(3))));
}

function isBenignRenderError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  const text = `${name} ${message}`.toLowerCase();
  return (
    name === "RenderingCancelledException" ||
    name === "AbortException" ||
    name === "UnexpectedResponseException" ||
    text.includes("cancel") ||
    text.includes("destroyed") ||
    text.includes("transport destroyed") ||
    text.includes("worker was terminated")
  );
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

function toGlobalPage(
  metas: Array<{ available: boolean | null; pageCount: number }>,
  metaIndex: number,
  pageInChapter: number,
): number {
  let total = 0;
  for (let i = 0; i < metaIndex; i += 1) {
    if (metas[i]?.available === true) total += metas[i].pageCount;
  }
  return total + pageInChapter;
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (context) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
  canvas.style.width = "0px";
  canvas.style.height = "0px";
}

function preferredLoadOrder(chapters: Chapter[]): number[] {
  return chapters
    .map((_, index) => index)
    .sort((a, b) => {
      const aPrelim = chapters[a].title === "Prelims" ? 1 : 0;
      const bPrelim = chapters[b].title === "Prelims" ? 1 : 0;
      if (aPrelim !== bPrelim) return aPrelim - bPrelim;
      return a - b;
    });
}

export function PdfReader({ book }: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const pdfDocsRef = useRef<Map<number, PdfDocument>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);
  const renderGenerationRef = useRef(0);
  const chapterLoadRef = useRef<Map<number, Promise<PdfDocument | null>>>(
    new Map(),
  );
  const metasRef = useRef<ChapterMeta[]>([]);
  const viewAnchorRef = useRef<{
    metaIndex: number;
    pageInChapter: number;
  } | null>(null);
  const globalPageRef = useRef(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastViewportRef = useRef<any>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
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
  const [committedZoom, setCommittedZoom] = useState(1);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<PdfSearchMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [highlightRects, setHighlightRects] = useState<
    Array<PdfSearchRect & { active: boolean }>
  >([]);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const [rendering, setRendering] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [pageDraft, setPageDraft] = useState("1");
  const [loadStatus, setLoadStatus] = useState("Preparing reader…");
  const zoomFactorRef = useRef(zoomFactor);
  const openStartedAtRef = useRef(Date.now());
  const readyTrackedRef = useRef(false);

  useEffect(() => {
    zoomFactorRef.current = zoomFactor;
  }, [zoomFactor]);

  useEffect(() => {
    openStartedAtRef.current = Date.now();
    readyTrackedRef.current = false;
    trackEvent("reader_open", {
      bookId: book.id,
      class: book.class,
      subject: book.subject,
    });
  }, [book.id, book.class, book.subject]);

  useEffect(() => {
    if (!ready || readyTrackedRef.current) return;
    readyTrackedRef.current = true;
    trackEvent("reader_ready", {
      bookId: book.id,
      ms_to_ready: Date.now() - openStartedAtRef.current,
    });
  }, [ready, book.id]);

  useEffect(() => {
    if (!error) return;
    trackEvent("reader_error", { bookId: book.id });
  }, [error, book.id]);

  useEffect(() => {
    if (!isFullscreen) return;
    trackEvent("fullscreen_enter", { bookId: book.id });
  }, [isFullscreen, book.id]);

  // Debounce expensive PDF re-renders while gestures zoom rapidly.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setCommittedZoom(zoomFactor);
    }, 70);
    return () => window.clearTimeout(handle);
  }, [zoomFactor]);

  useEffect(() => {
    metasRef.current = metas;
  }, [metas]);

  useEffect(() => {
    globalPageRef.current = globalPage;
  }, [globalPage]);

  function goToGlobalPage(page: number) {
    const max = sumAvailablePages(metasRef.current);
    const next = Math.min(Math.max(1, page), Math.max(1, max || 1));
    const loc = resolveLocation(metasRef.current, next);
    if (loc) viewAnchorRef.current = loc;
    globalPageRef.current = next;
    setGlobalPage(next);
  }

  function goToChapterPage(metaIndex: number, pageInChapter: number) {
    const meta = metasRef.current[metaIndex];
    if (meta?.available !== true || meta.pageCount <= 0) return;
    const safePage = Math.min(Math.max(1, pageInChapter), meta.pageCount);
    viewAnchorRef.current = { metaIndex, pageInChapter: safePage };
    const next = toGlobalPage(metasRef.current, metaIndex, safePage);
    globalPageRef.current = next;
    setGlobalPage(next);
  }

  function syncGlobalPageToAnchor(nextMetas: ChapterMeta[]) {
    const anchor = viewAnchorRef.current;
    if (!anchor) return;
    const meta = nextMetas[anchor.metaIndex];
    if (meta?.available !== true || meta.pageCount <= 0) return;
    const safePage = Math.min(anchor.pageInChapter, meta.pageCount);
    viewAnchorRef.current = {
      metaIndex: anchor.metaIndex,
      pageInChapter: safePage,
    };
    const next = toGlobalPage(nextMetas, anchor.metaIndex, safePage);
    if (next !== globalPageRef.current) {
      globalPageRef.current = next;
      setGlobalPage(next);
    }
  }

  const totalPages = useMemo(() => sumAvailablePages(metas), [metas]);

  const location = useMemo(
    () => resolveLocation(metas, globalPage),
    [metas, globalPage],
  );

  const locationKey = location
    ? `${location.metaIndex}:${location.pageInChapter}`
    : "none";

  const searchScopeKey = useMemo(
    () =>
      metas
        .map((meta, index) =>
          meta.available === true ? `${index}:${meta.pageCount}` : "",
        )
        .filter(Boolean)
        .join("|"),
    [metas],
  );

  async function loadChapterDoc(metaIndex: number): Promise<PdfDocument | null> {
    const existing = pdfDocsRef.current.get(metaIndex);
    if (existing) return existing;

    const inflight = chapterLoadRef.current.get(metaIndex);
    if (inflight) return inflight;

    const loadPromise = (async () => {
      const pdfjs = pdfjsRef.current;
      const meta = metasRef.current[metaIndex];
      if (!pdfjs || meta?.available === false) return null;

      const again = pdfDocsRef.current.get(metaIndex);
      if (again) return again;

      const pdf = await openPdfDocument(
        pdfjs,
        meta.chapter.pdfUrl,
        book.id,
      );

      const raced = pdfDocsRef.current.get(metaIndex);
      if (raced) {
        await pdf.destroy();
        return raced;
      }

      pdfDocsRef.current.set(metaIndex, pdf);
      if (meta.available !== true) {
        // Lazily discovered while navigating.
        setMetas((prev) => {
          const next = prev.map((item, i) =>
            i === metaIndex
              ? { ...item, available: true, pageCount: pdf.numPages }
              : item,
          );
          metasRef.current = next;
          syncGlobalPageToAnchor(next);
          return next;
        });
      }
      return pdf;
    })().finally(() => {
      chapterLoadRef.current.delete(metaIndex);
    });

    chapterLoadRef.current.set(metaIndex, loadPromise);
    return loadPromise;
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageWidth(Math.max(0, Math.floor(rect.width)));
      setStageHeight(Math.max(0, Math.floor(rect.height)));
    };
    updateSize();
    const frame = window.requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isFullscreen, ready]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !ready) return;

    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let isPinching = false;
    let isPanning = false;
    let panPointerId: number | null = null;
    let panStartX = 0;
    let panStartY = 0;
    let panScrollLeft = 0;
    let panScrollTop = 0;
    let zoomRaf = 0;
    let pendingZoom = zoomFactorRef.current;

    const flushZoom = () => {
      zoomRaf = 0;
      setZoomFactor(pendingZoom);
    };

    const scheduleZoom = (next: number) => {
      pendingZoom = clampZoom(next);
      zoomFactorRef.current = pendingZoom;
      if (!zoomRaf) {
        zoomRaf = window.requestAnimationFrame(flushZoom);
      }
    };

    const touchDistance = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      scheduleZoom(zoomFactorRef.current * factor);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        pinchStartDistance = touchDistance(event.touches);
        pinchStartZoom = zoomFactorRef.current;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isPinching || event.touches.length !== 2 || pinchStartDistance <= 0) {
        return;
      }
      event.preventDefault();
      scheduleZoom(
        pinchStartZoom * (touchDistance(event.touches) / pinchStartDistance),
      );
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        isPinching = false;
        pinchStartDistance = 0;
        // Commit final zoom immediately when gesture ends.
        setCommittedZoom(zoomFactorRef.current);
        setZoomFactor(zoomFactorRef.current);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" ||
        (event.button !== 0 && event.button !== 1)
      ) {
        return;
      }
      if (isPinching) return;
      const overflowX = stage.scrollWidth > stage.clientWidth + 1;
      const overflowY = stage.scrollHeight > stage.clientHeight + 1;
      const zoomedIn = zoomFactorRef.current > 1.05;
      if (!(overflowX || overflowY || zoomedIn || event.button === 1)) return;

      isPanning = true;
      panPointerId = event.pointerId;
      panStartX = event.clientX;
      panStartY = event.clientY;
      panScrollLeft = stage.scrollLeft;
      panScrollTop = stage.scrollTop;
      stage.setPointerCapture(event.pointerId);
      stage.style.cursor = "grabbing";
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isPanning || panPointerId !== event.pointerId) return;
      stage.scrollLeft = panScrollLeft - (event.clientX - panStartX);
      stage.scrollTop = panScrollTop - (event.clientY - panStartY);
    };

    const endPan = (event: PointerEvent) => {
      if (panPointerId !== event.pointerId) return;
      isPanning = false;
      panPointerId = null;
      stage.style.cursor = "";
      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
    };

    const onDoubleClick = (event: MouseEvent) => {
      event.preventDefault();
      const next =
        zoomFactorRef.current > 1.2 ? 1 : clampZoom(zoomFactorRef.current * 2);
      zoomFactorRef.current = next;
      setZoomFactor(next);
      setCommittedZoom(next);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", endPan);
    stage.addEventListener("pointercancel", endPan);
    stage.addEventListener("dblclick", onDoubleClick);

    return () => {
      if (zoomRaf) window.cancelAnimationFrame(zoomRaf);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", endPan);
      stage.removeEventListener("pointercancel", endPan);
      stage.removeEventListener("dblclick", onDoubleClick);
      stage.style.cursor = "";
    };
  }, [isFullscreen, ready]);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
        return;
      }

      const target = event.target as HTMLElement | null;
      const typingInField = Boolean(
        target?.closest?.(
          "input, textarea, select, [contenteditable=true]",
        ),
      );
      if (typingInField) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "=" || event.key === "+")
      ) {
        event.preventDefault();
        applyZoom(zoomFactorRef.current + ZOOM_STEP);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        applyZoom(zoomFactorRef.current - ZOOM_STEP);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "0") {
        event.preventDefault();
        applyZoom(1);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToGlobalPage(globalPageRef.current - 1);
        return;
      }
      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        goToGlobalPage(globalPageRef.current + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen, totalPages]);

  useEffect(() => {
    let cancelled = false;

    function markChapter(index: number, patch: Partial<ChapterMeta>) {
      setMetas((prev) => {
        const next = prev.map((meta, i) =>
          i === index ? { ...meta, ...patch } : meta,
        );
        metasRef.current = next;
        // Keep the same chapter/page on screen when earlier chapters finish loading.
        syncGlobalPageToAnchor(next);
        return next;
      });
    }

    async function openChapter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfjs: any,
      index: number,
      keepDoc: boolean,
    ): Promise<ChapterMeta> {
      const chapter = book.chapters[index];
      const existing = pdfDocsRef.current.get(index);
      if (existing) {
        return {
          chapter,
          pageCount: existing.numPages as number,
          available: true,
        };
      }

      const pdf = await openPdfDocument(pdfjs, chapter.pdfUrl, book.id);
      if (cancelled) {
        await pdf.destroy();
        throw new Error("cancelled");
      }

      if (keepDoc) {
        const previous = pdfDocsRef.current.get(index);
        if (previous && previous !== pdf) void previous.destroy?.();
        pdfDocsRef.current.set(index, pdf);
      } else {
        const pageCount = pdf.numPages as number;
        // Keep bytes warm via openPdfDocument's cache write; drop the doc to save memory.
        await pdf.destroy();
        return { chapter, pageCount, available: true };
      }
      return { chapter, pageCount: pdf.numPages as number, available: true };
    }

    async function tryOpenChapter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfjs: any,
      index: number,
      keepDoc: boolean,
    ): Promise<ChapterMeta | null> {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (cancelled) return null;
        try {
          return await openChapter(pdfjs, index, keepDoc);
        } catch {
          await new Promise((resolve) =>
            setTimeout(resolve, 280 * (attempt + 1)),
          );
        }
      }
      return null;
    }

    function revealChapter(index: number, meta: ChapterMeta) {
      markChapter(index, meta);
      viewAnchorRef.current = { metaIndex: index, pageInChapter: 1 };
      globalPageRef.current = toGlobalPage(metasRef.current, index, 1);
      setGlobalPage(globalPageRef.current);
      setLoadStatus("Opening first page…");
      setReady(true);
    }

    async function bootstrap() {
      setReady(false);
      setError(null);
      setLoadStatus("Preparing reader…");
      viewAnchorRef.current = null;
      globalPageRef.current = 1;
      setGlobalPage(1);
      setZoomFactor(1);
      setCommittedZoom(1);
      zoomFactorRef.current = 1;
      setFitMode("width");
      setHighlightRects([]);
      renderGenerationRef.current += 1;
      try {
        renderTaskRef.current?.cancel?.();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
      clearCanvas(canvasRef.current);

      pdfDocsRef.current.forEach((pdf) => {
        void pdf.destroy?.();
      });
      pdfDocsRef.current.clear();
      chapterLoadRef.current.clear();

      const initial = book.chapters.map((chapter) => ({
        chapter,
        pageCount: 0,
        available: null as boolean | null,
      }));
      metasRef.current = initial;
      setMetas(initial);

      try {
        setLoadStatus("Starting PDF engine…");
        const pdfjs = await import("pdfjs-dist");
        try {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        } catch {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }
        pdfjsRef.current = pdfjs;

        // Load in a fixed order so the first painted page is always the book
        // start (not whichever chapter happens to finish downloading first).
        const order = preferredLoadOrder(book.chapters);
        let firstReadyIndex = -1;

        for (const index of order) {
          if (cancelled) return;
          const chapterTitle = book.chapters[index]?.title ?? "section";
          setLoadStatus(`Opening “${chapterTitle}”…`);
          const meta = await tryOpenChapter(pdfjs, index, true);
          if (meta) {
            firstReadyIndex = index;
            revealChapter(index, meta);
            break;
          }
          markChapter(index, { available: false, pageCount: 0 });
          setLoadStatus(
            `“${chapterTitle}” isn’t available. Trying the next section…`,
          );
        }

        if (firstReadyIndex === -1) {
          if (!cancelled) {
            setLoadStatus("Could not open this book.");
            setError("Something went wrong. Please try again.");
          }
          return;
        }

        // Prefetch the next chapter; load the rest quietly in the background.
        const remaining = order.filter((index) => {
          const meta = metasRef.current[index];
          return index !== firstReadyIndex && meta?.available !== true;
        });

        void (async () => {
          const prefetch = remaining[0];
          if (prefetch != null) {
            const meta = await tryOpenChapter(pdfjs, prefetch, true);
            if (!cancelled && meta) markChapter(prefetch, meta);
            else if (!cancelled) {
              markChapter(prefetch, { available: false, pageCount: 0 });
            }
          }

          const rest = remaining.slice(1);
          const concurrency = 2;
          let cursor = 0;

          async function worker() {
            while (cursor < rest.length) {
              if (cancelled) return;
              const index = rest[cursor];
              cursor += 1;
              if (metasRef.current[index]?.available === true) continue;
              const meta = await tryOpenChapter(pdfjs, index, false);
              if (cancelled) return;
              if (meta) markChapter(index, meta);
              else markChapter(index, { available: false, pageCount: 0 });
            }
          }

          await Promise.all(
            Array.from(
              { length: Math.min(concurrency, rest.length) },
              () => worker(),
            ),
          );
        })();
      } catch {
        if (!cancelled) {
          setLoadStatus("Could not open this book.");
          setError("Something went wrong. Please try again.");
        }
      }
    }

    void bootstrap();

    const docs = pdfDocsRef.current;
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      docs.forEach((pdf) => {
        void pdf.destroy?.();
      });
      docs.clear();
    };
  }, [book, retryToken]);

  useEffect(() => {
    if (!location || !ready || stageWidth <= 0) return;

    const activeLocation = location;
    const generation = ++renderGenerationRef.current;
    let cancelled = false;
    const isStale = () =>
      cancelled || generation !== renderGenerationRef.current;

    async function paintCurrentPage(page: {
      getViewport: (args: { scale: number }) => { width: number; height: number };
      render: (args: {
        canvasContext: CanvasRenderingContext2D;
        viewport: { width: number; height: number };
        canvas: HTMLCanvasElement;
      }) => { promise: Promise<void>; cancel?: () => void };
    }) {
      const canvas = await waitForCanvas(() => canvasRef.current, isStale);
      if (!canvas || isStale()) return false;

      // Prefer measured height; fall back to width-fit when layout is still settling.
      const effectiveFitMode: FitMode =
        fitMode === "page" && stageHeight < 40 ? "width" : fitMode;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale =
        computeFitScale({
          pageWidth: baseViewport.width,
          pageHeight: baseViewport.height,
          stageWidth,
          stageHeight,
          pad: isFullscreen ? 24 : 16,
          fitMode: effectiveFitMode,
        }) * committedZoom;

      const { viewport, task } = await paintPageToCanvas({
        page,
        canvas,
        scale,
        cancelPrevious: renderTaskRef.current,
      });
      if (isStale()) return false;
      renderTaskRef.current = task;
      lastViewportRef.current = viewport;
      return true;
    }

    async function renderPage() {
      setRendering(true);
      try {
        const pdf = await loadChapterDoc(activeLocation.metaIndex);
        if (!pdf || isStale()) return;

        if (activeLocation.metaIndex + 1 < metasRef.current.length) {
          void loadChapterDoc(activeLocation.metaIndex + 1);
        }

        const page = await pdf.getPage(activeLocation.pageInChapter);
        if (isStale()) return;

        const painted = await paintCurrentPage(page);
        if (painted && !isStale()) {
          setError(null);
        } else if (!isStale() && !canvasRef.current) {
          setError("Something went wrong. Please try again.");
        }
      } catch (error) {
        if (isStale() || isBenignRenderError(error)) return;
        // Quiet automatic retry once before surfacing an error.
        try {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (isStale()) return;
          const pdf = await loadChapterDoc(activeLocation.metaIndex);
          if (!pdf || isStale()) return;
          const page = await pdf.getPage(activeLocation.pageInChapter);
          if (isStale()) return;
          const painted = await paintCurrentPage(page);
          if (painted && !isStale()) {
            setError(null);
          } else if (!isStale()) {
            setError("Something went wrong. Please try again.");
          }
        } catch (retryError) {
          if (isStale() || isBenignRenderError(retryError)) return;
          setError("Something went wrong. Please try again.");
        }
      } finally {
        if (generation === renderGenerationRef.current) {
          setRendering(false);
        }
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      try {
        renderTaskRef.current?.cancel?.();
      } catch {
        // ignore
      }
    };
  }, [
    locationKey,
    location,
    committedZoom,
    stageWidth,
    stageHeight,
    fitMode,
    isFullscreen,
    ready,
  ]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, [contenteditable=true]")) {
        return;
      }
      event.preventDefault();
      document.getElementById("pdf-search-input")?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const query = debouncedSearchQuery.trim();
    searchAbortRef.current?.abort();

    if (!ready || query.length < 2) {
      setSearchMatches([]);
      setActiveMatchIndex(0);
      setSearching(false);
      setHighlightRects([]);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);

    void (async () => {
      try {
        const results: PdfSearchMatch[] = [];
        const currentMetas = metasRef.current;
        let globalOffset = 0;

        for (let metaIndex = 0; metaIndex < currentMetas.length; metaIndex += 1) {
          if (controller.signal.aborted) return;
          const meta = currentMetas[metaIndex];
          if (meta.available !== true || meta.pageCount === 0) continue;

          const pdf = await loadChapterDoc(metaIndex);
          if (controller.signal.aborted) return;
          if (!pdf) {
            globalOffset += meta.pageCount;
            continue;
          }

          for (let pageInChapter = 1; pageInChapter <= meta.pageCount; pageInChapter += 1) {
            if (controller.signal.aborted) return;
            const page = await pdf.getPage(pageInChapter);
            const textContent = await page.getTextContent();
            const items = textContent.items.filter(
              (item: { str?: string }) => typeof item.str === "string",
            );
            const pageMatches = findMatchesOnPage({
              items,
              query,
              metaIndex,
              pageInChapter,
              globalPage: globalOffset + pageInChapter,
            });
            results.push(...pageMatches);
          }

          globalOffset += meta.pageCount;
        }

        if (controller.signal.aborted) return;
        setSearchMatches(results);
        setActiveMatchIndex(0);
        setSearching(false);
        if (results[0]) {
          goToGlobalPage(results[0].globalPage);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        setSearching(false);
        setSearchMatches([]);
        setActiveMatchIndex(0);
      }
    })();

    return () => {
      controller.abort();
    };
    // loadChapterDoc is stable enough via refs; book.id changes remount reader flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, searchScopeKey, ready, book.id]);

  useEffect(() => {
    const viewport = lastViewportRef.current;
    if (!viewport || !location || searchMatches.length === 0) {
      setHighlightRects([]);
      return;
    }

    const onPage = searchMatches.filter(
      (match) =>
        match.metaIndex === location.metaIndex &&
        match.pageInChapter === location.pageInChapter,
    );
    if (onPage.length === 0) {
      setHighlightRects([]);
      return;
    }

    const activeId = searchMatches[activeMatchIndex]?.id;

    setHighlightRects(
      onPage.flatMap((match) =>
        toViewportRects(match.pdfRects, viewport).map((rect) => ({
          ...rect,
          active: match.id === activeId,
        })),
      ),
    );
  }, [locationKey, location, searchMatches, activeMatchIndex, committedZoom, rendering]);

  function goToMatch(index: number) {
    if (searchMatches.length === 0) return;
    const next =
      ((index % searchMatches.length) + searchMatches.length) %
      searchMatches.length;
    setActiveMatchIndex(next);
    goToGlobalPage(searchMatches[next].globalPage);
  }

  function applyZoom(next: number) {
    const clamped = clampZoom(next);
    zoomFactorRef.current = clamped;
    setZoomFactor(clamped);
    setCommittedZoom(clamped);
  }

  function enterFullscreen() {
    setFitMode("page");
    applyZoom(1);
    setRailOpen(
      typeof window !== "undefined"
        ? window.matchMedia("(min-width: 768px)").matches
        : true,
    );
    setIsFullscreen(true);
  }

  function exitFullscreen() {
    setIsFullscreen(false);
    setFitMode("width");
    applyZoom(1);
  }

  function jumpToChapter(metaIndex: number) {
    goToChapterPage(metaIndex, 1);
  }

  function jumpToPage(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || totalPages === 0) return;
    goToGlobalPage(parsed);
  }

  useEffect(() => {
    setPageDraft(String(globalPage));
  }, [globalPage]);

  const availableChapters = useMemo(
    () =>
      metas
        .map((meta, metaIndex) => ({ meta, metaIndex }))
        .filter(({ meta }) => meta.available === true),
    [metas],
  );

  const pageLabel = !ready
    ? "Loading…"
    : totalPages > 0
      ? `${globalPage} / ${totalPages}`
      : "—";

  const toolbar = (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 sm:hidden">
        <button
          type="button"
          className={controlButtonClassName("justify-self-start")}
          disabled={globalPage <= 1 || !ready}
          aria-label="Previous page"
          onClick={() => goToGlobalPage(globalPage - 1)}
        >
          <Typography variant="button">Prev</Typography>
        </button>
        <Typography
          variant="small"
          className="text-center font-medium text-foreground"
        >
          {pageLabel}
        </Typography>
        <button
          type="button"
          className={controlButtonClassName("justify-self-end")}
          disabled={!ready || totalPages === 0 || globalPage >= totalPages}
          aria-label="Next page"
          onClick={() => goToGlobalPage(globalPage + 1)}
        >
          <Typography variant="button">Next</Typography>
        </button>
      </div>

      <div className="flex items-center justify-end gap-1.5 border-t border-line px-3 py-2 sm:hidden">
        <button
          type="button"
          className={controlButtonClassName("px-2.5")}
          aria-label="Zoom out"
          onClick={() => applyZoom(zoomFactorRef.current - ZOOM_STEP)}
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
          onClick={() => applyZoom(zoomFactorRef.current + ZOOM_STEP)}
        >
          <Typography variant="button">+</Typography>
        </button>
        <button
          type="button"
          className={controlButtonClassName("px-2.5")}
          aria-label="Open fullscreen preview"
          disabled={!ready}
          onClick={enterFullscreen}
        >
          <Typography variant="button">Full</Typography>
        </button>
      </div>

      <div className="hidden flex-wrap items-center gap-2 p-3 sm:flex">
        <button
          type="button"
          className={controlButtonClassName()}
          disabled={globalPage <= 1 || !ready}
          onClick={() => goToGlobalPage(globalPage - 1)}
        >
          <Typography variant="button">Previous</Typography>
        </button>
        <button
          type="button"
          className={controlButtonClassName()}
          disabled={!ready || totalPages === 0 || globalPage >= totalPages}
          onClick={() => goToGlobalPage(globalPage + 1)}
        >
          <Typography variant="button">Next</Typography>
        </button>
        <Typography variant="small" className="px-2">
          {ready && totalPages > 0 ? `Page ${pageLabel}` : pageLabel}
        </Typography>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={controlButtonClassName()}
            onClick={() => applyZoom(zoomFactorRef.current - ZOOM_STEP)}
          >
            <Typography variant="button">−</Typography>
          </button>
          <Typography variant="small">
            {Math.round(zoomFactor * 100)}%
          </Typography>
          <button
            type="button"
            className={controlButtonClassName()}
            onClick={() => applyZoom(zoomFactorRef.current + ZOOM_STEP)}
          >
            <Typography variant="button">+</Typography>
          </button>
          <button
            type="button"
            className={controlButtonClassName()}
            disabled={!ready}
            onClick={enterFullscreen}
          >
            <Typography variant="button">Fullscreen</Typography>
          </button>
        </div>
      </div>
    </>
  );

  const stage = (
    <div
      ref={stageRef}
      className={
        isFullscreen
          ? "relative min-h-0 flex-1 overflow-auto overscroll-contain bg-[#1e1e1e]"
          : "relative flex min-h-[55dvh] flex-1 justify-center overflow-auto overscroll-contain bg-[#ebe6dc] dark:bg-zinc-900 sm:min-h-[70dvh] sm:rounded-xl sm:border sm:border-line"
      }
    >
      {!ready ? (
        <div className="flex h-full min-h-[40dvh] w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <div
            className={`h-9 w-9 animate-spin rounded-full border-2 border-transparent border-t-accent ${
              isFullscreen ? "border-t-zinc-200" : ""
            }`}
            aria-hidden
          />
          <div className="flex max-w-sm flex-col gap-2">
            <Typography
              variant="bodyMedium"
              className={
                isFullscreen
                  ? "font-medium text-zinc-100"
                  : "font-medium text-foreground"
              }
            >
              {loadStatus}
            </Typography>
            <Typography
              variant="small"
              className={isFullscreen ? "text-zinc-400" : undefined}
            >
              NCERT servers can be slow. We open the book from the beginning —
              thanks for waiting.
            </Typography>
          </div>
        </div>
      ) : null}
      {/* Keep canvas mounted so the first ready render does not miss the ref. */}
      <div
        className={
          ready
            ? isFullscreen
              ? "flex min-h-full w-full items-center justify-center p-3"
              : "relative flex w-full items-start justify-center p-3 sm:p-4"
            : "pointer-events-none invisible absolute h-0 w-0 overflow-hidden"
        }
        aria-hidden={!ready}
      >
        {ready && rendering ? (
          <Typography
            variant="small"
            className="absolute right-3 top-3 z-[1] rounded-md bg-background/90 px-2 py-1"
          >
            Loading…
          </Typography>
        ) : null}
        <div className="relative inline-block shadow-lg">
          <canvas ref={canvasRef} className="block" />
          {highlightRects.map((rect, index) => (
            <div
              key={`${rect.left}-${rect.top}-${index}`}
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: Math.max(rect.height, 2),
                backgroundColor: rect.active
                  ? "rgba(255, 140, 0, 0.45)"
                  : "rgba(255, 214, 10, 0.35)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    const railFieldClassName =
      "w-full rounded-lg border border-white/15 bg-[#2a2a2a] px-3 py-2 text-sm text-[#f2f2f0] outline-none focus:border-accent";

    return (
      <div
        className="fixed inset-0 z-[80] flex h-dvh bg-[#121212] text-[#f2f2f0] [&_button]:border-white/15 [&_button]:bg-[#2a2a2a] [&_button]:text-[#f2f2f0] [&_small]:text-[#cfcfcf] [&_span]:text-[#f2f2f0]"
        style={{
          paddingTop: "var(--safe-top)",
          paddingBottom: "var(--safe-bottom)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title} fullscreen preview`}
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {error ? (
            <div className="absolute inset-x-3 top-3 z-10 rounded-xl border border-red-400/40 bg-red-500/10 p-4">
              <Typography variant="bodyMedium" className="text-red-200">
                {error}
              </Typography>
              <button
                type="button"
                className={`${controlButtonClassName()} mt-3`}
                onClick={() => setRetryToken((value) => value + 1)}
              >
                <Typography variant="button">Try again</Typography>
              </button>
            </div>
          ) : null}
          {stage}
          {!railOpen ? (
            <button
              type="button"
              className={`${controlButtonClassName()} absolute right-3 top-3 z-10 shadow-lg`}
              aria-label="Show controls"
              onClick={() => setRailOpen(true)}
            >
              <Typography variant="button">Controls</Typography>
            </button>
          ) : null}
        </div>

        {railOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-[15] bg-black/45 md:hidden"
            aria-label="Hide controls"
            onClick={() => setRailOpen(false)}
          />
        ) : null}

        <aside
          className={
            railOpen
              ? "absolute inset-y-0 right-0 z-20 flex w-[min(20rem,88vw)] flex-col gap-3 overflow-y-auto border-l border-white/10 bg-[#1a1a1a] p-3 shadow-2xl md:static md:z-0 md:w-72 md:shrink-0 md:shadow-none"
              : "hidden"
          }
        >
          <div className="flex items-start justify-between gap-2">
            <Typography
              variant="small"
              className="min-w-0 flex-1 font-medium leading-snug text-[#f2f2f0]"
            >
              {book.title}
            </Typography>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                className={controlButtonClassName("px-2.5")}
                aria-label="Hide controls"
                onClick={() => setRailOpen(false)}
              >
                <Typography variant="button">Hide</Typography>
              </button>
              <button
                type="button"
                className={controlButtonClassName("px-2.5")}
                onClick={exitFullscreen}
              >
                <Typography variant="button">Close</Typography>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography variant="small" className="text-zinc-400">
              Chapter
            </Typography>
            <select
              className={railFieldClassName}
              disabled={!ready || availableChapters.length === 0}
              value={
                location != null &&
                metas[location.metaIndex]?.available === true
                  ? String(location.metaIndex)
                  : ""
              }
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) jumpToChapter(next);
              }}
            >
              {availableChapters.length === 0 ? (
                <option value="">Loading…</option>
              ) : null}
              {location == null ? <option value="">Select chapter</option> : null}
              {availableChapters.map(({ meta, metaIndex }) => (
                <option key={meta.chapter.pdfUrl} value={metaIndex}>
                  {meta.chapter.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Typography variant="small" className="text-zinc-400">
              Page
            </Typography>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.max(1, totalPages)}
                inputMode="numeric"
                disabled={!ready || totalPages === 0}
                value={pageDraft}
                aria-label="Go to page"
                className={railFieldClassName}
                onChange={(event) => setPageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    jumpToPage(pageDraft);
                  }
                }}
                onBlur={() => jumpToPage(pageDraft)}
              />
              <Typography variant="small" className="shrink-0 text-zinc-400">
                / {totalPages || "—"}
              </Typography>
              <button
                type="button"
                className={controlButtonClassName("px-2.5")}
                disabled={!ready || totalPages === 0}
                onClick={() => jumpToPage(pageDraft)}
              >
                <Typography variant="button">Go</Typography>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={controlButtonClassName()}
              disabled={globalPage <= 1 || !ready}
              onClick={() => goToGlobalPage(globalPage - 1)}
            >
              <Typography variant="button">Previous</Typography>
            </button>
            <button
              type="button"
              className={controlButtonClassName()}
              disabled={!ready || totalPages === 0 || globalPage >= totalPages}
              onClick={() => goToGlobalPage(globalPage + 1)}
            >
              <Typography variant="button">Next</Typography>
            </button>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
            <Typography variant="small" className="text-zinc-400">
              Find
            </Typography>
            <PdfSearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              matchCount={searchMatches.length}
              activeIndex={activeMatchIndex}
              searching={searching}
              disabled={!ready}
              onPrev={() => goToMatch(activeMatchIndex - 1)}
              onNext={() => goToMatch(activeMatchIndex + 1)}
            />
          </div>

          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3">
            <Typography variant="small" className="text-zinc-400">
              View
            </Typography>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={controlButtonClassName(
                  fitMode === "page" ? "border-accent" : undefined,
                )}
                aria-pressed={fitMode === "page"}
                onClick={() => {
                  setFitMode("page");
                  applyZoom(1);
                }}
              >
                <Typography variant="button">Fit page</Typography>
              </button>
              <button
                type="button"
                className={controlButtonClassName(
                  fitMode === "width" ? "border-accent" : undefined,
                )}
                aria-pressed={fitMode === "width"}
                onClick={() => {
                  setFitMode("width");
                  applyZoom(1);
                }}
              >
                <Typography variant="button">Fit width</Typography>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={controlButtonClassName("px-2.5")}
                aria-label="Zoom out"
                onClick={() => applyZoom(zoomFactorRef.current - ZOOM_STEP)}
              >
                <Typography variant="button">−</Typography>
              </button>
              <Typography variant="small" className="min-w-[3rem] text-center">
                {Math.round(zoomFactor * 100)}%
              </Typography>
              <button
                type="button"
                className={controlButtonClassName("px-2.5")}
                aria-label="Zoom in"
                onClick={() => applyZoom(zoomFactorRef.current + ZOOM_STEP)}
              >
                <Typography variant="button">+</Typography>
              </button>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70dvh] flex-col gap-0 sm:gap-4">
      <div className="sticky top-[calc(3.25rem+var(--safe-top))] z-10 border-y border-line bg-background/95 backdrop-blur sm:top-0 sm:rounded-xl sm:border">
        {toolbar}
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
              <Typography variant="button">Try again</Typography>
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

      {stage}
    </div>
  );
}
