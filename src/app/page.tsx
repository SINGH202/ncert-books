import { HomeCatalogBrowser } from "@/components/home-catalog-browser";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { getCatalog, SCHOOL_CLASSES } from "@/lib/catalog";
import type { SchoolClass } from "@/lib/types";

export default function HomePage() {
  const catalog = getCatalog();
  const classCounts = SCHOOL_CLASSES.reduce(
    (acc, schoolClass) => {
      acc[schoolClass] = catalog.books.filter(
        (book) => book.class === schoolClass,
      ).length;
      return acc;
    },
    {} as Record<SchoolClass, number>,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-10 sm:px-6 sm:py-10">
        <HomeCatalogBrowser
          books={catalog.books}
          syncedAt={catalog.syncedAt}
          classCounts={classCounts}
        />
        <NcertAttribution className="border-t border-line pt-6" />
      </main>
    </div>
  );
}
