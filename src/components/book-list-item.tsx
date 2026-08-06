import Link from "next/link";
import { Typography } from "@/components/typography";
import type { Book } from "@/lib/types";

export function BookListItem({ book }: { book: Book }) {
  return (
    <li className="list-none">
      <Link
        href={`/books/${book.id}`}
        className="block rounded-xl border border-line bg-surface px-4 py-3.5 transition active:scale-[0.99] sm:py-3"
      >
        <Typography variant="h3" className="text-[15px] sm:text-base">
          {book.title}
        </Typography>
        <Typography variant="small" className="mt-1 block">
          Class {book.class} · {book.subject} · {book.chapters.length} sections
        </Typography>
      </Link>
    </li>
  );
}
