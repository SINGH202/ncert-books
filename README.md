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
- Streams the first chapter ASAP; remaining chapters load in the background
- Zoom, fit page/width, pinch/trackpad zoom, and pan

## Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- PDF.js

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
