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
    viewport: ViewportLike;
    canvas: HTMLCanvasElement;
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

export async function paintPageToCanvas(args: {
  page: PageLike;
  canvas: HTMLCanvasElement;
  scale: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancelPrevious?: { cancel?: () => void } | null;
}): Promise<{
  viewport: ReturnType<PageLike["getViewport"]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: { promise: Promise<void>; cancel?: () => void };
}> {
  const viewport = args.page.getViewport({ scale: args.scale });
  const context = args.canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Canvas context unavailable");
  }

  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  args.canvas.width = Math.floor(viewport.width * outputScale);
  args.canvas.height = Math.floor(viewport.height * outputScale);
  args.canvas.style.width = `${Math.floor(viewport.width)}px`;
  args.canvas.style.height = `${Math.floor(viewport.height)}px`;
  context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

  try {
    args.cancelPrevious?.cancel?.();
  } catch {
    // ignore cancel races
  }

  const task = args.page.render({
    canvasContext: context,
    viewport,
    canvas: args.canvas,
  });
  await task.promise;
  return { viewport, task };
}
