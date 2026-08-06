"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookListItem } from "@/components/book-list-item";
import { Typography } from "@/components/typography";
import { trackEvent } from "@/lib/analytics";
import {
  filterBooks,
  groupBooksByClass,
} from "@/lib/catalog-search";
import type { Book, SchoolClass } from "@/lib/types";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

type HomeCatalogBrowserProps = {
  books: Book[];
  syncedAt: string;
  classCounts: Record<SchoolClass, number>;
};

const CLASS_OPTIONS: Array<SchoolClass | "all"> = ["all", 9, 10, 11, 12];

export function HomeCatalogBrowser({
  books,
  syncedAt,
  classCounts,
}: HomeCatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [schoolClass, setSchoolClass] = useState<SchoolClass | "all">("all");
  const debouncedQuery = useDebouncedValue(query, 400);
  const lastTrackedKey = useRef("");

  const activeSearch = debouncedQuery.trim().length >= 2;
  const filtering = activeSearch || schoolClass !== "all";

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
          Catalog synced {new Date(syncedAt).toLocaleString()} · {books.length}{" "}
          books
        </Typography>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Typography variant="small" className="block">
            Search books
          </Typography>
          <label className="sr-only" htmlFor="home-book-search">
            Search books by title or subject
          </label>
          <input
            id="home-book-search"
            type="search"
            value={query}
            placeholder="Try “Science”, “Maths”, book code…"
            autoComplete="off"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-44">
          <Typography variant="small" className="block">
            Class
          </Typography>
          <label className="sr-only" htmlFor="home-class-filter">
            Filter by class
          </label>
          <select
            id="home-class-filter"
            value={schoolClass}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            onChange={(event) => {
              const value = event.target.value;
              setSchoolClass(
                value === "all" ? "all" : (Number(value) as SchoolClass),
              );
            }}
          >
            {CLASS_OPTIONS.map((option) => (
              <option key={String(option)} value={option}>
                {option === "all" ? "All classes" : `Class ${option}`}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!filtering ? (
        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          {([9, 10, 11, 12] as SchoolClass[]).map((value) => (
            <Link
              key={value}
              href={`/class/${value}`}
              className="flex min-h-[7.5rem] flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition active:scale-[0.98] sm:min-h-[9rem] sm:p-6"
            >
              <Typography variant="h2" className="text-lg sm:text-2xl">
                Class {value}
              </Typography>
              <Typography variant="small" className="mt-3 block">
                {classCounts[value]} books
              </Typography>
            </Link>
          ))}
        </section>
      ) : (
        <section className="space-y-6">
          <Typography variant="small" className="block">
            {results.length === 0
              ? "No books match your search."
              : `${results.length} book${results.length === 1 ? "" : "s"} found`}
            {query.trim().length > 0 && query.trim().length < 2
              ? " · type at least 2 characters to search by name"
              : ""}
          </Typography>

          {grouped.map((group) => (
            <div key={group.schoolClass} className="space-y-3">
              <Typography variant="h2">Class {group.schoolClass}</Typography>
              <ul className="space-y-2">
                {group.books.map((book) => (
                  <BookListItem key={book.id} book={book} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
