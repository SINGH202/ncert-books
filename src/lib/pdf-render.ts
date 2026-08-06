import type { FitMode } from "@/lib/types";

export type { FitMode };

type ViewportLike = {
  width: number;
  height: number;
};

type PageLike = {
  getViewport: (args: { scale: number }) => ViewportLike & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    convertToViewportRectangle?: (...args: any[]) => number[];
  };
  render: (args: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement | null;
    viewport: ViewportLike;
    transform?: number[] | null;
    background?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) => { promise: Promise<void>; cancel?: () => void };
};

export function computeFitScale(args: {
  pageWidth: number;
  pageHeight: number;
  stageWidth: number;
  stageHeight: number;
  pad: number;
  fitMode: FitMode;
}): number {
  const widthScale = Math.max(
    0.35,
    (args.stageWidth - args.pad) / args.pageWidth,
  );
  const heightScale =
    args.stageHeight > 40
      ? Math.max(0.35, (args.stageHeight - args.pad) / args.pageHeight)
      : widthScale;
  return args.fitMode === "page"
    ? Math.min(widthScale, heightScale)
    : widthScale;
}

async function cancelRenderTask(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: { promise?: Promise<void>; cancel?: () => void } | null | undefined,
): Promise<void> {
  if (!task) return;
  try {
    task.cancel?.();
  } catch {
    // ignore
  }
  try {
    await task.promise;
  } catch {
    // Expected when cancelled / destroyed.
  }
}

/**
 * Paint a PDF page onto the display canvas.
 *
 * Uses a brand-new offscreen canvas for every PDF.js render (reusing one canvas
 * is a known cause of mirrored/inverted pages), then copies the result to the
 * visible canvas. Follows the official HiDPI `transform` pattern.
 */
export async function paintPageToCanvas(args: {
  page: PageLike;
  canvas: HTMLCanvasElement;
  scale: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancelPrevious?: { promise?: Promise<void>; cancel?: () => void } | null;
}): Promise<{
  viewport: ReturnType<PageLike["getViewport"]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: { promise: Promise<void>; cancel?: () => void };
}> {
  await cancelRenderTask(args.cancelPrevious);

  // Default viewport already applies the page's embedded /Rotate value.
  const viewport = args.page.getViewport({ scale: args.scale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = Math.max(1, Math.floor(viewport.width));
  const cssHeight = Math.max(1, Math.floor(viewport.height));
  const pixelWidth = Math.max(1, Math.floor(viewport.width * outputScale));
  const pixelHeight = Math.max(1, Math.floor(viewport.height * outputScale));

  const offscreen = document.createElement("canvas");
  offscreen.width = pixelWidth;
  offscreen.height = pixelHeight;

  const offscreenContext = offscreen.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });
  if (!offscreenContext) {
    throw new Error("Canvas context unavailable");
  }

  offscreenContext.setTransform(1, 0, 0, 1, 0, 0);
  offscreenContext.fillStyle = "#ffffff";
  offscreenContext.fillRect(0, 0, pixelWidth, pixelHeight);

  const transform =
    outputScale !== 1 ? ([outputScale, 0, 0, outputScale, 0, 0] as number[]) : null;

  // PDF.js 5: when using canvasContext, `canvas` must be null.
  const task = args.page.render({
    canvasContext: offscreenContext,
    canvas: null,
    viewport,
    transform,
    background: "rgb(255,255,255)",
  });

  try {
    await task.promise;
  } catch (error) {
    offscreen.width = 0;
    offscreen.height = 0;
    throw error;
  }

  const display = args.canvas;
  display.width = pixelWidth;
  display.height = pixelHeight;
  display.style.width = `${cssWidth}px`;
  display.style.height = `${cssHeight}px`;

  const displayContext = display.getContext("2d", { alpha: false });
  if (!displayContext) {
    throw new Error("Display canvas context unavailable");
  }
  displayContext.setTransform(1, 0, 0, 1, 0, 0);
  displayContext.fillStyle = "#ffffff";
  displayContext.fillRect(0, 0, pixelWidth, pixelHeight);
  displayContext.drawImage(offscreen, 0, 0);

  offscreen.width = 0;
  offscreen.height = 0;

  return { viewport, task };
}
