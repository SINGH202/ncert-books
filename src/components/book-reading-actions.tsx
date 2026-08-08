"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Typography } from "@/components/typography";
import {
  getReadingProgress,
  type ReadingProgress,
} from "@/lib/reading-progress";

type BookReadingActionsProps = {
  bookId: string;
};

export function BookReadingActions({ bookId }: BookReadingActionsProps) {
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getReadingProgress(bookId).then((saved) => {
      if (cancelled) return;
      setProgress(saved && saved.globalPage > 1 ? saved : null);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (!checked || !progress) {
    return (
      <Link
        href={`/books/${bookId}/read`}
        className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 sm:w-auto"
      >
        <Typography
          variant="button"
          className="text-[#f7f4ef] dark:text-[#0c0f0e]"
        >
          Read full book
        </Typography>
      </Link>
    );
  }

  return (
    <>
      <Link
        href={`/books/${bookId}/read?continue=1`}
        className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 sm:w-auto"
      >
        <Typography
          variant="button"
          className="text-[#f7f4ef] dark:text-[#0c0f0e]"
        >
          Continue reading · page {progress.globalPage}
        </Typography>
      </Link>
      <Link
        href={`/books/${bookId}/read`}
        className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 sm:w-auto"
      >
        <Typography variant="button">Start from beginning</Typography>
      </Link>
    </>
  );
}
