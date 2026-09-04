import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import { GUIDES } from "@/lib/guides";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "NCERT Book Guides — Class Lists & Subjects",
  description:
    "Guides to Class 9–12 NCERT English-medium textbooks: Class 10 book lists, English First Flight & Footprints, and Physical Education.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-8 sm:px-6 sm:py-10">
        <div className="space-y-3">
          <Link href="/" className="touch-target inline-flex items-center">
            <Typography variant="link">Home</Typography>
          </Link>
          <Typography variant="h1">NCERT book guides</Typography>
          <Typography variant="bodyMedium" className="max-w-3xl">
            Short guides for common Class 9–12 NCERT searches. Each guide links
            into catalog book pages where you can read chapters online from
            official NCERT PDFs.
          </Typography>
        </div>
        <ul className="space-y-3">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="list-none">
              <Link
                href={`/guides/${guide.slug}`}
                className="block rounded-xl border border-line bg-surface px-4 py-4 transition hover:border-accent/35"
              >
                <Typography variant="h3" className="text-base sm:text-lg">
                  {guide.title}
                </Typography>
                <Typography variant="small" className="mt-2 block">
                  {guide.description}
                </Typography>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
