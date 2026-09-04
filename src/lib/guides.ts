import { getBookById, getBooksByClass } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";
import type { Book } from "@/lib/types";

export type GuideDefinition = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  bullets: string[];
  bookIds: string[];
  relatedHref: string;
  relatedLabel: string;
};

export const GUIDES: GuideDefinition[] = [
  {
    slug: "class-10-ncert-books",
    title: "Class 10 NCERT Books (English Medium) — Full List",
    description:
      "Browse Class 10 NCERT English-medium textbooks by subject and read chapters online from official NCERT PDFs.",
    intro:
      "Class 10 students often search for the full NCERT book list before exams. This guide links every English-medium Class 10 title in our catalog so you can open chapter outlines and preview official PDFs in the browser — without download mirrors.",
    bullets: [
      "Covers English, Science, Mathematics, Social Science, and Health & Physical Education books in the catalog.",
      "Each book page lists chapters and opens the online reader.",
      "PDFs remain on the NCERT portal; this site only streams allowlisted URLs.",
    ],
    bookIds: [],
    relatedHref: "/class/10",
    relatedLabel: "Class 10 NCERT hub",
  },
  {
    slug: "class-10-english-ncert-books",
    title: "Class 10 English NCERT Books — First Flight & Footprints",
    description:
      "Find Class 10 NCERT English textbooks (First Flight, Footprints Without Feet, and related titles) and read chapters online.",
    intro:
      "Queries like “First Flight Class 10” and “Footprints Without Feet PDF” map to the Class 10 English NCERT set. Use the links below for chapter lists and online preview of official NCERT files.",
    bullets: [
      "First Flight is the main Class 10 English textbook.",
      "Footprints Without Feet is the supplementary reader.",
      "Words and Expressions 2 is the workbook companion when listed in the catalog.",
    ],
    bookIds: ["class-10-jeff1", "class-10-jefp1", "class-10-jewe2"],
    relatedHref: "/class/10/english",
    relatedLabel: "Class 10 English subject hub",
  },
  {
    slug: "class-10-physical-education-ncert",
    title: "Class 10 Health and Physical Education NCERT Book",
    description:
      "Open the Class 10 NCERT Health and Physical Education textbook online with chapter list and official PDF preview.",
    intro:
      "Many searches ask for the Class 10 physical education / health book PDF. Here is the catalog entry with chapters and an honest path to read online from NCERT’s portal — not a hosted download.",
    bullets: [
      "Use the book page for the full chapter outline.",
      "Read online in the browser reader.",
      "Prefer NCERT’s site if you need their download options.",
    ],
    bookIds: ["class-10-jehp1"],
    relatedHref: "/class/10/health-and-physical-education",
    relatedLabel: "Class 10 Health and Physical Education hub",
  },
];

export function getGuideBySlug(slug: string): GuideDefinition | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function resolveGuideBooks(guide: GuideDefinition): Book[] {
  if (guide.slug === "class-10-ncert-books") {
    return getBooksByClass(10)
      .slice()
      .sort((a, b) => {
        const subjectCmp = a.subject.localeCompare(b.subject);
        if (subjectCmp !== 0) return subjectCmp;
        return a.title.localeCompare(b.title);
      });
  }

  return guide.bookIds
    .map((id) => getBookById(id))
    .filter((book): book is Book => Boolean(book));
}

export function buildGuideJsonLd(guide: GuideDefinition, books: Book[]) {
  const url = absoluteUrl(`/guides/${guide.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url,
    about: books.map((book) => ({
      "@type": "Book",
      name: book.title,
      url: absoluteUrl(`/books/${book.id}`),
    })),
  };
}
