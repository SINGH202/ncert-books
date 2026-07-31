import Link from "next/link";
import { notFound } from "next/navigation";
import { NcertAttribution } from "@/components/ncert-attribution";
import { PdfReader } from "@/components/pdf-reader";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import { getAllBooks, getBookById } from "@/lib/catalog";

type ReadPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllBooks().map((book) => ({ slug: book.id }));
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { slug } = await params;
  const book = getBookById(slug);
  if (!book) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-0 py-0 sm:gap-6 sm:px-6 sm:py-8">
        <div className="space-y-1 px-4 pt-4 sm:px-0 sm:pt-0">
          <Link
            href={`/books/${book.id}`}
            className="touch-target inline-flex items-center"
          >
            <Typography variant="link">Back to book</Typography>
          </Link>
          <Typography variant="h1" className="text-xl sm:text-3xl">
            {book.title}
          </Typography>
          <Typography variant="small" className="block">
            Class {book.class} · {book.subject}
          </Typography>
        </div>

        <div className="flex-1 sm:rounded-xl sm:border sm:border-line sm:bg-surface sm:p-4">
          <PdfReader key={book.id} book={book} />
        </div>

        <NcertAttribution
          ncertBookUrl={book.ncertBookUrl}
          className="border-t border-line px-4 pt-4 pb-[calc(1rem+var(--safe-bottom))] sm:px-0 sm:pt-6 sm:pb-0"
        />
      </main>
    </div>
  );
}
