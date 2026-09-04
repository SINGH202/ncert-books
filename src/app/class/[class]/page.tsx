import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassBookBrowser } from "@/components/class-book-browser";
import { JsonLd } from "@/components/json-ld";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import {
  getBooksByClass,
  getSubjectsForClass,
  parseSchoolClass,
  SCHOOL_CLASSES,
} from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo";
import {
  buildClassJsonLd,
  classDocumentTitle,
  classIntro,
  classMetaDescription,
} from "@/lib/seo-content";
import { subjectToSlug } from "@/lib/subject-slug";

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
  const subjects = getSubjectsForClass(schoolClass);
  const books = getBooksByClass(schoolClass);
  return buildPageMetadata({
    title: classDocumentTitle(schoolClass),
    description: classMetaDescription(
      schoolClass,
      books.length,
      subjects,
    ),
    path: `/class/${schoolClass}`,
  });
}

export default async function ClassPage({ params }: ClassPageProps) {
  const { class: classParam } = await params;
  const schoolClass = parseSchoolClass(classParam);
  if (!schoolClass) notFound();

  const subjects = getSubjectsForClass(schoolClass);
  const books = getBooksByClass(schoolClass);

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={buildClassJsonLd(schoolClass, books, subjects)} />
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
                <Typography variant="small" className="text-foreground">
                  Class {schoolClass}
                </Typography>
              </li>
            </ol>
          </nav>
          <Typography variant="h1">
            Class {schoolClass} NCERT Books (English Medium)
          </Typography>
          <Typography variant="bodyMedium" className="max-w-3xl">
            {classIntro(schoolClass, books.length, subjects)}
          </Typography>
          <div className="flex flex-wrap gap-2 pt-1">
            {subjects.map((subject) => (
              <Link
                key={subject}
                href={`/class/${schoolClass}/${subjectToSlug(subject)}`}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 transition hover:border-accent/35"
              >
                <Typography variant="small" className="text-foreground">
                  {subject}
                </Typography>
              </Link>
            ))}
          </div>
          <Typography variant="small" className="block">
            Also see{" "}
            <Link href="/guides" className="underline-offset-4 hover:underline">
              NCERT book guides
            </Link>{" "}
            for Class 10 lists and popular subjects.
          </Typography>
        </div>

        <ClassBookBrowser
          schoolClass={schoolClass}
          books={books}
          subjects={subjects}
        />

        <NcertAttribution className="border-t border-line pt-6" />
      </main>
    </div>
  );
}
