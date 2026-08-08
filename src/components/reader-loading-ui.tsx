"use client";

import { Typography } from "@/components/typography";

export type BackgroundLoadProgress = {
  completed: number;
  total: number;
  currentTitle: string;
};

type ReaderBootOverlayProps = {
  status: string;
  bookTitle: string;
  isFullscreen?: boolean;
};

export function ReaderBootOverlay({
  status,
  bookTitle,
  isFullscreen = false,
}: ReaderBootOverlayProps) {
  return (
    <div className="flex h-full min-h-[40dvh] w-full flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div
        className={`h-9 w-9 animate-spin rounded-full border-2 border-transparent border-t-accent ${
          isFullscreen ? "border-t-zinc-200" : ""
        }`}
        aria-hidden
      />
      <div className="flex max-w-md flex-col gap-2">
        <Typography
          variant="small"
          className={
            isFullscreen
              ? "font-medium tracking-wide text-zinc-400 uppercase"
              : "font-medium tracking-wide text-muted uppercase"
          }
        >
          Opening book
        </Typography>
        <Typography
          variant="h3"
          className={
            isFullscreen
              ? "text-base text-zinc-100 sm:text-lg"
              : "text-base sm:text-lg"
          }
        >
          {bookTitle}
        </Typography>
        <Typography
          variant="bodyMedium"
          className={
            isFullscreen
              ? "font-medium text-zinc-100"
              : "font-medium text-foreground"
          }
        >
          {status}
        </Typography>
        <Typography
          variant="small"
          className={isFullscreen ? "text-zinc-400" : undefined}
        >
          NCERT can be slow. We fail quickly and retry — once a section is
          cached, reopen is instant.
        </Typography>
      </div>
    </div>
  );
}

type ReaderBackgroundProgressProps = {
  progress: BackgroundLoadProgress;
  isFullscreen?: boolean;
};

export function ReaderBackgroundProgress({
  progress,
  isFullscreen = false,
}: ReaderBackgroundProgressProps) {
  const ratio =
    progress.total > 0
      ? Math.min(1, progress.completed / progress.total)
      : 0;
  const done = progress.completed >= progress.total;

  return (
    <div
      className={
        isFullscreen
          ? "pointer-events-none absolute inset-x-3 bottom-3 z-[5] rounded-xl border border-white/10 bg-[#1a1a1a]/95 px-3 py-2.5 shadow-lg backdrop-blur"
          : "pointer-events-none absolute inset-x-3 bottom-3 z-[5] rounded-xl border border-line bg-surface/95 px-3 py-2.5 shadow-lg backdrop-blur sm:inset-x-4"
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-3">
        <Typography
          variant="small"
          className={
            isFullscreen
              ? "font-medium text-zinc-100"
              : "font-medium text-foreground"
          }
        >
          {done
            ? "All sections ready"
            : `Loading sections ${progress.completed}/${progress.total}`}
        </Typography>
        <Typography
          variant="small"
          className={
            isFullscreen
              ? "shrink-0 text-zinc-400"
              : "shrink-0 text-muted"
          }
        >
          {Math.round(ratio * 100)}%
        </Typography>
      </div>
      {!done ? (
        <Typography
          variant="small"
          className={`mt-1 block truncate ${
            isFullscreen ? "text-zinc-400" : "text-muted"
          }`}
        >
          Opening “{progress.currentTitle}”…
        </Typography>
      ) : null}
      <div
        className={`mt-2 h-1.5 overflow-hidden rounded-full ${
          isFullscreen ? "bg-white/10" : "bg-line"
        }`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            isFullscreen ? "bg-zinc-200" : "bg-accent"
          }`}
          style={{ width: `${Math.max(4, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}
