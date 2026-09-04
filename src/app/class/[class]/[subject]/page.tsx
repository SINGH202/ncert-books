import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookListItem } from "@/components/book-list-item";
import { JsonLd } from "@/components/json-ld";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import { parseSchoolClass } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo";
import {
  buildSubjectJsonLd,
  subjectDocumentTitle,
  subjectIntro,
  subjectMetaDescription,
} from "@/lib/seo-content";
import {
  findSubjectForSlug,
  getAllClassSubjectParams,
  getBooksByClassAndSubject,
} from "@/lib/subject-slug";

type SubjectPageProps = {
  params: Promise<{ class: string; subject: string }>;
};

export function generateStaticParams() {
  return getAllClassSubjectParams();
}

export async function generateMetadata({
  params,
}: SubjectPageProps): Promise<Metadata> {
  const { class: classParam, subject: subjectSlug } = await params;
  const schoolClass = parseSchoolClass(classParam);
  if (!schoolClass) return { title: "Subject" };
  const subject = findSubjectForSlug(schoolClass, subjectSlug);
  if (!subject) return { title: "Subject" };
  const books = getBooksByClassAndSubject(schoolClass, subject);
  return buildPageMetadata({
    title: subjectDocumentTitle(schoolClass, subject),
    description: subjectMetaDescription(schoolClass, subject, books.length),
    path: `/class/${schoolClass}/${subjectSlug}`,
  });
}

export default async function SubjectPage({ params }: SubjectPageProps) {
  const { class: classParam, subject: subjectSlug } = await params;
  const schoolClass = parseSchoolClass(classParam);
  if (!schoolClass) notFound();
  const subject = findSubjectForSlug(schoolClass, subjectSlug);
  if (!subject) notFound();
  const books = getBooksByClassAndSubject(schoolClass, subject);

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd
        data={buildSubjectJsonLd(schoolClass, subject, subjectSlug, books)}
      />
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
                  href={`/class/${schoolClass}`}
                  className="touch-target inline-flex items-center"
                >
                  <Typography variant="link">Class {schoolClass}</Typography>
                </Link>
              </li>
              <li className="list-none text-muted" aria-hidden>
                /
              </li>
              <li className="list-none">
                <Typography variant="small" className="text-foreground">
                  {subject}
                </Typography>
              </li>
            </ol>
          </nav>
          <Typography variant="h1">
            Class {schoolClass} {subject} NCERT Books
          </Typography>
          <Typography variant="bodyMedium" className="max-w-3xl">
            {subjectIntro(schoolClass, subject, books.length)}
          </Typography>
        </div>

        <section className="space-y-3">
          <Typography variant="h2">
            {books.length} textbook{books.length === 1 ? "" : "s"}
          </Typography>
          <ul className="space-y-2">
            {books.map((book) => (
              <BookListItem key={book.id} book={book} showClass={false} />
            ))}
          </ul>
        </section>

        <NcertAttribution className="border-t border-line pt-6" />
      </main>
    </div>
  );
}
