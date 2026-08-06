# NCERT Books

Browse and preview English-medium NCERT textbooks for Classes 9–12 in one place — without hosting the PDFs yourself.

**Live:** [https://ncert-books.vercel.app/](https://ncert-books.vercel.app/)

PDFs load from the official [NCERT textbook portal](https://ncert.nic.in/textbook.php). This project only links and streams those files through an allowlisted proxy.

## Features

- Browse by class and subject from a synced NCERT catalog
- In-app PDF.js reader with continuous page navigation across chapters
- Fullscreen reading with a side control rail (chapter jump, page jump, search)
- Find in book with match count, next/prev, and highlights
- Offline-friendly IndexedDB + HTTP cache for PDF bytes (opens at page 1 every time)
- Opens books from the first available section in order (no race-to-random-chapter)
- Streams and caches PDFs; remaining chapters load in the background
- Clear loading status while waiting on NCERT
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
| `npm run sync:catalog` | Scrape NCERT and refresh `data/catalog.json` |

## Notes

- Catalog covers Classes 9–12 English-medium books only (v1).
- `/api/pdf` proxies allowlisted `ncert.nic.in` textbook URLs (required for CORS).
- Textbook content remains copyrighted by NCERT; always prefer the official portal as the source of truth.
- Catalog sync runs weekly via `.github/workflows/sync-ncert-catalog.yml` (also runnable manually).
- Analytics events: `book_open`, `reader_open`, `reader_ready`, `reader_error`, `fullscreen_enter`.
