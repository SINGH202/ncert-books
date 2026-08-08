"use client";

import { Typography } from "@/components/typography";
import { controlButtonClassName } from "@/lib/control-button-class";

type ContinueReadingPromptProps = {
  page: number;
  onContinue: () => void;
  onStartOver: () => void;
  isFullscreen?: boolean;
};

export function ContinueReadingPrompt({
  page,
  onContinue,
  onStartOver,
  isFullscreen = false,
}: ContinueReadingPromptProps) {
  return (
    <div
      className={
        isFullscreen
          ? "absolute inset-x-3 top-3 z-20 rounded-xl border border-white/15 bg-[#1a1a1a]/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-3 sm:left-auto sm:w-[22rem]"
          : "absolute inset-x-3 top-3 z-20 rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:left-auto sm:w-[22rem]"
      }
      role="dialog"
      aria-label="Continue reading"
    >
      <Typography
        variant="h3"
        className={
          isFullscreen
            ? "text-[15px] text-zinc-100 sm:text-base"
            : "text-[15px] sm:text-base"
        }
      >
        Continue where you left off?
      </Typography>
      <Typography
        variant="small"
        className={`mt-1 block ${isFullscreen ? "text-zinc-400" : ""}`}
      >
        You were on page {page}. Choose continue or start from the beginning.
      </Typography>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={controlButtonClassName()}
          onClick={onContinue}
        >
          <Typography variant="button">Continue</Typography>
        </button>
        <button
          type="button"
          className={controlButtonClassName()}
          onClick={onStartOver}
        >
          <Typography variant="button">Start over</Typography>
        </button>
      </div>
    </div>
  );
}
