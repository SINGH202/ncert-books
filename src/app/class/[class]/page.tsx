import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassBookBrowser } from "@/components/class-book-browser";
import { NcertAttribution } from "@/components/ncert-attribution";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";
import {
  getBooksByClass,
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
  const books = getBooksByClass(schoolClass);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-[calc(1.5rem+var(--safe-bottom))] sm:gap-8 sm:px-6 sm:py-10">
        <div className="space-y-2">
          <Link href="/" className="touch-target inline-flex items-center">
            <Typography variant="link">All classes</Typography>
          </Link>
          <Typography variant="h1">Class {schoolClass}</Typography>
          <Typography variant="bodyMedium">
            English-medium NCERT textbooks grouped by subject.
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
