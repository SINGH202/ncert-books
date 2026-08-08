"use client";

import { Typography } from "@/components/typography";
import { controlButtonClassName } from "@/lib/control-button-class";

type PdfSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  activeIndex: number;
  searching: boolean;
  /** e.g. "Searching 3/8…" or "In 5 loaded sections" */
  statusLabel?: string;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCancel?: () => void;
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
  statusLabel,
  disabled,
  onPrev,
  onNext,
  onCancel,
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
  const mutedClass = isDark ? "text-zinc-300" : "text-muted";

  return (
    <div className="flex w-full flex-col gap-1.5">
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
          placeholder="Find in loaded sections"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-40"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && searching && onCancel) {
              event.preventDefault();
              onCancel();
              return;
            }
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
          className={`min-w-[4.5rem] text-center ${mutedClass}`}
        >
          {counter}
        </Typography>
        {searching && onCancel ? (
          <button
            type="button"
            className={controlButtonClassName("px-2.5")}
            aria-label="Cancel search"
            onClick={onCancel}
          >
            <Typography variant="button">Cancel</Typography>
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
      {statusLabel ? (
        <Typography variant="small" className={`block ${mutedClass}`}>
          {statusLabel}
        </Typography>
      ) : null}
    </div>
  );
}
