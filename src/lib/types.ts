export type SchoolClass = 9 | 10 | 11 | 12;

export type FitMode = "width" | "page";

export type Chapter = {
  index: number;
  title: string;
  pdfUrl: string;
};

export type Book = {
  id: string;
  class: SchoolClass;
  subject: string;
  title: string;
  ncertBookCode: string;
  ncertBookUrl: string;
  chapters: Chapter[];
};

export type Catalog = {
  syncedAt: string;
  language: "en";
  books: Book[];
};
