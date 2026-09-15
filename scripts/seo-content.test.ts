import assert from "node:assert/strict";
import {
  bookDocumentTitle,
  chapterDocumentTitle,
  chapterFaqs,
  classDocumentTitle,
  classFaqs,
  isGenericChapterTitle,
} from "../src/lib/seo-content";
import type { Book } from "../src/lib/types";

const iekv1 = {
  id: "class-9-iekv1",
  title: "Kaushal Vikas",
  class: 9 as const,
  subject: "Skill Education",
  ncertBookCode: "iekv1",
  ncertBookUrl: "https://ncert.nic.in/",
  chapters: [
    { index: 1, title: "Prelims", pdfUrl: "https://ncert.nic.in/x.pdf" },
    { index: 2, title: "Chapter 1", pdfUrl: "https://ncert.nic.in/y.pdf" },
    {
      index: 3,
      title: "Communication Skills",
      pdfUrl: "https://ncert.nic.in/z.pdf",
    },
  ],
} satisfies Book;

assert.equal(isGenericChapterTitle("Chapter 1"), true);
assert.equal(isGenericChapterTitle("Prelims"), true);
assert.equal(isGenericChapterTitle("Communication Skills"), false);

const genericTitle = chapterDocumentTitle(iekv1, iekv1.chapters[1]);
assert.match(genericTitle, /Kaushal Vikas/i);
assert.match(genericTitle, /Class 9/i);
assert.match(genericTitle, /read online/i);

const realTitle = chapterDocumentTitle(iekv1, iekv1.chapters[2]);
assert.match(realTitle, /Communication Skills/);
assert.match(realTitle, /Kaushal Vikas/);

assert.match(bookDocumentTitle(iekv1), /Read/i);
assert.match(classDocumentTitle(10), /Class 10/);
assert.match(classDocumentTitle(10), /Read Online|English Medium/i);

const faqs = classFaqs(10, 20, ["English", "Science"]);
assert.ok(faqs.length >= 3);
assert.ok(faqs.some((f) => /download/i.test(f.question)));

const chapterFaq = chapterFaqs(iekv1, iekv1.chapters[1]);
assert.ok(chapterFaq.length >= 2);
assert.ok(chapterFaq.some((f) => /download/i.test(f.question)));

console.log("seo-content tests passed");
