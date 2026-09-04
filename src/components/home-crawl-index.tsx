import Link from "next/link";
import { BookListItem } from "@/components/book-list-item";
import { Typography } from "@/components/typography";
import { groupBooksByClass } from "@/lib/catalog-search";
import type { Book } from "@/lib/types";

type HomeCrawlIndexProps = {
  books: Book[];
};

/** Always-rendered book links so crawlers see more than class hubs on `/`. */
export function HomeCrawlIndex({ books }: HomeCrawlIndexProps) {
  const grouped = groupBooksByClass(books);

  return (
    <section className="space-y-5 border-t border-line pt-8">
      <div className="space-y-2">
        <Typography variant="h2">All NCERT books (Classes 9–12)</Typography>
        <Typography variant="bodyMedium" className="max-w-3xl">
          Complete English-medium catalog on this site. Prefer a class page if
          you want subject filters; each book page lists chapters and opens the
          online reader.
        </Typography>
      </div>
      {grouped.map((group) => (
        <div key={group.schoolClass} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <Typography variant="h3">
              Class {group.schoolClass} NCERT books
            </Typography>
            <Link href={`/class/${group.schoolClass}`} className="shrink-0">
              <Typography variant="link" className="text-xs sm:text-sm">
                Class {group.schoolClass} hub
              </Typography>
            </Link>
          </div>
          <ul className="space-y-2">
            {group.books.map((book) => (
              <BookListItem key={book.id} book={book} showClass={false} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
