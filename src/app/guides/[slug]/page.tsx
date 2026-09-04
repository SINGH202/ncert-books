import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookListItem } from "@/components/book-list-item";
import { JsonLd } from "@/components/json-ld";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import {
  buildGuideJsonLd,
  getGuideBySlug,
  GUIDES,
  resolveGuideBooks,
} from "@/lib/guides";
import { buildPageMetadata } from "@/lib/seo";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: "Guide" };
  return buildPageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();
  const books = resolveGuideBooks(guide);

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={buildGuideJsonLd(guide, books)} />
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
                  href="/guides"
                  className="touch-target inline-flex items-center"
                >
                  <Typography variant="link">Guides</Typography>
                </Link>
              </li>
            </ol>
          </nav>
          <Typography variant="h1">{guide.title}</Typography>
          <Typography variant="bodyMedium" className="max-w-3xl">
            {guide.intro}
          </Typography>
        </div>

        <section className="space-y-3">
          <Typography variant="h2">What this guide covers</Typography>
          <ul className="list-disc space-y-2 pl-5">
            {guide.bullets.map((bullet) => (
              <Typography key={bullet} variant="li">
                {bullet}
              </Typography>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <Typography variant="h2">Books in this guide</Typography>
          <ul className="space-y-2">
            {books.map((book) => (
              <BookListItem key={book.id} book={book} />
            ))}
          </ul>
          <Link href={guide.relatedHref}>
            <Typography variant="link">{guide.relatedLabel}</Typography>
          </Link>
        </section>

        <NcertAttribution className="border-t border-line pt-6" />
      </main>
    </div>
  );
}
