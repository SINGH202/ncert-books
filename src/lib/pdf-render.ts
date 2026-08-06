import type { FitMode } from "@/lib/types";

export type { FitMode };

type ViewportLike = {
  width: number;
  height: number;
  transform?: number[];
};

type PageLike = {
  rotate?: number;
  getViewport: (args: {
    scale: number;
    rotation?: number;
  }) => ViewportLike & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    convertToViewportRectangle?: (...args: any[]) => number[];
  };
  render: (args: {
    canvas: HTMLCanvasElement;
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
 * Paint a PDF.js page onto a canvas using the library's recommended HiDPI path.
 * Avoids setTransform-before-render (known to invert/corrupt pages when reused)
 * and cancels any in-flight paint before starting a new one.
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

  // Include the page's embedded rotation so landscape/rotated pages stay upright.
  const rotation =
    typeof args.page.rotate === "number" ? args.page.rotate : undefined;
  const viewport = args.page.getViewport({
    scale: args.scale,
    ...(rotation != null ? { rotation } : {}),
  });

  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(viewport.width * outputScale));
  const height = Math.max(1, Math.floor(viewport.height * outputScale));

  // Assigning width/height resets the context (clears prior corrupt paints).
  args.canvas.width = width;
  args.canvas.height = height;
  args.canvas.style.width = `${Math.floor(viewport.width)}px`;
  args.canvas.style.height = `${Math.floor(viewport.height)}px`;

  const context = args.canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  // Opaque canvases clear to black — paint a white page backdrop first.
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const transform =
    outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

  // PDF.js 4+/5: prefer `canvas` + `transform`. Do not also setTransform on the
  // context or pass canvasContext together with canvas (can double-apply CTM).
  const task = args.page.render({
    canvas: args.canvas,
    viewport,
    transform,
    background: "rgb(255,255,255)",
  });

  await task.promise;
  return { viewport, task };
}
