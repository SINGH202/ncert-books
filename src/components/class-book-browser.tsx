"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookListItem } from "@/components/book-list-item";
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
  const [subject, setSubject] = useState<string | "all">("all");
  const debouncedQuery = useDebouncedValue(query, 400);
  const lastTrackedKey = useRef("");

  const activeSearch = debouncedQuery.trim().length >= 2;

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
    const filtering = activeSearch || subject !== "all";
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
    activeSearch,
    subject,
    debouncedQuery,
    schoolClass,
    results.length,
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Typography variant="small" className="block">
            Search in Class {schoolClass}
          </Typography>
          <label className="sr-only" htmlFor="class-book-search">
            Search books in this class
          </label>
          <input
            id="class-book-search"
            type="search"
            value={query}
            placeholder="Filter by title or subject…"
            autoComplete="off"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-56">
          <Typography variant="small" className="block">
            Subject
          </Typography>
          <label className="sr-only" htmlFor="class-subject-filter">
            Filter by subject
          </label>
          <select
            id="class-subject-filter"
            value={subject}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            onChange={(event) =>
              setSubject(
                event.target.value === "all" ? "all" : event.target.value,
              )
            }
          >
            <option value="all">All subjects</option>
            {subjects.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <Typography variant="small" className="block">
        {results.length === 0
          ? "No books match your filters."
          : `${results.length} book${results.length === 1 ? "" : "s"}`}
        {query.trim().length > 0 && query.trim().length < 2
          ? " · type at least 2 characters to search by name"
          : ""}
      </Typography>

      <div className="space-y-8">
        {grouped.map((group) => (
          <section key={group.subject} className="space-y-3">
            <Typography variant="h2">{group.subject}</Typography>
            <ul className="space-y-2">
              {group.books.map((book) => (
                <BookListItem key={book.id} book={book} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
