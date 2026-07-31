"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PdfSearchBar } from "@/components/pdf-search-bar";
import { Typography } from "@/components/typography";
import { controlButtonClassName } from "@/lib/control-button-class";
import {
  fetchAndCachePdf,
  getReaderProgress,
  putReaderProgress,
} from "@/lib/pdf-cache";
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
  const pdfDataRef = useRef<Map<number, ArrayBuffer>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);
  const renderGenerationRef = useRef(0);
  const chapterLoadRef = useRef<Map<number, Promise<PdfDocument | null>>>(
    new Map(),
  );
  const metasRef = useRef<ChapterMeta[]>([]);
  const restoredRef = useRef(false);
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
  const zoomFactorRef = useRef(zoomFactor);

  useEffect(() => {
    zoomFactorRef.current = zoomFactor;
  }, [zoomFactor]);

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
      if (!pdfjs || meta?.available !== true) return null;

      let data = pdfDataRef.current.get(metaIndex);
      if (!data || data.byteLength < 100) {
        data = await fetchAndCachePdf(meta.chapter.pdfUrl, book.id);
        pdfDataRef.current.set(metaIndex, data);
      }

      const again = pdfDocsRef.current.get(metaIndex);
      if (again) return again;

      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(data.slice(0)),
      }).promise;

      const raced = pdfDocsRef.current.get(metaIndex);
      if (raced) {
        await pdf.destroy();
        return raced;
      }

      pdfDocsRef.current.set(metaIndex, pdf);
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
        setGlobalPage((page) => Math.max(1, page - 1));
        return;
      }
      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        setGlobalPage((page) => Math.min(totalPages || page, page + 1));
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
    restoredRef.current = false;

    function markChapter(index: number, patch: Partial<ChapterMeta>) {
      setMetas((prev) => {
        const next = prev.map((meta, i) =>
          i === index ? { ...meta, ...patch } : meta,
        );
        metasRef.current = next;
        return next;
      });
    }

    async function loadChapterData(index: number): Promise<ArrayBuffer> {
      const existing = pdfDataRef.current.get(index);
      if (existing && existing.byteLength > 100) return existing;
      const data = await fetchAndCachePdf(
        book.chapters[index].pdfUrl,
        book.id,
      );
      pdfDataRef.current.set(index, data);
      return data;
    }

    async function openChapter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfjs: any,
      index: number,
      keepDoc: boolean,
    ): Promise<ChapterMeta> {
      const chapter = book.chapters[index];
      const data = await loadChapterData(index);
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(data.slice(0)),
      }).promise;
      if (cancelled) {
        await pdf.destroy();
        throw new Error("cancelled");
      }
      if (keepDoc) {
        const previous = pdfDocsRef.current.get(index);
        if (previous && previous !== pdf) void previous.destroy?.();
        pdfDocsRef.current.set(index, pdf);
      } else {
        const pageCount = pdf.numPages;
        await pdf.destroy();
        return { chapter, pageCount, available: true };
      }
      return { chapter, pageCount: pdf.numPages, available: true };
    }

    async function tryOpenChapter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfjs: any,
      index: number,
      keepDoc: boolean,
    ): Promise<ChapterMeta | null> {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (cancelled) return null;
        try {
          return await openChapter(pdfjs, index, keepDoc);
        } catch {
          await new Promise((resolve) =>
            setTimeout(resolve, 500 * (attempt + 1)),
          );
        }
      }
      return null;
    }

    async function bootstrap() {
      setReady(false);
      setError(null);
      setGlobalPage(1);
      pdfDocsRef.current.forEach((pdf) => {
        void pdf.destroy?.();
      });
      pdfDocsRef.current.clear();
      pdfDataRef.current.clear();

      const initial = book.chapters.map((chapter) => ({
        chapter,
        pageCount: 0,
        available: null as boolean | null,
      }));
      metasRef.current = initial;
      setMetas(initial);

      try {
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

        const saved = await getReaderProgress(book.id);
        if (!cancelled && saved) {
          setZoomFactor(clampZoom(saved.zoomFactor || 1));
          setFitMode(saved.fitMode === "page" ? "page" : "width");
        }

        const order = preferredLoadOrder(book.chapters);
        let firstReadyIndex = -1;

        // Pass 1 + one automatic full retry if NCERT is flaky.
        for (let pass = 0; pass < 2 && firstReadyIndex === -1; pass += 1) {
          for (const index of order) {
            if (cancelled) return;
            const meta = await tryOpenChapter(pdfjs, index, true);
            if (meta) {
              markChapter(index, meta);
              firstReadyIndex = index;
              setReady(true);
              break;
            }
            markChapter(index, { available: false, pageCount: 0 });
          }
          if (firstReadyIndex === -1 && pass === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (firstReadyIndex === -1) {
          if (!cancelled) {
            setError("Something went wrong. Please try again.");
          }
          return;
        }

        const remaining = order.filter((index) => index !== firstReadyIndex);
        const concurrency = 2;
        let cursor = 0;

        async function worker() {
          while (cursor < remaining.length) {
            if (cancelled) return;
            const index = remaining[cursor];
            cursor += 1;
            const meta = await tryOpenChapter(pdfjs, index, false);
            if (cancelled) return;
            if (meta) {
              markChapter(index, meta);
            } else {
              markChapter(index, { available: false, pageCount: 0 });
            }
          }
        }

        await Promise.all(
          Array.from(
            { length: Math.min(concurrency, remaining.length) },
            () => worker(),
          ),
        );

        if (!cancelled && saved?.globalPage && !restoredRef.current) {
          restoredRef.current = true;
          const maxPage = sumAvailablePages(metasRef.current);
          setGlobalPage(
            Math.min(Math.max(1, saved.globalPage), maxPage || 1),
          );
        }
      } catch {
        if (!cancelled) {
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
    if (!ready || totalPages === 0) return;
    const handle = window.setTimeout(() => {
      void putReaderProgress({
        bookId: book.id,
        globalPage,
        zoomFactor,
        fitMode,
        updatedAt: Date.now(),
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [book.id, ready, totalPages, globalPage, zoomFactor, fitMode]);

  useEffect(() => {
    if (!location || !ready || stageWidth <= 0) return;
    if (fitMode === "page" && stageHeight < 40) return;

    const activeLocation = location;
    const generation = ++renderGenerationRef.current;
    let cancelled = false;

    async function renderPage() {
      setRendering(true);
      try {
        const pdf = await loadChapterDoc(activeLocation.metaIndex);
        if (
          !pdf ||
          cancelled ||
          generation !== renderGenerationRef.current
        ) {
          return;
        }

        if (activeLocation.metaIndex + 1 < metasRef.current.length) {
          void loadChapterDoc(activeLocation.metaIndex + 1);
        }

        const page = await pdf.getPage(activeLocation.pageInChapter);
        if (cancelled || generation !== renderGenerationRef.current) return;

        const canvas = canvasRef.current;
        if (!canvas || cancelled || generation !== renderGenerationRef.current) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const scale =
          computeFitScale({
            pageWidth: baseViewport.width,
            pageHeight: baseViewport.height,
            stageWidth,
            stageHeight,
            pad: isFullscreen ? 24 : 16,
            fitMode,
          }) * committedZoom;

        const { viewport, task } = await paintPageToCanvas({
          page,
          canvas,
          scale,
          cancelPrevious: renderTaskRef.current,
        });
        renderTaskRef.current = task;

        if (!cancelled && generation === renderGenerationRef.current) {
          lastViewportRef.current = viewport;
          setError(null);
        }
      } catch (error) {
        if (
          cancelled ||
          generation !== renderGenerationRef.current ||
          isBenignRenderError(error)
        ) {
          return;
        }
        // Quiet automatic retry once before surfacing an error.
        try {
          await new Promise((resolve) => setTimeout(resolve, 600));
          if (cancelled || generation !== renderGenerationRef.current) return;
          const pdf = await loadChapterDoc(activeLocation.metaIndex);
          if (!pdf || cancelled || generation !== renderGenerationRef.current) {
            return;
          }
          const page = await pdf.getPage(activeLocation.pageInChapter);
          if (cancelled || generation !== renderGenerationRef.current) return;
          const canvas = canvasRef.current;
          if (!canvas) {
            setError("Something went wrong. Please try again.");
            return;
          }
          const baseViewport = page.getViewport({ scale: 1 });
          const scale =
            computeFitScale({
              pageWidth: baseViewport.width,
              pageHeight: baseViewport.height,
              stageWidth,
              stageHeight,
              pad: isFullscreen ? 24 : 16,
              fitMode,
            }) * committedZoom;
          const { viewport, task } = await paintPageToCanvas({
            page,
            canvas,
            scale,
            cancelPrevious: renderTaskRef.current,
          });
          renderTaskRef.current = task;
          if (!cancelled && generation === renderGenerationRef.current) {
            lastViewportRef.current = viewport;
            setError(null);
          }
        } catch (retryError) {
          if (
            cancelled ||
            generation !== renderGenerationRef.current ||
            isBenignRenderError(retryError)
          ) {
            return;
          }
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
          setGlobalPage(results[0].globalPage);
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
    setGlobalPage(searchMatches[next].globalPage);
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

  function globalPageForChapter(metaIndex: number): number {
    let page = 1;
    for (let i = 0; i < metaIndex; i += 1) {
      if (metas[i]?.available === true) page += metas[i].pageCount;
    }
    return page;
  }

  function jumpToChapter(metaIndex: number) {
    if (metas[metaIndex]?.available !== true) return;
    setGlobalPage(globalPageForChapter(metaIndex));
  }

  function jumpToPage(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || totalPages === 0) return;
    setGlobalPage(Math.min(totalPages, Math.max(1, parsed)));
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
          onClick={() => setGlobalPage((page) => Math.max(1, page - 1))}
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
          onClick={() =>
            setGlobalPage((page) => Math.min(totalPages, page + 1))
          }
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
        <div className="flex h-full min-h-[40dvh] w-full flex-col items-center justify-center gap-2 px-4 py-8">
          <Typography
            variant="bodyMedium"
            className={isFullscreen ? "text-zinc-200" : undefined}
          >
            Loading…
          </Typography>
        </div>
      ) : (
        <div
          className={
            isFullscreen
              ? "flex min-h-full w-full items-center justify-center p-3"
              : "relative flex w-full items-start justify-center p-3 sm:p-4"
          }
        >
          {rendering ? (
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
      )}
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
