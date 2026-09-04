import type { Book, SchoolClass } from "@/lib/types";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

export function bookDocumentTitle(book: Book): string {
  return `${book.title} — Class ${book.class} NCERT ${book.subject}`;
}

export function bookMetaDescription(book: Book): string {
  const chapterLabel =
    book.chapters.length === 1 ? "chapter" : "chapters";
  return `Read ${book.title} online — Class ${book.class} NCERT ${book.subject} (English medium). ${book.chapters.length} ${chapterLabel} from official NCERT PDFs. Preview in your browser; we do not host downloads.`;
}

export function bookIntro(book: Book): string {
  const chapterLabel =
    book.chapters.length === 1 ? "chapter" : "chapters";
  return `${book.title} is the Class ${book.class} ${book.subject} NCERT textbook (English medium). This page lists all ${book.chapters.length} ${chapterLabel} and lets you preview the official NCERT chapter PDFs in your browser with continuous page navigation. Textbook files remain on the NCERT portal — this site does not host or redistribute downloadable copies.`;
}

export function classDocumentTitle(schoolClass: SchoolClass): string {
  return `Class ${schoolClass} NCERT Books (English Medium)`;
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
  }. Read chapters online from official NCERT PDFs.`;
}

export function classIntro(
  schoolClass: SchoolClass,
  bookCount: number,
  subjects: string[],
): string {
  return `Find English-medium NCERT textbooks for Class ${schoolClass}. This catalog currently lists ${bookCount} books across ${subjects.length} subjects. Open any book to preview official chapter PDFs in your browser, or jump to the NCERT textbook portal for the source files.`;
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
            name: book.title,
          })),
        },
      },
    ],
  };
}

export function chapterDocumentTitle(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  return `${chapter.title} — ${book.title} Class ${book.class} NCERT`;
}

export function chapterMetaDescription(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  return `Read “${chapter.title}” (Chapter ${chapter.index}) from ${book.title}, Class ${book.class} NCERT ${book.subject} (English medium). Preview the official NCERT chapter PDF online — we do not host downloads.`;
}

export function chapterIntro(
  book: Book,
  chapter: Book["chapters"][number],
): string {
  return `“${chapter.title}” is Chapter ${chapter.index} of ${book.title}, the Class ${book.class} ${book.subject} NCERT textbook (English medium). Use this page to open the chapter in our online reader or return to the full book outline. The PDF is streamed from the official NCERT textbook portal.`;
}

export function subjectDocumentTitle(
  schoolClass: SchoolClass,
  subject: string,
): string {
  return `Class ${schoolClass} ${subject} NCERT Books (English Medium)`;
}

export function subjectMetaDescription(
  schoolClass: SchoolClass,
  subject: string,
  bookCount: number,
): string {
  return `Browse ${bookCount} English-medium NCERT ${subject} textbook${
    bookCount === 1 ? "" : "s"
  } for Class ${schoolClass}. Read chapters online from official NCERT PDFs.`;
}

export function subjectIntro(
  schoolClass: SchoolClass,
  subject: string,
  bookCount: number,
): string {
  return `This Class ${schoolClass} ${subject} hub lists ${bookCount} English-medium NCERT textbook${
    bookCount === 1 ? "" : "s"
  }. Open a book for its chapter list and in-browser preview of official NCERT PDFs.`;
}

export function buildChapterJsonLd(
  book: Book,
  chapter: Book["chapters"][number],
) {
  const url = absoluteUrl(`/books/${book.id}/chapter/${chapter.index}`);
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
            name: book.title,
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
