# NCERT Books

Browse and preview English-medium NCERT textbooks for Classes 9–12 in one place — without hosting the PDFs yourself.

**Live:** [https://ncert-books.vercel.app/](https://ncert-books.vercel.app/)

PDFs load from the official [NCERT textbook portal](https://ncert.nic.in/textbook.php). This project only links and streams those files through an allowlisted proxy.

## Features

- Browse by class and subject from a synced NCERT catalog
- In-app PDF.js reader with continuous page navigation across chapters
- Fullscreen reading with a side control rail (chapter jump, page jump, search)
- Desktop reader toolbar includes chapter jump, page jump, and find without entering fullscreen
- Find in book with match count, next/prev, highlights, progress, and cancel (loaded sections only)
- Offline-friendly IndexedDB + HTTP cache for PDF bytes
- Optional continue-reading (local progress + soft prompt; opens at page 1 unless you choose Continue)
- Prefetches the first chapter on the book page so Read opens faster
- Proxy retries NCERT with host fallback (`ncert.nic.in` ↔ `www`), buffers bodies for edge cache, and short timeouts so the client can fail/retry quickly
- Client PDF fetch times out ~14s per attempt (2 tries) with clearer “retrying…” status instead of a long hang
- Opens books from the first available section in order (no race-to-random-chapter)
- Streams and caches PDFs; remaining chapters load in the background
- Clear boot overlay while opening a book, plus background section progress after first page
- Zoom, fit page/width, pinch/trackpad zoom, and pan
- Privacy-friendly Vercel Analytics + Speed Insights (no ads)
- Weekly automated catalog sync via GitHub Actions

## Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- PDF.js
- Vercel Analytics / Speed Insights

## Getting Started

```bash
npm install
npm run sync:catalog
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm run sync:catalog` | Scrape NCERT listing and refresh `data/catalog.json` (also fills missing chapter titles) |
| `npm run sync:chapter-titles` | Fetch chapter PDFs and extract real titles into `data/chapter-titles.json` |
| `npm run sync:chapter-titles:local` | Extract titles from PDFs in `TITLE_PDF_DIR` (offline / resume) |
| `npm run test:chapter-titles` | Unit tests for chapter title parsing |

## Notes

- Catalog covers Classes 9–12 English-medium books only (v1).
- `/api/pdf` proxies allowlisted `ncert.nic.in` textbook URLs (required for CORS).
- Textbook content remains copyrighted by NCERT; always prefer the official portal as the source of truth.
- Catalog sync runs weekly via `.github/workflows/sync-ncert-catalog.yml` (also runnable manually).
- Chapter titles are extracted from the first page of each chapter PDF (NCERT’s listing only shows “Chapter N”). Titles are cached in `data/chapter-titles.json` and filled gradually (`TITLE_MAX_FETCH`) because NCERT downloads are slow/flaky.
- Analytics events: `book_open`, `reader_open`, `reader_ready`, `reader_error`, `fullscreen_enter`, `catalog_filter_used`, `continue_reading_shown`, `continue_reading_accepted`, `continue_reading_dismissed`.
