"use client";

import { Typography } from "@/components/typography";
import { controlButtonClassName } from "@/lib/control-button-class";

type PdfSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  activeIndex: number;
  searching: boolean;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Fullscreen rail uses dark; inline desktop toolbar uses light. */
  tone?: "dark" | "light";
  inputId?: string;
};

export function PdfSearchBar({
  query,
  onQueryChange,
  matchCount,
  activeIndex,
  searching,
  disabled,
  onPrev,
  onNext,
  tone = "dark",
  inputId = "pdf-search-input",
}: PdfSearchBarProps) {
  const counter =
    matchCount > 0
      ? `${activeIndex + 1} of ${matchCount}`
      : query.trim().length >= 2
        ? searching
          ? "…"
          : "0 of 0"
        : "";

  const isDark = tone === "dark";

  return (
    <div
      className={
        isDark
          ? "flex w-full flex-wrap items-center gap-2 [&_input]:bg-[#2a2a2a] [&_input]:text-[#f2f2f0] [&_input]:placeholder:text-zinc-400"
          : "flex w-full flex-wrap items-center gap-2"
      }
    >
      <label className="sr-only" htmlFor={inputId}>
        Search in book
      </label>
      <input
        id={inputId}
        type="text"
        value={query}
        disabled={disabled}
        placeholder="Find in book"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-40"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) onPrev();
            else onNext();
          }
          // Keep space from bubbling to page-nav shortcuts.
          if (event.key === " ") {
            event.stopPropagation();
          }
        }}
      />
      <Typography
        variant="small"
        className={
          isDark
            ? "min-w-[4.5rem] text-center text-zinc-300"
            : "min-w-[4.5rem] text-center text-muted"
        }
      >
        {counter}
      </Typography>
      <button
        type="button"
        className={controlButtonClassName("px-2.5")}
        disabled={disabled || matchCount === 0}
        aria-label="Previous match"
        onClick={onPrev}
      >
        <Typography variant="button">↑</Typography>
      </button>
      <button
        type="button"
        className={controlButtonClassName("px-2.5")}
        disabled={disabled || matchCount === 0}
        aria-label="Next match"
        onClick={onNext}
      >
        <Typography variant="button">↓</Typography>
      </button>
    </div>
  );
}
