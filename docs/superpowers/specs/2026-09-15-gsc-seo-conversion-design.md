# GSC SEO & conversion improvements

**Date:** 2026-09-15  
**Site:** ncert-books.vercel.app  
**Source:** Google Search Console export 2026-09-14  
**Out of scope:** Custom domain; book URL slug renames (e.g. `jeff1` → `first-flight`)

## Problem

Search is discovering pages, but conversion is uneven:

- Chapter pages convert (16/18 clicks; avg pos ~11; CTR ~4.7%), especially Class 9 **Kaushal Vikas** (`iekv1`).
- Book hubs + class hubs hold most impressions (≈1,570) at avg pos ~66–68 with **0 clicks**.
- Near-win CTR gaps: `iekv1` chapter 2 has 63 impr @ ~#9 with 1.6% CTR vs chapter 6 at 11.8%.
- Many chapter titles are still generic (`Chapter N` / catalog placeholders); only one real title is cached.
- PDF-intent queries (~254 impr) must be answered honestly (read online / official NCERT), not as hosted downloads.

## Goals

1. Raise CTR on pages already in top ~10 (especially `iekv1` chapters 1–3, Class 9 Science/Economics hubs).
2. Make book + class landings richer so buried URLs have a chance to climb and convert.
3. Ship **real chapter titles** for priority books via the existing PDF extraction pipeline.
4. Add guide pages for high-impression clusters (Class 11/12, First Flight deep, Maths 12, Skill Education).

**Success signals (GSC, 2–4 weeks):** higher CTR on `iekv1` chapter URLs; any clicks on `/class/10–12` or top book hubs; more queries attributed with non-generic chapter titles.

## Approach (approved)

**Chapter titles: priority books first (A)** — extract/apply for a fixed allowlist, not full catalog.

Priority NCERT book codes / IDs:

| ID | Book | Why |
|----|------|-----|
| `class-9-iekv1` | Kaushal Vikas | Only converting book |
| `class-9-iest1` | Science | 57 impr @ pos ~12, 0 clicks |
| `class-9-ieeo1` | Economics | 27 impr @ pos ~10, 0 clicks |
| `class-10-jeff1` | First Flight | Highest book impr (188) |
| `class-10-jefp1` | Footprints | 94 impr |
| `class-10-jehp1` | Health & PE | PDF-intent cluster |
| `class-12-lemh1` | Maths Part-I | 96 impr |
| `class-11-kegy1` | India Physical Environment | High impr geography |

Support `TITLE_BOOK_CODES` (comma-separated NCERT codes, e.g. `iekv1,iest1,…`) and raise `TITLE_MAX_FETCH` enough to cover those books’ non-Prelims chapters in one or two sync runs.

## Design

### 1. Metadata & copy (`src/lib/seo-content.ts`)

Rewrite helpers so SERP language matches queries without keyword stuffing:

- **Chapter titles:** Prefer `{Book} Class {N} Chapter {printed?} — {chapter.title} | Read online` when the chapter title is still generic (`Chapter N` / `Prelims`); when a real title exists, lead with it then book + class. Always include subject when helpful (Skill Education for Kaushal Vikas).
- **Chapter / book / class meta:** Explicit “read online from official NCERT PDFs; we do not host downloads.”
- **Class titles:** e.g. `Class 10 NCERT Books English Medium — Read Online (Full List)`.
- **Book titles:** Keep book name first; append `| Read chapters online` (or equivalent) for CTR.
- **Intros:** Slightly longer class intros (subjects, popular books callout, read-online framing). Book intros mention chapter count + official source.
- **Class FAQs:** New `classFaqs()` + JSON-LD `FAQPage` on class hubs (official books? download? how to read?).
- **Chapter FAQs (light):** Optional short FAQ on chapter pages for “Is this Chapter N of {book}?” / download honesty — only if it stays non-duplicative of book FAQ.

Printed chapter number: catalog `index` includes Prelims as 1. Do **not** invent “Chapter {index}” in titles when that would misnumber. Use title text when it already contains `Chapter N`; otherwise use “catalog section” language already in helpers, or “Unit/section” phrasing for Skill books when title is generic.

### 2. On-page class hubs (`src/app/class/[class]/page.tsx`)

- Use richer `classIntro` + new FAQ section.
- Add a **Popular books** block (SSR): top titles for that class with keyword-rich link labels (`bookLinkLabel`), not only the client filter browser.
- Link to relevant guides when they exist for that class.

### 3. Book landings (existing structure, copy-only)

- Stronger H1 subtitle / eyebrow already has class·subject; ensure intro + FAQ answers PDF intent.
- Visible chapter list already links to chapter URLs — benefits automatically from real titles after sync.
- CTA copy: prefer “Read online” / “Open official chapter PDF on NCERT” wording consistency.

### 4. Chapter pages

- Metadata from updated helpers.
- H1 can stay `chapter.title` (improves when sync fills real names).
- Add one line of query-shaped supporting text under H1 for Skill Education books (e.g. “Kaushal Vikas Class 9 — Skill Education NCERT”).
- Optional FAQ block if implemented in seo-content.

### 5. Internal links

- `BookListItem`: show visible secondary line or title pattern that includes Class + NCERT (aria-label already uses `bookLinkLabel`). Prefer visible text like `{title} — Class {n} NCERT` on class hubs’ popular list.
- Breadcrumbs: use `classLinkLabel` / fuller class link text where space allows.
- Home crawl index: keep; ensure labels remain descriptive.

### 6. Guides (`src/lib/guides.ts`)

Add guides (reuse existing guide page template):

- Class 9 Skill Education / Kaushal Vikas  
- Class 11 NCERT books list (or Geography focus using `kegy1`)  
- Class 12 NCERT books list  
- Class 12 Mathematics Part-I  

Keep PDF-honest framing. Wire into sitemap via existing `GUIDES` map.

### 7. Chapter title sync

- Extend `scripts/apply-chapter-titles.ts` to filter jobs by `TITLE_BOOK_CODES` when set.
- Run sync for priority codes; commit updated `data/chapter-titles.json` + `data/catalog.json`.
- Do not change Prelims titles.

### 8. Explicitly not doing now

- Custom domain / `SITE_URL` change  
- Pretty URL redirects for book IDs  
- Hosting PDFs  
- Full-catalog title extraction  
- PDF reader CWV work (`/read` is noindex)

## Implementation order

1. `seo-content` title/meta/intro/FAQ helpers + tests if any exist  
2. Class / chapter / book page UI wiring (FAQ, popular books)  
3. New guides  
4. `TITLE_BOOK_CODES` filter + run priority sync  
5. Lint / `next build` (or project typecheck)

## Risks

- Title templates too long for SERP truncation — keep under ~60–65 chars where possible; put unique terms first.  
- PDF title extraction failures — leave generic title; metadata templates still improve CTR.  
- NCERT fetch rate limits — concurrency already capped; priority list keeps volume small.
