import Link from "next/link";
import { Typography } from "@/components/typography";
import type { Book } from "@/lib/types";

type BookListItemProps = {
  book: Book;
  showClass?: boolean;
};

export function BookListItem({ book, showClass = true }: BookListItemProps) {
  return (
    <li className="list-none">
      <Link
        href={`/books/${book.id}`}
        className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/35 hover:bg-background/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99] sm:py-3"
      >
        <div className="min-w-0">
          <Typography
            variant="h3"
            className="text-[15px] transition group-hover:text-accent sm:text-base"
          >
            {book.title}
          </Typography>
          <Typography variant="small" className="mt-1 block">
            {showClass ? `Class ${book.class} · ` : ""}
            {book.subject}
            {" · "}
            {book.chapters.length}{" "}
            {book.chapters.length === 1 ? "section" : "sections"}
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
