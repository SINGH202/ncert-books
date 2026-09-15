# GSC SEO Conversion Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Search CTR and conversion via query-shaped metadata, richer class/book/chapter copy, new guides, and priority chapter-title extraction — without custom domain or URL renames.

**Architecture:** Centralize SERP/copy changes in `src/lib/seo-content.ts`; wire FAQs/popular books on class pages; extend `src/lib/guides.ts`; add `TITLE_BOOK_CODES` filter to `scripts/apply-chapter-titles.ts` and sync priority books into `data/`.

**Tech Stack:** Next.js App Router, TypeScript, existing catalog/JSON-LD helpers, `tsx` catalog scripts, pdf.js title extraction.

## Global Constraints

- No custom domain / `SITE_URL` changes
- No book URL slug renames or redirects
- No hosted PDF downloads; copy must stay PDF-honest (“read online” / official NCERT)
- Do not invent printed chapter numbers from catalog `index` (Prelims = 1)
- Priority title codes only: `iekv1,iest1,ieeo1,jeff1,jefp1,jehp1,lemh1,kegy1`
- Prefer Typography component for visible text; keep existing layout patterns

---

### Task 1: SEO content helpers + unit tests

**Files:**
- Create: `scripts/seo-content.test.ts`
- Modify: `src/lib/seo-content.ts`
- Modify: `package.json` (add `test:seo-content` script)

**Interfaces:**
- Produces:
  - `isGenericChapterTitle(title: string): boolean`
  - `chapterDocumentTitle(book, chapter): string` (query-shaped)
  - `bookDocumentTitle(book): string` (adds read-online cue)
  - `classDocumentTitle(schoolClass): string`
  - updated meta/intro helpers
  - `classFaqs(schoolClass, bookCount, subjects): FaqItem[]`
  - `chapterFaqs(book, chapter): FaqItem[]`
  - `buildClassJsonLd` includes FAQPage when faqs present

- [x] **Step 1: Write failing tests**
- [x] **Step 2: Run tests — expect FAIL**
- [x] **Step 3: Implement helpers in `src/lib/seo-content.ts`**
- [x] **Step 4: Re-run tests — expect PASS**
- [ ] **Step 5: Commit** (only if user requested commits; otherwise skip)

```ts
// scripts/seo-content.test.ts
import assert from "node:assert/strict";
import {
  bookDocumentTitle,
  chapterDocumentTitle,
  classDocumentTitle,
  classFaqs,
  isGenericChapterTitle,
} from "../src/lib/seo-content";
import type { Book } from "../src/lib/types";

const iekv1 = {
  id: "class-9-iekv1",
  title: "Kaushal Vikas",
  class: 9,
  subject: "Skill Education",
  medium: "English",
  ncertBookCode: "iekv1",
  ncertBookUrl: "https://ncert.nic.in/",
  chapters: [
    { index: 1, title: "Prelims", pdfUrl: "https://ncert.nic.in/x.pdf" },
    { index: 2, title: "Chapter 1", pdfUrl: "https://ncert.nic.in/y.pdf" },
    { index: 3, title: "Communication Skills", pdfUrl: "https://ncert.nic.in/z.pdf" },
  ],
} as Book;

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

console.log("seo-content tests passed");
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx tsx scripts/seo-content.test.ts`  
Expected: FAIL (missing exports / assertion mismatches)

- [ ] **Step 3: Implement helpers in `src/lib/seo-content.ts`**

```ts
export function isGenericChapterTitle(title: string): boolean {
  const t = title.trim();
  if (/^prelims$/i.test(t)) return true;
  if (/^chapter\s+\d+[a-z]?$/i.test(t)) return true;
  if (/^unit\s+\d+[a-z]?$/i.test(t)) return true;
  return false;
}

export function chapterDocumentTitle(book: Book, chapter: Book["chapters"][number]): string {
  const readCue = "Read online";
  if (isGenericChapterTitle(chapter.title)) {
    return `${book.title} Class ${book.class} ${chapter.title} — NCERT ${book.subject} | ${readCue}`;
  }
  return `${chapter.title} — ${book.title} Class ${book.class} NCERT | ${readCue}`;
}

export function bookDocumentTitle(book: Book): string {
  return `${book.title} — Class ${book.class} NCERT ${book.subject} | Read chapters online`;
}

export function classDocumentTitle(schoolClass: SchoolClass): string {
  return `Class ${schoolClass} NCERT Books English Medium — Read Online (Full List)`;
}
```

Also update `bookMetaDescription`, `chapterMetaDescription`, `classMetaDescription`, intros to stress official NCERT PDF preview / no hosted downloads. Add `classFaqs` and `chapterFaqs`. Extend `buildClassJsonLd` with FAQPage `mainEntity` from `classFaqs`.

- [ ] **Step 4: Re-run tests — expect PASS**

Run: `npx tsx scripts/seo-content.test.ts`  
Add `"test:seo-content": "tsx scripts/seo-content.test.ts"` to `package.json`.

- [ ] **Step 5: Commit** (only if user requested commits; otherwise skip)

---

### Task 2: Wire class hub UI (popular books + FAQs)

**Files:**
- Modify: `src/app/class/[class]/page.tsx`
- Modify: `src/components/book-list-item.tsx` (optional `denseLabel` / show full `bookLinkLabel` as title)

**Interfaces:**
- Consumes: `classFaqs`, `bookLinkLabel`, `classIntro` from seo-content
- Produces: SSR popular books section + FaqSection on class pages

- [ ] **Step 1: Update class page**

Import `FaqSection`, `classFaqs`, `bookLinkLabel`. After intro/subject chips, before `ClassBookBrowser`:

```tsx
<section className="space-y-3">
  <Typography variant="h2">Popular Class {schoolClass} NCERT books</Typography>
  <ul className="space-y-2">
    {books.slice(0, 8).map((book) => (
      <BookListItem key={book.id} book={book} showClass={false} emphasizeSeoLabel />
    ))}
  </ul>
</section>
...
<FaqSection items={classFaqs(schoolClass, books.length, subjects)} />
```

Sort popular list: prefer known high-impr IDs for that class when present, else title sort — implement small helper `getPopularBooksForClass(schoolClass, books)` in `src/lib/catalog.ts` or inline priority IDs map in the page file.

- [ ] **Step 2: BookListItem visible SEO label**

When `emphasizeSeoLabel` is true, render `bookLinkLabel(book)` as the visible h3 text (instead of bare `book.title`).

- [ ] **Step 3: Smoke-check** — `npx tsc --noEmit` or `npm run build` later in Task 5.

---

### Task 3: Chapter page FAQ + supporting line

**Files:**
- Modify: `src/app/books/[slug]/chapter/[chapter]/page.tsx`

- [ ] **Step 1: Add supporting line under H1**

```tsx
<Typography variant="bodyMedium">
  {book.title} · Class {book.class} {book.subject} · NCERT · Read online
</Typography>
```

- [ ] **Step 2: Render `<FaqSection items={chapterFaqs(book, chapter)} />` before attribution**

- [ ] **Step 3: Align primary CTA label to “Read this chapter online”** (link can still go to book reader if chapter-deep link unsupported — keep `/books/{id}/read` but clarify copy). Prefer linking reader if chapter deep-link exists; otherwise keep current href.

---

### Task 4: Guides

**Files:**
- Modify: `src/lib/guides.ts`

- [ ] **Step 1: Append guides**

```ts
{
  slug: "class-9-kaushal-vikas",
  title: "Kaushal Vikas Class 9 NCERT — Skill Education Chapters",
  description: "Read Kaushal Vikas Class 9 NCERT Skill Education chapters online from official NCERT PDFs.",
  intro: "...",
  bullets: [...],
  bookIds: ["class-9-iekv1"],
  relatedHref: "/books/class-9-iekv1",
  relatedLabel: "Kaushal Vikas book page",
},
{
  slug: "class-11-ncert-books",
  title: "Class 11 NCERT Books (English Medium) — Full List",
  ...
  bookIds: [],
  relatedHref: "/class/11",
  relatedLabel: "Class 11 NCERT hub",
},
{
  slug: "class-12-ncert-books",
  title: "Class 12 NCERT Books (English Medium) — Full List",
  ...
},
{
  slug: "class-12-mathematics-ncert",
  title: "Class 12 Mathematics NCERT Books — Part I & Related",
  bookIds: ["class-12-lemh1"], // add Part-II id if present in catalog
  relatedHref: "/class/12/mathematics",
  relatedLabel: "Class 12 Mathematics hub",
},
```

- [ ] **Step 2: Extend `resolveGuideBooks`** so `class-11-ncert-books` / `class-12-ncert-books` use `getBooksByClass(11|12)` like class-10.

- [ ] **Step 3: Link guides from class pages** when slug matches (Class 9 → kaushal guide + class list guides as applicable).

---

### Task 5: Priority chapter-title sync

**Files:**
- Modify: `scripts/apply-chapter-titles.ts`
- Update: `data/chapter-titles.json`, `data/catalog.json` (via script run)

- [ ] **Step 1: Filter by `TITLE_BOOK_CODES`**

After building `jobs`, if `process.env.TITLE_BOOK_CODES` is set:

```ts
const codeFilter = new Set(
  process.env.TITLE_BOOK_CODES.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
if (codeFilter.size > 0) {
  jobs = jobs.filter((j) => codeFilter.has(j.code));
}
```

Default `TITLE_MAX_FETCH` high enough when filter set (or pass `TITLE_MAX_FETCH=200`).

- [ ] **Step 2: Run sync**

```bash
TITLE_BOOK_CODES=iekv1,iest1,ieeo1,jeff1,jefp1,jehp1,lemh1,kegy1 TITLE_MAX_FETCH=200 TITLE_CONCURRENCY=3 npm run sync:chapter-titles
```

Expected: fills cache + applies titles into catalog for those codes.

- [ ] **Step 3: Spot-check** `iekv1` chapters in `data/catalog.json` are no longer all `Chapter N`.

---

### Task 6: Verify

- [ ] **Step 1:** `npm run test:seo-content`
- [ ] **Step 2:** `npm run test:chapter-titles` (existing)
- [ ] **Step 3:** `npm run build`
- [ ] **Step 4:** Mark plan checkboxes done; summarize for user

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Query-shaped titles/meta | 1 |
| Class FAQs + richer intros | 1–2 |
| Popular books SSR | 2 |
| Chapter FAQ + supporting line | 3 |
| Guides | 4 |
| Priority title sync | 5 |
| No domain / no slug rename | Global constraints |
