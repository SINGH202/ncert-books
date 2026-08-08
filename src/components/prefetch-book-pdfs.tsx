"use client";

import { useEffect } from "react";
import {
  getFirstContentChapterUrl,
  prefetchPdf,
} from "@/lib/pdf-cache";
import type { Book } from "@/lib/types";

type PrefetchBookPdfsProps = {
  book: Pick<Book, "id" | "chapters">;
};

/**
 * Warm the first content chapter (and optionally the next) while the user is
 * still on the book page, so “Read full book” opens faster.
 */
export function PrefetchBookPdfs({ book }: PrefetchBookPdfsProps) {
  useEffect(() => {
    const firstUrl = getFirstContentChapterUrl(book.chapters);
    if (!firstUrl) return;

    prefetchPdf(firstUrl, book.id);

    const firstIndex = book.chapters.findIndex(
      (chapter) => chapter.pdfUrl === firstUrl,
    );
    const next = book.chapters
      .slice(firstIndex + 1)
      .find((chapter) => chapter.title !== "Prelims");
    if (next) {
      const timer = window.setTimeout(() => {
        prefetchPdf(next.pdfUrl, book.id);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [book.id, book.chapters]);

  return null;
}
