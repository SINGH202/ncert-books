/**
 * Extract titles from PDFs already on disk:
 *   TITLE_PDF_DIR=/tmp/ncert-c2/jemh npm run sync:chapter-titles:local
 * Filenames must look like {code}{nn}.pdf (e.g. jemh101.pdf).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog } from "../src/lib/types";
import {
  chapterTitleKey,
  loadChapterTitleCache,
  saveChapterTitleCache,
} from "./lib/chapter-title-cache";
import { extractChapterTitleFromPdfBytes } from "./lib/pdf-chapter-title";

const CATALOG_PATH = path.join(process.cwd(), "data", "catalog.json");
const TITLE_CACHE_PATH = path.join(process.cwd(), "data", "chapter-titles.json");
const PDF_DIR = process.env.TITLE_PDF_DIR;

async function main() {
  if (!PDF_DIR) {
    throw new Error("Set TITLE_PDF_DIR to a folder of NCERT chapter PDFs");
  }

  const cache = await loadChapterTitleCache(TITLE_CACHE_PATH);
  const files = (await readdir(PDF_DIR)).filter((name) =>
    /^[a-z0-9]+\d{2}\.pdf$/i.test(name),
  );

  let filled = 0;
  for (const file of files) {
    const match = file.match(/^([a-z0-9]+)(\d{2})\.pdf$/i);
    if (!match) continue;
    const code = match[1].toLowerCase();
    const chapterNumber = Number(match[2]);
    const key = chapterTitleKey(code, chapterNumber);
    const bytes = new Uint8Array(await readFile(path.join(PDF_DIR, file)));
    const title = await extractChapterTitleFromPdfBytes(bytes);
    if (!title) {
      console.warn(`✗ ${file} no title`);
      continue;
    }
    cache.titles[key] = title;
    filled += 1;
    console.log(`✓ ${key} → ${title}`);
  }

  await saveChapterTitleCache(TITLE_CACHE_PATH, cache);

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as Catalog;
  let applied = 0;
  for (const book of catalog.books) {
    for (const chapter of book.chapters) {
      const match = chapter.pdfUrl.match(/\/([a-z0-9]+)(\d{2})\.pdf$/i);
      if (!match) continue;
      const key = chapterTitleKey(match[1], Number(match[2]));
      const title = cache.titles[key];
      if (!title || chapter.title === title) continue;
      chapter.title = title;
      applied += 1;
    }
  }
  catalog.syncedAt = new Date().toISOString();
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8"),
  );
  console.log(`Filled ${filled}, applied ${applied}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
