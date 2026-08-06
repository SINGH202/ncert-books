/**
 * Apply data/chapter-titles.json onto an existing data/catalog.json
 * without re-fetching the NCERT textbook listing page.
 */
import { readFile, writeFile } from "node:fs/promises";
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
const USER_AGENT =
  "ncrt-books-catalog-sync/0.1 (+https://github.com/SINGH202/ncrt-books)";

const FETCH_TITLE_CONCURRENCY = Number(process.env.TITLE_CONCURRENCY ?? 3);
const FETCH_TITLE_TIMEOUT_MS = Number(process.env.TITLE_TIMEOUT_MS ?? 90_000);
const FETCH_TITLE_MAX = Number(process.env.TITLE_MAX_FETCH ?? 40);

function chapterNumberFromPdfUrl(pdfUrl: string): number | null {
  const match = pdfUrl.match(/\/([a-z0-9]+)(\d{2})\.pdf$/i);
  if (!match) return null;
  return Number(match[2]);
}

function bookCodeFromPdfUrl(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([a-z0-9]+)\d{2}\.pdf$/i);
  return match ? match[1].toLowerCase() : null;
}

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TITLE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () =>
      run(),
    ),
  );
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8")) as Catalog;
  const cache = await loadChapterTitleCache(TITLE_CACHE_PATH);

  type Job = {
    code: string;
    chapterNumber: number;
    url: string;
    subject: string;
    schoolClass: number;
  };
  const jobs: Job[] = [];
  for (const book of catalog.books) {
    for (const chapter of book.chapters) {
      if (chapter.title === "Prelims") continue;
      const code = bookCodeFromPdfUrl(chapter.pdfUrl);
      const chapterNumber = chapterNumberFromPdfUrl(chapter.pdfUrl);
      if (!code || chapterNumber == null) continue;
      const key = chapterTitleKey(code, chapterNumber);
      if (cache.titles[key]) continue;
      jobs.push({
        code,
        chapterNumber,
        url: chapter.pdfUrl,
        subject: book.subject,
        schoolClass: book.class,
      });
    }
  }

  const subjectPriority = (subject: string): number => {
    const s = subject.toLowerCase();
    if (s.includes("math")) return 0;
    if (s.includes("science")) return 1;
    if (s.includes("english")) return 2;
    if (s.includes("social") || s.includes("history") || s.includes("geography") || s.includes("politic") || s.includes("economic")) return 3;
    return 9;
  };

  jobs.sort(
    (a, b) =>
      subjectPriority(a.subject) - subjectPriority(b.subject) ||
      a.schoolClass - b.schoolClass ||
      a.code.localeCompare(b.code) ||
      a.chapterNumber - b.chapterNumber,
  );

  const pending = jobs.slice(0, FETCH_TITLE_MAX);
  console.log(
    `Titles cached ${Object.keys(cache.titles).length}; missing ${jobs.length}; fetching ${pending.length}`,
  );

  let filled = 0;
  let failed = 0;
  let sinceSave = 0;

  await mapPool(pending, FETCH_TITLE_CONCURRENCY, async (job) => {
    const key = chapterTitleKey(job.code, job.chapterNumber);
    try {
      const bytes = await fetchPdfBytes(job.url);
      const title = await extractChapterTitleFromPdfBytes(bytes);
      if (!title) {
        failed += 1;
        console.warn(`  ✗ ${key} no title found`);
        return;
      }
      cache.titles[key] = title;
      filled += 1;
      sinceSave += 1;
      console.log(`  ✓ ${key} → ${title}`);
      if (sinceSave >= 5) {
        sinceSave = 0;
        await saveChapterTitleCache(TITLE_CACHE_PATH, cache);
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `  ✗ ${key} ${error instanceof Error ? error.message : error}`,
      );
    }
  });

  await saveChapterTitleCache(TITLE_CACHE_PATH, cache);

  let applied = 0;
  for (const book of catalog.books) {
    for (const chapter of book.chapters) {
      if (chapter.title === "Prelims") continue;
      const code = bookCodeFromPdfUrl(chapter.pdfUrl);
      const chapterNumber = chapterNumberFromPdfUrl(chapter.pdfUrl);
      if (!code || chapterNumber == null) continue;
      const title = cache.titles[chapterTitleKey(code, chapterNumber)];
      if (!title) continue;
      if (chapter.title !== title) {
        chapter.title = title;
        applied += 1;
      }
    }
  }

  catalog.syncedAt = new Date().toISOString();
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(
    `Filled ${filled}, failed ${failed}, applied ${applied} titles → ${CATALOG_PATH}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
