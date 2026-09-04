import catalogJson from "../../data/catalog.json";
import type { Book, Catalog, SchoolClass } from "./types";

const catalog = catalogJson as Catalog;

export const SCHOOL_CLASSES: SchoolClass[] = [9, 10, 11, 12];

export function getCatalog(): Catalog {
  return catalog;
}

export function getAllBooks(): Book[] {
  return catalog.books;
}

export function getBookById(id: string): Book | undefined {
  return catalog.books.find((book) => book.id === id);
}

export function getBooksByClass(schoolClass: SchoolClass): Book[] {
  return catalog.books.filter((book) => book.class === schoolClass);
}

export function getSubjectsForClass(schoolClass: SchoolClass): string[] {
  const subjects = new Set(
    getBooksByClass(schoolClass).map((book) => book.subject),
  );
  return [...subjects].sort((a, b) => a.localeCompare(b));
}

export function getBooksByClassAndSubject(
  schoolClass: SchoolClass,
  subject: string,
): Book[] {
  return getBooksByClass(schoolClass)
    .filter((book) => book.subject === subject)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function isSchoolClass(value: string): value is `${SchoolClass}` {
  return SCHOOL_CLASSES.includes(Number(value) as SchoolClass);
}

export function parseSchoolClass(value: string): SchoolClass | null {
  if (!isSchoolClass(value)) return null;
  return Number(value) as SchoolClass;
}

/** Same class + subject first, then other books in the same class. */
export function getRelatedBooks(book: Book, limit = 6): Book[] {
  const sameClass = getBooksByClass(book.class).filter((item) => item.id !== book.id);
  const sameSubject = sameClass.filter((item) => item.subject === book.subject);
  const otherSubject = sameClass.filter((item) => item.subject !== book.subject);
  return [...sameSubject, ...otherSubject].slice(0, limit);
}
