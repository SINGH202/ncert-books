import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import { getBookById } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo";
import {
  buildChapterJsonLd,
  chapterCatalogSectionLabel,
  chapterDocumentTitle,
  chapterIntro,
  chapterMetaDescription,
} from "@/lib/seo-content";
import { getAllChapterParams, getChapter } from "@/lib/subject-slug";

type ChapterPageProps = {
  params: Promise<{ slug: string; chapter: string }>;
};

export function generateStaticParams() {
  return getAllChapterParams();
}

export async function generateMetadata({
  params,
}: ChapterPageProps): Promise<Metadata> {
  const { slug, chapter: chapterParam } = await params;
  const book = getBookById(slug);
  const chapterIndex = Number(chapterParam);
  const chapter = book ? getChapter(book, chapterIndex) : undefined;
  if (!book || !chapter) return { title: "Chapter not found" };
  return buildPageMetadata({
    title: chapterDocumentTitle(book, chapter),
    description: chapterMetaDescription(book, chapter),
    path: `/books/${book.id}/chapter/${chapter.index}`,
  });
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { slug, chapter: chapterParam } = await params;
  const book = getBookById(slug);
  if (!book) notFound();
  const chapterIndex = Number(chapterParam);
  const chapter = getChapter(book, chapterIndex);
  if (!chapter) notFound();

  const prev = getChapter(book, chapter.index - 1);
  const next = getChapter(book, chapter.index + 1);

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={buildChapterJsonLd(book, chapter)} />
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
                  <Typography variant="link">Class {book.class}</Typography>
                </Link>
              </li>
              <li className="list-none text-muted" aria-hidden>
                /
              </li>
              <li className="list-none">
                <Link
                  href={`/books/${book.id}`}
                  className="touch-target inline-flex items-center"
                >
                  <Typography variant="link">{book.title}</Typography>
                </Link>
              </li>
            </ol>
          </nav>
          <Typography variant="small" className="block">
            {chapterCatalogSectionLabel(book, chapter)} · {book.title} · Class{" "}
            {book.class} {book.subject} · NCERT
          </Typography>
          <Typography variant="h1">{chapter.title}</Typography>
          <Typography variant="bodyMedium" className="max-w-3xl">
            {chapterIntro(book, chapter)}
          </Typography>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/books/${book.id}/read`}
            className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 sm:w-auto"
          >
            <Typography
              variant="button"
              className="text-[#f7f4ef] dark:text-[#0c0f0e]"
            >
              Read this book online
            </Typography>
          </Link>
          <a
            href={chapter.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 sm:w-auto"
          >
            <Typography variant="button">Open chapter on NCERT</Typography>
          </a>
        </div>

        <section className="space-y-3">
          <Typography variant="h2">More chapters in {book.title}</Typography>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {book.chapters.map((item) => (
              <li key={item.index} className="list-none">
                <Link
                  href={`/books/${book.id}/chapter/${item.index}`}
                  className={`flex px-4 py-3 transition hover:bg-background/50 ${
                    item.index === chapter.index ? "bg-background/40" : ""
                  }`}
                >
                  <Typography
                    variant="bodyMedium"
                    className={
                      item.index === chapter.index
                        ? "font-medium text-foreground"
                        : "text-foreground"
                    }
                  >
                    {item.index}. {item.title}
                  </Typography>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-1">
            {prev ? (
              <Link href={`/books/${book.id}/chapter/${prev.index}`}>
                <Typography variant="link">← {prev.title}</Typography>
              </Link>
            ) : null}
            {next ? (
              <Link href={`/books/${book.id}/chapter/${next.index}`}>
                <Typography variant="link">{next.title} →</Typography>
              </Link>
            ) : null}
          </div>
        </section>

        <NcertAttribution
          ncertBookUrl={book.ncertBookUrl}
          className="border-t border-line pt-6"
        />
      </main>
    </div>
  );
}
