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
    slug: "class-9-kaushal-vikas",
    title: "Kaushal Vikas Class 9 NCERT — Skill Education Chapters",
    description:
      "Read Kaushal Vikas Class 9 NCERT Skill Education chapters online from official NCERT PDFs. Chapter list and browser preview — we do not host downloads.",
    intro:
      "Students searching for “Kaushal Vikas chapter 1” and related Class 9 Skill Education queries need clear chapter pages and an honest read-online path. This guide links the full Kaushal Vikas book so you can open each chapter and preview official NCERT PDFs in the browser.",
    bullets: [
      "Kaushal Vikas is the Class 9 Skill Education NCERT textbook (English medium).",
      "Each chapter has its own URL for search, plus the continuous online reader.",
      "PDFs remain on the NCERT portal; this site only streams allowlisted URLs.",
    ],
    bookIds: ["class-9-iekv1"],
    relatedHref: "/books/class-9-iekv1",
    relatedLabel: "Kaushal Vikas book page",
  },
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
      "Queries like “First Flight Class 10” and “Footprints Without Feet PDF” map to the Class 10 English NCERT set. Use the links below for chapter lists and online preview of official NCERT files — we do not host downloads.",
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
  {
    slug: "class-11-ncert-books",
    title: "Class 11 NCERT Books (English Medium) — Full List",
    description:
      "Browse Class 11 NCERT English-medium textbooks and read chapters online from official NCERT PDFs.",
    intro:
      "Class 11 searches often start with a full book list or subject hubs such as Geography. This guide links every English-medium Class 11 title in our catalog for chapter outlines and online preview — without download mirrors.",
    bullets: [
      "Includes Science, Mathematics, Commerce, Humanities, and Geography titles in the catalog.",
      "Open India Physical Environment and other high-interest books for chapter pages.",
      "PDFs remain on the NCERT portal; this site only streams allowlisted URLs.",
    ],
    bookIds: [],
    relatedHref: "/class/11",
    relatedLabel: "Class 11 NCERT hub",
  },
  {
    slug: "class-12-ncert-books",
    title: "Class 12 NCERT Books (English Medium) — Full List",
    description:
      "Browse Class 12 NCERT English-medium textbooks and read chapters online from official NCERT PDFs.",
    intro:
      "Class 12 students often look for the complete NCERT set before board exams. Use this guide to open every English-medium Class 12 book in the catalog, then read chapters online from official NCERT PDFs.",
    bullets: [
      "Covers Mathematics, Sciences, Commerce, and Humanities titles listed in the catalog.",
      "Each book page lists chapters and opens the online reader.",
      "We do not host or redistribute downloadable textbook files.",
    ],
    bookIds: [],
    relatedHref: "/class/12",
    relatedLabel: "Class 12 NCERT hub",
  },
  {
    slug: "class-12-mathematics-ncert",
    title: "Class 12 Mathematics NCERT Books — Part I & Part II",
    description:
      "Read Class 12 NCERT Mathematics Part-I and Part-II online with chapter lists and official NCERT PDF preview.",
    intro:
      "Searches for Class 12 Maths NCERT often land on Part-I first. This guide links Mathematics Part-I and Part-II so you can open chapter pages and read online from official NCERT PDFs — not a hosted download mirror.",
    bullets: [
      "Mathematics Part-I and Part-II are the core Class 12 NCERT maths textbooks.",
      "Use each book page for the chapter outline and continuous reader.",
      "Prefer NCERT’s portal when you need their official download options.",
    ],
    bookIds: ["class-12-lemh1", "class-12-lemh2"],
    relatedHref: "/class/12/mathematics",
    relatedLabel: "Class 12 Mathematics hub",
  },
];

export function getGuideBySlug(slug: string): GuideDefinition | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function resolveGuideBooks(guide: GuideDefinition): Book[] {
  if (guide.slug === "class-10-ncert-books") {
    return sortBooksBySubjectThenTitle(getBooksByClass(10));
  }
  if (guide.slug === "class-11-ncert-books") {
    return sortBooksBySubjectThenTitle(getBooksByClass(11));
  }
  if (guide.slug === "class-12-ncert-books") {
    return sortBooksBySubjectThenTitle(getBooksByClass(12));
  }

  return guide.bookIds
    .map((id) => getBookById(id))
    .filter((book): book is Book => Boolean(book));
}

function sortBooksBySubjectThenTitle(books: Book[]): Book[] {
  return books.slice().sort((a, b) => {
    const subjectCmp = a.subject.localeCompare(b.subject);
    if (subjectCmp !== 0) return subjectCmp;
    return a.title.localeCompare(b.title);
  });
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
