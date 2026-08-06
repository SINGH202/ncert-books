import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import {
  getBooksByClassAndSubject,
  getSubjectsForClass,
  parseSchoolClass,
  SCHOOL_CLASSES,
} from "@/lib/catalog";

type ClassPageProps = {
  params: Promise<{ class: string }>;
};

export function generateStaticParams() {
  return SCHOOL_CLASSES.map((schoolClass) => ({
    class: String(schoolClass),
  }));
}

export async function generateMetadata({
  params,
}: ClassPageProps): Promise<Metadata> {
  const { class: classParam } = await params;
  const schoolClass = parseSchoolClass(classParam);
  if (!schoolClass) return { title: "Class" };
  return {
    title: `Class ${schoolClass}`,
    description: `Browse English-medium NCERT textbooks for Class ${schoolClass}.`,
  };
}

export default async function ClassPage({ params }: ClassPageProps) {
  const { class: classParam } = await params;
  const schoolClass = parseSchoolClass(classParam);
  if (!schoolClass) notFound();

  const subjects = getSubjectsForClass(schoolClass);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-8 sm:px-6 sm:py-10">
        <div className="space-y-2">
          <Link
            href="/"
            className="touch-target inline-flex items-center"
          >
            <Typography variant="link">All classes</Typography>
          </Link>
          <Typography variant="h1">Class {schoolClass}</Typography>
          <Typography variant="bodyMedium">
            English-medium NCERT textbooks grouped by subject.
          </Typography>
        </div>

        <div className="space-y-8">
          {subjects.map((subject) => {
            const books = getBooksByClassAndSubject(schoolClass, subject);
            return (
              <section key={subject} className="space-y-3">
                <Typography variant="h2">{subject}</Typography>
                <ul className="space-y-2">
                  {books.map((book) => (
                    <li key={book.id} className="list-none">
                      <Link
                        href={`/books/${book.id}`}
                        className="block rounded-xl border border-line bg-surface px-4 py-3.5 transition active:scale-[0.99] sm:py-3"
                      >
                        <Typography variant="h3" className="text-[15px] sm:text-base">
                          {book.title}
                        </Typography>
                        <Typography variant="small" className="mt-1 block">
                          {book.chapters.length} sections · {book.ncertBookCode}
                        </Typography>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <NcertAttribution className="border-t border-line pt-6" />
      </main>
    </div>
  );
}
