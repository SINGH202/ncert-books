"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookListItem } from "@/components/book-list-item";
import {
  CatalogEmptyState,
  CatalogSearchInput,
  FilterChipGroup,
  ResultsSummary,
} from "@/components/catalog-filters";
import { Typography } from "@/components/typography";
import { trackEvent } from "@/lib/analytics";
import {
  filterBooks,
  groupBooksByClass,
} from "@/lib/catalog-search";
import { formatSyncedAt } from "@/lib/format-date";
import type { Book, SchoolClass } from "@/lib/types";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

type HomeCatalogBrowserProps = {
  books: Book[];
  syncedAt: string;
  classCounts: Record<SchoolClass, number>;
};

const CLASS_CHIP_OPTIONS: Array<{ value: SchoolClass | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: 9, label: "9" },
  { value: 10, label: "10" },
  { value: 11, label: "11" },
  { value: 12, label: "12" },
];

export function HomeCatalogBrowser({
  books,
  syncedAt,
  classCounts,
}: HomeCatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [schoolClass, setSchoolClass] = useState<SchoolClass | "all">("all");
  const debouncedQuery = useDebouncedValue(query, 400);
  const lastTrackedKey = useRef("");

  const trimmedQuery = query.trim();
  const activeSearch = debouncedQuery.trim().length >= 2;
  const filtering = activeSearch || schoolClass !== "all";
  const isPending =
    trimmedQuery.length >= 2 &&
    trimmedQuery.toLowerCase() !== debouncedQuery.trim().toLowerCase();
  const shortQueryHint = trimmedQuery.length > 0 && trimmedQuery.length < 2;

  const results = useMemo(
    () =>
      filterBooks(books, {
        query: activeSearch ? debouncedQuery : "",
        schoolClass,
      }),
    [books, activeSearch, debouncedQuery, schoolClass],
  );

  const grouped = useMemo(() => groupBooksByClass(results), [results]);

  useEffect(() => {
    if (!filtering) return;
    const key = `${debouncedQuery.trim().toLowerCase()}|${schoolClass}|${results.length}`;
    if (key === lastTrackedKey.current) return;
    lastTrackedKey.current = key;
    trackEvent("catalog_filter_used", {
      surface: "home",
      hasQuery: activeSearch,
      schoolClass: schoolClass === "all" ? "all" : schoolClass,
      resultCount: results.length,
    });
  }, [filtering, debouncedQuery, schoolClass, activeSearch, results.length]);

  function clearFilters() {
    setQuery("");
    setSchoolClass("all");
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section className="space-y-3">
        <Typography variant="h1">NCERT Books</Typography>
        <Typography variant="bodyMedium" className="max-w-2xl">
          Browse English-medium NCERT textbooks for Classes 9–12 and preview
          full books in your browser. Content is loaded from the official NCERT
          textbook portal.
        </Typography>
        <Typography variant="small" className="block">
          Catalog synced {formatSyncedAt(syncedAt)} · {books.length} books
        </Typography>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface/70 p-4 sm:p-5">
        <CatalogSearchInput
          id="home-book-search"
          label="Search books"
          value={query}
          placeholder="Try “Science”, “Maths”, or a book code…"
          isPending={isPending}
          onChange={setQuery}
        />
        <FilterChipGroup
          label="Class"
          value={schoolClass}
          options={CLASS_CHIP_OPTIONS}
          onChange={setSchoolClass}
        />
      </section>

      {!filtering ? (
        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          {([9, 10, 11, 12] as SchoolClass[]).map((value) => (
            <Link
              key={value}
              href={`/class/${value}`}
              className="group flex min-h-[7.5rem] flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-accent/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] sm:min-h-[9rem] sm:p-6"
            >
              <Typography
                variant="h2"
                className="text-lg transition group-hover:text-accent sm:text-2xl"
              >
                Class {value}
              </Typography>
              <Typography variant="small" className="mt-3 block">
                {classCounts[value]} books
              </Typography>
            </Link>
          ))}
        </section>
      ) : (
        <section className="space-y-5">
          <ResultsSummary
            count={results.length}
            shortQueryHint={shortQueryHint}
            onClear={clearFilters}
          />

          {results.length === 0 ? (
            <CatalogEmptyState
              title="No books found"
              hint="Try a different title, subject, or class — or clear filters to browse by class again."
              onReset={clearFilters}
            />
          ) : (
            grouped.map((group) => (
              <div key={group.schoolClass} className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Typography variant="h2">Class {group.schoolClass}</Typography>
                  <Link
                    href={`/class/${group.schoolClass}`}
                    className="shrink-0"
                  >
                    <Typography variant="link" className="text-xs sm:text-sm">
                      Browse class
                    </Typography>
                  </Link>
                </div>
                <ul className="space-y-2">
                  {group.books.map((book) => (
                    <BookListItem key={book.id} book={book} showClass={false} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
