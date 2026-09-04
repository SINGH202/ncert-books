import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookListItem } from "@/components/book-list-item";
import { BookReadingActions } from "@/components/book-reading-actions";
import { FaqSection } from "@/components/faq-section";
import { JsonLd } from "@/components/json-ld";
import { NcertAttribution } from "@/components/ncert-attribution";
import { PrefetchBookPdfs } from "@/components/prefetch-book-pdfs";
import { SiteHeader } from "@/components/site-header";
import { TrackEventOnMount } from "@/components/track-event-on-mount";
import { Typography } from "@/components/typography";
import { getAllBooks, getBookById, getRelatedBooks } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo";
import {
  bookDocumentTitle,
  bookFaqs,
  bookIntro,
  bookMetaDescription,
  buildBookJsonLd,
  HOW_TO_READ_STEPS,
} from "@/lib/seo-content";

type BookPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllBooks().map((book) => ({ slug: book.id }));
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = getBookById(slug);
  if (!book) return { title: "Book not found" };
  return buildPageMetadata({
    title: bookDocumentTitle(book),
    description: bookMetaDescription(book),
    path: `/books/${book.id}`,
  });
}

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params;
  const book = getBookById(slug);
  if (!book) notFound();

  const related = getRelatedBooks(book);
  const faqs = bookFaqs(book);

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={buildBookJsonLd(book)} />
      <TrackEventOnMount
        name="book_open"
        props={{
          bookId: book.id,
          class: book.class,
          subject: book.subject,
        }}
      />
      <PrefetchBookPdfs book={book} />
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-8 sm:px-6 sm:py-10">
        <div className="space-y-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <li className="list-none">
                <Link href="/" className="touch-target inline-flex items-center">
                  <Typography variant="link">Home</Typography>
                </Link>
              </li>
              <li className="list-none text-muted" aria-hidden>
                /
              </li>
              <li className="list-none">
                <Link
                  href={`/class/${book.class}`}
                  className="touch-target inline-flex items-center"
                >
                  <Typography variant="link">
                    Class {book.class} NCERT books
                  </Typography>
                </Link>
              </li>
            </ol>
          </nav>
          <Typography variant="h1">{book.title}</Typography>
          <Typography variant="bodyMedium">
            Class {book.class} · {book.subject} · English medium · NCERT
          </Typography>
          <Typography variant="bodyMedium" className="max-w-3xl">
            {bookIntro(book)}
          </Typography>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <BookReadingActions bookId={book.id} />
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
          <Typography variant="h2">How to read this book online</Typography>
          <ol className="list-decimal space-y-2 pl-5">
            {HOW_TO_READ_STEPS.map((step) => (
              <Typography key={step} variant="li">
                {step}
              </Typography>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <Typography variant="h2">
            Chapters in {book.title} (Class {book.class})
          </Typography>
          <Typography variant="small" className="block">
            Each chapter has its own page for search, plus a link into the
            online reader. PDFs come from the official NCERT portal.
          </Typography>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {book.chapters.map((chapter) => (
              <li key={chapter.index} className="list-none">
                <Link
                  href={`/books/${book.id}/chapter/${chapter.index}`}
                  className="flex px-4 py-3 transition hover:bg-background/50"
                >
                  <Typography variant="bodyMedium" className="text-foreground">
                    {chapter.index}. {chapter.title}
                  </Typography>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <FaqSection items={faqs} />

        {related.length > 0 ? (
          <section className="space-y-3">
            <Typography variant="h2">
              Related Class {book.class} NCERT books
            </Typography>
            <Typography variant="small" className="block">
              More English-medium textbooks from the same class
              {related.some((item) => item.subject === book.subject)
                ? `, starting with ${book.subject}`
                : ""}
              .
            </Typography>
            <ul className="space-y-2">
              {related.map((item) => (
                <BookListItem key={item.id} book={item} showClass={false} />
              ))}
            </ul>
          </section>
        ) : null}

        <NcertAttribution
          ncertBookUrl={book.ncertBookUrl}
          className="border-t border-line pt-6"
        />
      </main>
    </div>
  );
}
