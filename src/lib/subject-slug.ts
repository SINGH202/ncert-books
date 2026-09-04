import {
  getAllBooks,
  getBooksByClassAndSubject,
  getSubjectsForClass,
  SCHOOL_CLASSES,
} from "@/lib/catalog";
import type { Book, SchoolClass } from "@/lib/types";

export function subjectToSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findSubjectForSlug(
  schoolClass: SchoolClass,
  slug: string,
): string | null {
  const match = getSubjectsForClass(schoolClass).find(
    (subject) => subjectToSlug(subject) === slug,
  );
  return match ?? null;
}

export function getAllClassSubjectParams(): Array<{
  class: string;
  subject: string;
}> {
  const params: Array<{ class: string; subject: string }> = [];
  for (const schoolClass of SCHOOL_CLASSES) {
    for (const subject of getSubjectsForClass(schoolClass)) {
      params.push({
        class: String(schoolClass),
        subject: subjectToSlug(subject),
      });
    }
  }
  return params;
}

export function getAllChapterParams(): Array<{
  slug: string;
  chapter: string;
}> {
  const params: Array<{ slug: string; chapter: string }> = [];
  for (const book of getAllBooks()) {
    for (const chapter of book.chapters) {
      params.push({ slug: book.id, chapter: String(chapter.index) });
    }
  }
  return params;
}

export function getChapter(
  book: Book,
  chapterIndex: number,
): Book["chapters"][number] | undefined {
  return book.chapters.find((chapter) => chapter.index === chapterIndex);
}

export { getBooksByClassAndSubject };
