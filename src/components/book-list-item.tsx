import Link from "next/link";
import { Typography } from "@/components/typography";
import { bookLinkLabel } from "@/lib/seo-content";
import type { Book } from "@/lib/types";

type BookListItemProps = {
  book: Book;
  showClass?: boolean;
  /** When true, visible title uses the keyword-rich bookLinkLabel. */
  emphasizeSeoLabel?: boolean;
};

export function BookListItem({
  book,
  showClass = true,
  emphasizeSeoLabel = false,
}: BookListItemProps) {
  const label = bookLinkLabel(book);
  return (
    <li className="list-none">
      <Link
        href={`/books/${book.id}`}
        aria-label={label}
        className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/35 hover:bg-background/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] sm:py-3"
      >
        <div className="min-w-0">
          <Typography
            variant="h3"
            className="text-[15px] transition group-hover:text-accent sm:text-base"
          >
            {emphasizeSeoLabel ? label : book.title}
          </Typography>
          <Typography variant="small" className="mt-1 block">
            {emphasizeSeoLabel
              ? `${book.chapters.length} ${
                  book.chapters.length === 1 ? "chapter" : "chapters"
                } · Read online`
              : `${showClass ? `Class ${book.class} · ` : ""}${book.subject}${" · NCERT · "}${book.chapters.length} ${
                  book.chapters.length === 1 ? "chapter" : "chapters"
                }`}
          </Typography>
        </div>
        <Typography
          variant="small"
          className="mt-0.5 shrink-0 text-muted transition group-hover:text-accent"
          aria-hidden
        >
          →
        </Typography>
      </Link>
    </li>
  );
}
