import type { Book, SchoolClass } from "@/lib/types";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

export function isGenericChapterTitle(title: string): boolean {
  const t = title.trim();
  if (/^prelims$/i.test(t)) return true;
  if (/^chapter\s+\d+[a-z]?$/i.test(t)) return true;
  if (/^unit\s+\d+[a-z]?$/i.test(t)) return true;
  return false;
}

export function bookDocumentTitle(book: Book): string {
  return `${book.title} — Class ${book.class} NCERT ${book.subject} | Read chapters online`;
}

export function bookMetaDescription(book: Book): string {
  const chapterLabel =
    book.chapters.length === 1 ? "chapter" : "chapters";
  return `Read ${book.title} online — Class ${book.class} NCERT ${book.subject} (English medium). ${book.chapters.length} ${chapterLabel} from official NCERT PDFs. Preview in your browser; we do not host or redistribute downloads.`;
}

export function bookIntro(book: Book): string {
  const chapterLabel =
    book.chapters.length === 1 ? "chapter" : "chapters";
  return `${book.title} is the Class ${book.class} ${book.subject} NCERT textbook (English medium). This page lists all ${book.chapters.length} ${chapterLabel} with individual chapter pages for search, plus an in-browser reader that streams official NCERT chapter PDFs in order. Textbook files stay on the NCERT portal — this site does not host or redistribute downloadable copies. Prefer “read online” here, or use Open on NCERT for the source listing.`;
}

export function classDocumentTitle(schoolClass: SchoolClass): string {
  return `Class ${schoolClass} NCERT Books English Medium — Read Online (Full List)`;
}

export function classMetaDescription(
  schoolClass: SchoolClass,
  bookCount: number,
  subjects: string[],
): string {
  const subjectPreview = subjects.slice(0, 4).join(", ");
  const more =
    subjects.length > 4 ? `, and ${subjects.length - 4} more subjects` : "";
  return `Browse ${bookCount} English-medium NCERT textbooks for Class ${schoolClass}${
    subjectPreview ? ` — ${subjectPreview}${more}` : ""
  }. Read chapters online from official NCERT PDFs; we do not host downloads.`;
}

export function classIntro(
  schoolClass: SchoolClass,
  bookCount: number,
  subjects: string[],
): string {
  const subjectList =
    subjects.length === 0
      ? "core subjects"
      : subjects.length <= 4
        ? subjects.join(", ")
        : `${subjects.slice(0, 4).join(", ")}, and more`;
  return `Find English-medium NCERT textbooks for Class ${schoolClass} — currently ${bookCount} books across ${subjects.length} subjects (${subjectList}). Open a popular title below for its chapter list, or use search/filters to jump by subject. Every chapter page and the in-browser reader stream official NCERT PDFs; this site does not host downloadable textbook files.`;
}

export type FaqItem = {
  question: string;
  answer: string;
};

export function bookFaqs(book: Book): FaqItem[] {
  return [
    {
      question: `Is ${book.title} the official NCERT Class ${book.class} book?`,
      answer: `Yes. ${book.title} is listed from the NCERT textbook catalog for Class ${book.class} ${book.subject} (English medium). Chapter PDFs are loaded from the official NCERT textbook portal.`,
    },
    {
      question: "Can I download the NCERT PDF from this site?",
      answer:
        "No. This site does not host or redistribute textbook files. You can preview chapters here, or open the official NCERT link on this page to use NCERT’s own portal.",
    },
    {
      question: "How do I read the chapters online?",
      answer: `Use Read book on this page to open the in-browser reader. It loads official chapter PDFs in order so you can move continuously across all ${book.chapters.length} chapters.`,
    },
    {
      question: `What is covered in Class ${book.class} ${book.subject}?`,
      answer: `${book.title} includes ${book.chapters.length} chapters listed in the chapter list on this page. Titles come from the NCERT listing and chapter PDFs where available.`,
    },
  ];
}

export function classFaqs(
  schoolClass: SchoolClass,
  bookCount: number,
  subjects: string[],
): FaqItem[] {
  const subjectPreview =
    subjects.length === 0
      ? "the listed subjects"
      : subjects.slice(0, 5).join(", ") +
        (subjects.length > 5 ? ", and more" : "");
  return [
    {
      question: `Are these the official Class ${schoolClass} NCERT books?`,
      answer: `Yes. This hub lists ${bookCount} English-medium NCERT textbooks for Class ${schoolClass} from the NCERT catalog, covering ${subjectPreview}. Chapter PDFs are streamed from the official NCERT textbook portal.`,
    },
    {
      question: `Can I download Class ${schoolClass} NCERT PDFs here?`,
      answer:
        "No. We do not host or redistribute textbook files. You can read chapters online in the browser reader, or open NCERT’s portal from any book page for their official options.",
    },
    {
      question: `How do I find a specific Class ${schoolClass} subject book?`,
      answer:
        "Use the subject chips or search on this page, open a popular book below, or visit the NCERT book guides for curated lists (for example Class 10 English First Flight & Footprints).",
    },
  ];
}

export function chapterFaqs(
  book: Book,
  chapter: Book["chapters"][number],
): FaqItem[] {
  return [
    {
      question: `Is “${chapter.title}” part of ${book.title}?`,
      answer: `Yes. This page is for “${chapter.title}” in ${book.title}, the Class ${book.class} ${book.subject} NCERT textbook (English medium). ${chapterCatalogSectionLabel(book, chapter)}.`,
    },
    {
      question: "Can I download this chapter PDF from this site?",
      answer:
        "No. We stream the official NCERT chapter PDF for online reading and link to NCERT’s portal. We do not host or redistribute downloadable copies.",
    },
  ];
}

export function bookLinkLabel(book: Book): string {
  return `${book.title} — Class ${book.class} NCERT ${book.subject}`;
}

export function classLinkLabel(schoolClass: SchoolClass): string {
  return `Class ${schoolClass} NCERT English-medium books`;
}

export function buildBookJsonLd(book: Book) {
  const url = absoluteUrl(`/books/${book.id}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `Class ${book.class}`,
            item: absoluteUrl(`/class/${book.class}`),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: book.title,
            item: url,
          },
        ],
      },
      {
        "@type": "Book",
        name: book.title,
        url,
        inLanguage: "en",
        educationalLevel: `Class ${book.class}`,
        about: book.subject,
        publisher: {
          "@type": "Organization",
          name: "NCERT",
          url: "https://ncert.nic.in/",
        },
        isPartOf: {
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl("/"),
        },
        workExample: book.chapters.map((chapter) => ({
          "@type": "Chapter",
          name: chapter.title,
          position: chapter.index,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: bookFaqs(book).map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export function buildClassJsonLd(
  schoolClass: SchoolClass,
  books: Book[],
  subjects: string[],
) {
  const url = absoluteUrl(`/class/${schoolClass}`);
  const faqs = classFaqs(schoolClass, books.length, subjects);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `Class ${schoolClass}`,
            item: url,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: classDocumentTitle(schoolClass),
        description: classMetaDescription(
          schoolClass,
          books.length,
          subjects,
        ),
        url,
        isPartOf: {
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl("/"),
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: books.length,
          itemListElement: books.slice(0, 30).map((book, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(`/books/${book.id}`),
            name: bookLinkLabel(book),
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export function chapterDocumentTitle(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  const readCue = "Read online";
  if (isGenericChapterTitle(chapter.title)) {
    return `${book.title} Class ${book.class} ${chapter.title} — NCERT ${book.subject} | ${readCue}`;
  }
  return `${chapter.title} — ${book.title} Class ${book.class} NCERT | ${readCue}`;
}

/**
 * Catalog `chapter.index` is PDF order (Prelims = 1), not the printed NCERT
 * chapter number. Prefer the title for identity; use “section” for ordinals.
 */
export function chapterCatalogSectionLabel(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  return `Catalog section ${chapter.index} of ${book.chapters.length}`;
}

export function chapterMetaDescription(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  return `Read “${chapter.title}” from ${book.title}, Class ${book.class} NCERT ${book.subject} (English medium). ${chapterCatalogSectionLabel(book, chapter)} — official NCERT PDF preview online; we do not host downloads.`;
}

export function chapterIntro(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  return `“${chapter.title}” is part of ${book.title}, the Class ${book.class} ${book.subject} NCERT textbook (English medium). ${chapterCatalogSectionLabel(book, chapter)} in this catalog (Prelims is usually first; later titles may already say “Chapter N”). Use this page to open the online reader or return to the full book outline. The PDF is streamed from the official NCERT textbook portal — we do not host downloads.`;
}

export function subjectDocumentTitle(
  schoolClass: SchoolClass,
  subject: string,
): string {
  return `Class ${schoolClass} ${subject} NCERT Books (English Medium) — Read Online`;
}

export function subjectMetaDescription(
  schoolClass: SchoolClass,
  subject: string,
  bookCount: number,
): string {
  return `Browse ${bookCount} English-medium NCERT ${subject} textbook${
    bookCount === 1 ? "" : "s"
  } for Class ${schoolClass}. Read chapters online from official NCERT PDFs; we do not host downloads.`;
}

export function subjectIntro(
  schoolClass: SchoolClass,
  subject: string,
  bookCount: number,
): string {
  return `This Class ${schoolClass} ${subject} hub lists ${bookCount} English-medium NCERT textbook${
    bookCount === 1 ? "" : "s"
  }. Open a book for its chapter list and in-browser preview of official NCERT PDFs. This site does not host downloadable copies.`;
}

export function buildChapterJsonLd(
  book: Book,
  chapter: Book["chapters"][number],
) {
  const url = absoluteUrl(`/books/${book.id}/chapter/${chapter.index}`);
  const faqs = chapterFaqs(book, chapter);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `Class ${book.class}`,
            item: absoluteUrl(`/class/${book.class}`),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: book.title,
            item: absoluteUrl(`/books/${book.id}`),
          },
          {
            "@type": "ListItem",
            position: 4,
            name: chapter.title,
            item: url,
          },
        ],
      },
      {
        "@type": "Chapter",
        name: chapter.title,
        position: chapter.index,
        url,
        isPartOf: {
          "@type": "Book",
          name: book.title,
          url: absoluteUrl(`/books/${book.id}`),
        },
        inLanguage: "en",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

export function buildSubjectJsonLd(
  schoolClass: SchoolClass,
  subject: string,
  subjectSlug: string,
  books: Book[],
) {
  const url = absoluteUrl(`/class/${schoolClass}/${subjectSlug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `Class ${schoolClass}`,
            item: absoluteUrl(`/class/${schoolClass}`),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: subject,
            item: url,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: subjectDocumentTitle(schoolClass, subject),
        description: subjectMetaDescription(
          schoolClass,
          subject,
          books.length,
        ),
        url,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: books.length,
          itemListElement: books.map((book, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: absoluteUrl(`/books/${book.id}`),
            name: bookLinkLabel(book),
          })),
        },
      },
    ],
  };
}

export const HOW_TO_READ_STEPS = [
  "Open the book page and scan the chapter list.",
  "Tap Read book to load official NCERT chapter PDFs in the browser reader.",
  "Jump between chapters from the reader controls, or return here for the outline.",
  "Use Open on NCERT if you need the source listing on the official portal.",
] as const;

/** High-impression book IDs to surface first on class hubs (GSC-informed). */
const POPULAR_BOOK_IDS_BY_CLASS: Record<SchoolClass, string[]> = {
  9: [
    "class-9-iekv1",
    "class-9-iest1",
    "class-9-iesc1",
    "class-9-ieeo1",
    "class-9-iemh1",
    "class-9-iebe1",
  ],
  10: [
    "class-10-jeff1",
    "class-10-jefp1",
    "class-10-jehp1",
    "class-10-jesc1",
    "class-10-jess1",
    "class-10-jewe2",
  ],
  11: [
    "class-11-kegy1",
    "class-11-kefa1",
    "class-11-keec1",
    "class-11-kecs1",
    "class-11-kebt1",
  ],
  12: [
    "class-12-lemh1",
    "class-12-lemh2",
    "class-12-lech1",
    "class-12-lebs1",
    "class-12-lebs2",
  ],
};

export function getPopularBooksForClass(
  schoolClass: SchoolClass,
  books: Book[],
  limit = 8,
): Book[] {
  const byId = new Map(books.map((book) => [book.id, book]));
  const prioritized: Book[] = [];
  for (const id of POPULAR_BOOK_IDS_BY_CLASS[schoolClass] ?? []) {
    const book = byId.get(id);
    if (book) prioritized.push(book);
  }
  const remaining = books
    .filter((book) => !prioritized.some((item) => item.id === book.id))
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...prioritized, ...remaining].slice(0, limit);
}

export function guideHrefForClass(schoolClass: SchoolClass): {
  href: string;
  label: string;
} | null {
  switch (schoolClass) {
    case 9:
      return {
        href: "/guides/class-9-kaushal-vikas",
        label: "Kaushal Vikas Class 9 guide",
      };
    case 10:
      return {
        href: "/guides/class-10-ncert-books",
        label: "Class 10 NCERT books guide",
      };
    case 11:
      return {
        href: "/guides/class-11-ncert-books",
        label: "Class 11 NCERT books guide",
      };
    case 12:
      return {
        href: "/guides/class-12-ncert-books",
        label: "Class 12 NCERT books guide",
      };
    default: {
      const _exhaustive: never = schoolClass;
      return _exhaustive;
    }
  }
}
