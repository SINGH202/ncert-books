"use client";

import type { ChangeEvent } from "react";
import { Typography } from "@/components/typography";

const fieldClassName =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] text-foreground outline-none transition placeholder:text-muted/80 focus:border-accent focus:ring-2 focus:ring-accent/15 sm:py-2.5 sm:text-sm";

type CatalogSearchInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  isPending?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
};

export function CatalogSearchInput({
  id,
  label,
  value,
  placeholder,
  isPending = false,
  onChange,
  onClear,
}: CatalogSearchInputProps) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <label htmlFor={id}>
        <Typography variant="small" className="block font-medium text-foreground/70">
          {label}
        </Typography>
      </label>
      <div className="relative">
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className={`${fieldClassName} pr-10`}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-background hover:text-foreground"
            onClick={() => (onClear ? onClear() : onChange(""))}
          >
            <Typography variant="button" className="text-base leading-none" aria-hidden>
              ×
            </Typography>
          </button>
        ) : null}
      </div>
      {isPending ? (
        <Typography variant="small" className="block text-muted">
          Updating results…
        </Typography>
      ) : null}
    </div>
  );
}

type FilterChipOption<T extends string | number> = {
  value: T;
  label: string;
};

type FilterChipGroupProps<T extends string | number> = {
  label: string;
  value: T;
  options: Array<FilterChipOption<T>>;
  onChange: (value: T) => void;
};

export function FilterChipGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: FilterChipGroupProps<T>) {
  return (
    <div className="space-y-1.5">
      <Typography variant="small" className="block font-medium text-foreground/70">
        {label}
      </Typography>
      <div
        role="group"
        aria-label={label}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              className={[
                "touch-target shrink-0 rounded-lg border px-3 py-2 text-sm transition active:scale-[0.98]",
                selected
                  ? "border-accent bg-accent text-background"
                  : "border-line bg-surface text-foreground hover:border-accent/40",
              ].join(" ")}
              onClick={() => onChange(option.value)}
            >
              <Typography variant="button">{option.label}</Typography>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type CatalogEmptyStateProps = {
  title: string;
  hint: string;
  onReset?: () => void;
  resetLabel?: string;
};

export function CatalogEmptyState({
  title,
  hint,
  onReset,
  resetLabel = "Clear filters",
}: CatalogEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-5 py-10 text-center">
      <Typography variant="h3" className="text-base sm:text-lg">
        {title}
      </Typography>
      <Typography variant="bodyMedium" className="mx-auto mt-2 max-w-sm">
        {hint}
      </Typography>
      {onReset ? (
        <button
          type="button"
          className="mt-5 touch-target inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 transition hover:border-accent/40"
          onClick={onReset}
        >
          <Typography variant="button">{resetLabel}</Typography>
        </button>
      ) : null}
    </div>
  );
}

type ResultsSummaryProps = {
  count: number;
  shortQueryHint?: boolean;
  onClear?: () => void;
};

export function ResultsSummary({
  count,
  shortQueryHint = false,
  onClear,
}: ResultsSummaryProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Typography variant="small" className="block text-muted">
        {count === 0
          ? "No matches"
          : `${count} book${count === 1 ? "" : "s"}`}
        {shortQueryHint ? " · type at least 2 characters to search" : ""}
      </Typography>
      {onClear ? (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-sm text-accent underline-offset-2 hover:underline"
          onClick={onClear}
        >
          <Typography variant="link" className="text-accent">
            Clear filters
          </Typography>
        </button>
      ) : null}
    </div>
  );
}
