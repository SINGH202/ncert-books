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
}: PdfSearchBarProps) {
  const counter =
    matchCount > 0
      ? `${activeIndex + 1} of ${matchCount}`
      : query.trim().length >= 2
        ? searching
          ? "…"
          : "0 of 0"
        : "";

  return (
    <div className="flex w-full flex-wrap items-center gap-2 [&_input]:bg-[#2a2a2a] [&_input]:text-[#f2f2f0] [&_input]:placeholder:text-zinc-400">
      <label className="sr-only" htmlFor="pdf-search-input">
        Search in book
      </label>
      <input
        id="pdf-search-input"
        type="text"
        value={query}
        disabled={disabled}
        placeholder="Find in book"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
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
      <Typography variant="small" className="min-w-[4.5rem] text-center text-zinc-300">
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
