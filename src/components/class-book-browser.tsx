"use client";

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
  groupBooksBySubject,
} from "@/lib/catalog-search";
import type { Book, SchoolClass } from "@/lib/types";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";

type ClassBookBrowserProps = {
  schoolClass: SchoolClass;
  books: Book[];
  subjects: string[];
};

export function ClassBookBrowser({
  schoolClass,
  books,
  subjects,
}: ClassBookBrowserProps) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const debouncedQuery = useDebouncedValue(query, 400);
  const lastTrackedKey = useRef("");

  const trimmedQuery = query.trim();
  const activeSearch = debouncedQuery.trim().length >= 2;
  const filtering = activeSearch || subject !== "all";
  const isPending =
    trimmedQuery.length >= 2 &&
    trimmedQuery.toLowerCase() !== debouncedQuery.trim().toLowerCase();
  const shortQueryHint = trimmedQuery.length > 0 && trimmedQuery.length < 2;

  const subjectOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      ...subjects.map((name) => ({ value: name, label: name })),
    ],
    [subjects],
  );

  const results = useMemo(
    () =>
      filterBooks(books, {
        query: activeSearch ? debouncedQuery : "",
        schoolClass,
        subject,
      }),
    [books, activeSearch, debouncedQuery, schoolClass, subject],
  );

  const grouped = useMemo(() => groupBooksBySubject(results), [results]);

  useEffect(() => {
    if (!filtering) return;
    const key = `${debouncedQuery.trim().toLowerCase()}|${subject}|${results.length}`;
    if (key === lastTrackedKey.current) return;
    lastTrackedKey.current = key;
    trackEvent("catalog_filter_used", {
      surface: "class",
      class: schoolClass,
      hasQuery: activeSearch,
      subject: subject === "all" ? "all" : subject,
      resultCount: results.length,
    });
  }, [
    filtering,
    activeSearch,
    subject,
    debouncedQuery,
    schoolClass,
    results.length,
  ]);

  function clearFilters() {
    setQuery("");
    setSubject("all");
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-line bg-surface/70 p-4 sm:p-5">
        <CatalogSearchInput
          id="class-book-search"
          label={`Search in Class ${schoolClass}`}
          value={query}
          placeholder="Filter by title or subject…"
          isPending={isPending}
          onChange={setQuery}
        />
        <FilterChipGroup
          label="Subject"
          value={subject}
          options={subjectOptions}
          onChange={setSubject}
        />
      </section>

      <ResultsSummary
        count={results.length}
        shortQueryHint={shortQueryHint}
        onClear={filtering ? clearFilters : undefined}
      />

      {results.length === 0 ? (
        <CatalogEmptyState
          title="No books match"
          hint="Try another subject chip or search term."
          onReset={filtering ? clearFilters : undefined}
        />
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.subject} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <Typography variant="h2">{group.subject}</Typography>
                <Typography variant="small" className="shrink-0">
                  {group.books.length}
                </Typography>
              </div>
              <ul className="space-y-2">
                {group.books.map((book) => (
                  <BookListItem
                    key={book.id}
                    book={book}
                    showClass={false}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
