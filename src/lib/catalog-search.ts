import type { Book, SchoolClass } from "@/lib/types";

export type CatalogFilter = {
  query: string;
  schoolClass?: SchoolClass | "all";
  subject?: string | "all";
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function filterBooks(books: Book[], filter: CatalogFilter): Book[] {
  const query = normalize(filter.query);
  const schoolClass = filter.schoolClass ?? "all";
  const subject = filter.subject ?? "all";

  return books.filter((book) => {
    if (schoolClass !== "all" && book.class !== schoolClass) return false;
    if (subject !== "all" && book.subject !== subject) return false;
    if (!query) return true;

    const haystack = normalize(
      `${book.title} ${book.subject} ${book.ncertBookCode}`,
    );
    return haystack.includes(query);
  });
}

export function groupBooksByClass(books: Book[]): Array<{
  schoolClass: SchoolClass;
  books: Book[];
}> {
  const byClass = new Map<SchoolClass, Book[]>();
  for (const book of books) {
    const list = byClass.get(book.class) ?? [];
    list.push(book);
    byClass.set(book.class, list);
  }

  return ([9, 10, 11, 12] as SchoolClass[])
    .map((schoolClass) => ({
      schoolClass,
      books: (byClass.get(schoolClass) ?? []).slice().sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    }))
    .filter((group) => group.books.length > 0);
}

export function groupBooksBySubject(books: Book[]): Array<{
  subject: string;
  books: Book[];
}> {
  const bySubject = new Map<string, Book[]>();
  for (const book of books) {
    const list = bySubject.get(book.subject) ?? [];
    list.push(book);
    bySubject.set(book.subject, list);
  }

  return [...bySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subject, subjectBooks]) => ({
      subject,
      books: subjectBooks
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title)),
    }));
}
