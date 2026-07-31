# NCERT Books

Browse and preview English-medium NCERT textbooks for Classes 9–12 in one place.

**Live:** [https://ncert-books.vercel.app/](https://ncert-books.vercel.app/)

PDFs are loaded from the official [NCERT textbook portal](https://ncert.nic.in/textbook.php). This project does not host textbook files.

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
- The reader proxies official PDF URLs through `/api/pdf` (allowlisted to `ncert.nic.in`) because browsers cannot fetch those PDFs directly (CORS).
- Textbook content remains copyrighted by NCERT.
