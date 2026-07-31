import Link from "next/link";
import { notFound } from "next/navigation";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import { getAllBooks, getBookById } from "@/lib/catalog";

type BookPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllBooks().map((book) => ({ slug: book.id }));
}

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params;
  const book = getBookById(slug);
  if (!book) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-8 sm:px-6 sm:py-10">
        <div className="space-y-2">
          <Link
            href={`/class/${book.class}`}
            className="touch-target inline-flex items-center"
          >
            <Typography variant="link">Class {book.class}</Typography>
          </Link>
          <Typography variant="h1">{book.title}</Typography>
          <Typography variant="bodyMedium">
            Class {book.class} · {book.subject} · English medium
          </Typography>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/books/${book.id}/read`}
            className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 sm:w-auto"
          >
            <Typography variant="button" className="text-[#f7f4ef] dark:text-[#0c0f0e]">
              Read full book
            </Typography>
          </Link>
          <a
            href={book.ncertBookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 sm:w-auto"
          >
            <Typography variant="button">Open on NCERT</Typography>
          </a>
        </div>

        <section className="space-y-3">
          <Typography variant="h2">Sections</Typography>
          <Typography variant="small" className="block">
            Preview opens the full book with continuous page navigation across
            these official chapter PDFs.
          </Typography>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {book.chapters.map((chapter) => (
              <li key={chapter.index} className="list-none px-4 py-3">
                <Typography variant="bodyMedium" className="text-foreground">
                  {chapter.index}. {chapter.title}
                </Typography>
              </li>
            ))}
          </ul>
        </section>

        <NcertAttribution
          ncertBookUrl={book.ncertBookUrl}
          className="border-t border-line pt-6"
        />
      </main>
    </div>
  );
}
