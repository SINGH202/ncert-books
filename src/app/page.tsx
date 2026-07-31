import Link from "next/link";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import { getCatalog, SCHOOL_CLASSES } from "@/lib/catalog";

export default function HomePage() {
  const catalog = getCatalog();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-10 sm:px-6 sm:py-10">
        <section className="space-y-3">
          <Typography variant="h1">NCERT Books</Typography>
          <Typography variant="bodyMedium" className="max-w-2xl">
            Browse English-medium NCERT textbooks for Classes 9–12 and preview
            full books in your browser. Content is loaded from the official
            NCERT textbook portal.
          </Typography>
          <Typography variant="small" className="block">
            Catalog synced {new Date(catalog.syncedAt).toLocaleString()} ·{" "}
            {catalog.books.length} books
          </Typography>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          {SCHOOL_CLASSES.map((schoolClass) => (
            <Link
              key={schoolClass}
              href={`/class/${schoolClass}`}
              className="flex min-h-[7.5rem] flex-col justify-between rounded-xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition active:scale-[0.98] sm:min-h-[9rem] sm:p-6"
            >
              <Typography variant="h2" className="text-lg sm:text-2xl">
                Class {schoolClass}
              </Typography>
              <Typography variant="small" className="mt-3 block">
                {
                  catalog.books.filter((book) => book.class === schoolClass)
                    .length
                }{" "}
                books
              </Typography>
            </Link>
          ))}
        </section>

        <NcertAttribution className="border-t border-line pt-6" />
      </main>
    </div>
  );
}
