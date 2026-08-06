import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import type { Book, Catalog, Chapter, SchoolClass } from "../src/lib/types";
import {
  chapterTitleKey,
  loadChapterTitleCache,
  saveChapterTitleCache,
  type ChapterTitleCache,
} from "./lib/chapter-title-cache";
import { extractChapterTitleFromPdfBytes } from "./lib/pdf-chapter-title";

const NCERT_ORIGIN = "https://ncert.nic.in";
const TEXTBOOK_PAGE = `${NCERT_ORIGIN}/textbook.php?ln=en`;
const PDF_BASE = `${NCERT_ORIGIN}/textbook/pdf`;
const TARGET_CLASSES = new Set<SchoolClass>([9, 10, 11, 12]);
const CLASS_CODE_PREFIX: Record<SchoolClass, string> = {
  9: "i",
  10: "j",
  11: "k",
  12: "l",
};
const OUTPUT_PATH = path.join(process.cwd(), "data", "catalog.json");
const TITLE_CACHE_PATH = path.join(process.cwd(), "data", "chapter-titles.json");
const LOCAL_PAGE_FALLBACK = path.join(process.cwd(), "ncert-textbook.html");
const USER_AGENT =
  "ncrt-books-catalog-sync/0.1 (+https://github.com/SINGH202/ncrt-books)";

const FETCH_TITLE_CONCURRENCY = Number(process.env.TITLE_CONCURRENCY ?? 3);
const FETCH_TITLE_TIMEOUT_MS = Number(process.env.TITLE_TIMEOUT_MS ?? 90_000);
const FETCH_TITLE_MAX = Number(process.env.TITLE_MAX_FETCH ?? 0); // 0 = no limit
const SKIP_CHAPTER_TITLES = process.env.SKIP_CHAPTER_TITLES === "1";

type ParsedBook = {
  class: SchoolClass;
  subject: string;
  title: string;
  code: string;
  start: number;
  end: number;
};

function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//")) return "";
      return line.replace(/\/\/.*$/, "");
    })
    .join("\n");
}

function extractChange1(html: string): string {
  const start = html.indexOf("function change1(sind)");
  if (start < 0) {
    throw new Error("Could not find change1() in NCERT textbook page");
  }
  const endMarkers = ["function queryStringValue", "</script>"];
  let end = html.length;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, start + 1);
    if (idx > start && idx < end) end = idx;
  }
  return html.slice(start, end);
}

function parseBooks(change1Source: string): ParsedBook[] {
  const source = stripLineComments(change1Source);
  const blockRe =
    /(?:else\s+)?if\s*\(\s*\(document\.test\.tclass\.value\s*==\s*(\d+)\)\s*&&\s*\(document\.test\.tsubject\.options\[sind\]\.text\s*==\s*"([^"]+)"\)\s*\)\s*\{([\s\S]*?)(?=\n\s*(?:else\s+)?if\s*\(\s*\(document\.test\.tclass|\n\s*\}\s*$)/g;

  const books: ParsedBook[] = [];
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRe.exec(source))) {
    const classNum = Number(blockMatch[1]) as SchoolClass;
    if (!TARGET_CLASSES.has(classNum)) continue;

    const subject = blockMatch[2].trim();
    const body = blockMatch[3];
    const bookRe =
      /document\.test\.tbook\.options\[(\d+)\]\.text\s*=\s*"([^"]*)"\s*;?\s*document\.test\.tbook\.options\[\1\]\.value\s*=\s*"([^"]*)"/g;

    let bookMatch: RegExpExecArray | null;
    while ((bookMatch = bookRe.exec(body))) {
      const title = bookMatch[2].trim();
      const value = bookMatch[3].trim();
      if (!title || !value || /coming soon/i.test(title)) continue;

      const valueMatch = value.match(
        /textbook\.php\?([a-z0-9]+)=(\d+)-(\d+)/i,
      );
      if (!valueMatch) continue;

      const code = valueMatch[1].toLowerCase();
      const expectedPrefix = CLASS_CODE_PREFIX[classNum];
      // English-medium NCERT codes: class letter + "e" + subject suffix
      if (code[0] !== expectedPrefix || code[1] !== "e") continue;

      books.push({
        class: classNum,
        subject,
        title,
        code,
        start: Number(valueMatch[2]),
        end: Number(valueMatch[3]),
      });
    }
  }

  const deduped = new Map<string, ParsedBook>();
  for (const book of books) {
    deduped.set(`${book.class}:${book.code}`, book);
  }
  return [...deduped.values()].sort(
    (a, b) =>
      a.class - b.class ||
      a.subject.localeCompare(b.subject) ||
      a.title.localeCompare(b.title),
  );
}

async function fetchTextbookHtml(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(TEXTBOOK_PAGE, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch textbook page: ${response.status} ${response.statusText}`,
      );
    }
    return await response.text();
  } catch (error) {
    try {
      await access(LOCAL_PAGE_FALLBACK);
      console.warn(
        `Network fetch failed (${error instanceof Error ? error.message : error}); using local ${LOCAL_PAGE_FALLBACK}`,
      );
      return await readFile(LOCAL_PAGE_FALLBACK, "utf8");
    } catch {
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

function chapterPdfUrl(code: string, chapterNumber: number): string {
  return `${PDF_BASE}/${code}${String(chapterNumber).padStart(2, "0")}.pdf`;
}

function prelimsPdfUrl(code: string): string {
  return `${PDF_BASE}/${code}ps.pdf`;
}

function buildChapters(
  book: ParsedBook,
  titles: Record<string, string>,
): Chapter[] {
  const chapters: Chapter[] = [];

  // Prelims are commonly published as {code}ps.pdf alongside numbered chapters.
  chapters.push({
    index: 1,
    title: "Prelims",
    pdfUrl: prelimsPdfUrl(book.code),
  });

  for (let n = Math.max(book.start, 1); n <= book.end; n += 1) {
    const cached = titles[chapterTitleKey(book.code, n)];
    chapters.push({
      index: chapters.length + 1,
      title: cached ?? `Chapter ${n}`,
      pdfUrl: chapterPdfUrl(book.code, n),
    });
  }

  return chapters;
}

function toBookId(book: ParsedBook): string {
  return `class-${book.class}-${book.code}`;
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

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

type TitleJob = {
  code: string;
  chapterNumber: number;
  url: string;
  subject: string;
  schoolClass: SchoolClass;
};

async function enrichChapterTitles(
  books: ParsedBook[],
  cache: ChapterTitleCache,
): Promise<ChapterTitleCache> {
  if (SKIP_CHAPTER_TITLES) {
    console.log("SKIP_CHAPTER_TITLES=1 — using cached titles only");
    return cache;
  }

  const jobs: TitleJob[] = [];
  for (const book of books) {
    for (let n = Math.max(book.start, 1); n <= book.end; n += 1) {
      const key = chapterTitleKey(book.code, n);
      if (cache.titles[key]) continue;
      jobs.push({
        code: book.code,
        chapterNumber: n,
        url: chapterPdfUrl(book.code, n),
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
    if (
      s.includes("social") ||
      s.includes("history") ||
      s.includes("geography") ||
      s.includes("politic") ||
      s.includes("economic")
    ) {
      return 3;
    }
    return 9;
  };

  jobs.sort(
    (a, b) =>
      subjectPriority(a.subject) - subjectPriority(b.subject) ||
      a.schoolClass - b.schoolClass ||
      a.code.localeCompare(b.code) ||
      a.chapterNumber - b.chapterNumber,
  );

  const pending = FETCH_TITLE_MAX > 0 ? jobs.slice(0, FETCH_TITLE_MAX) : jobs;

  console.log(
    `Chapter titles: ${Object.keys(cache.titles).length} cached, ${jobs.length} missing` +
      (FETCH_TITLE_MAX > 0
        ? `, fetching ${pending.length} this run (TITLE_MAX_FETCH=${FETCH_TITLE_MAX})`
        : `, fetching all (concurrency ${FETCH_TITLE_CONCURRENCY})`),
  );

  if (pending.length === 0) return cache;

  let filled = 0;
  let failed = 0;
  let sinceSave = 0;

  await mapPool(pending, FETCH_TITLE_CONCURRENCY, async (job) => {
    const key = chapterTitleKey(job.code, job.chapterNumber);
    try {
      const bytes = await fetchPdfBytes(job.url);
      const title = await extractChapterTitleFromPdfBytes(bytes);
      if (title) {
        cache.titles[key] = title;
        filled += 1;
        sinceSave += 1;
        console.log(`  ✓ ${key} → ${title}`);
      } else {
        failed += 1;
        console.warn(`  ✗ ${key} no title found`);
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `  ✗ ${key} ${error instanceof Error ? error.message : error}`,
      );
    }

    if (sinceSave >= 10) {
      sinceSave = 0;
      await saveChapterTitleCache(TITLE_CACHE_PATH, cache);
    }
  });

  await saveChapterTitleCache(TITLE_CACHE_PATH, cache);
  console.log(`Chapter titles filled ${filled}, failed ${failed}`);
  return cache;
}

async function main() {
  console.log(`Loading textbook catalog source`);
  const html = await fetchTextbookHtml();
  const change1 = extractChange1(html);
  const parsedBooks = parseBooks(change1);
  console.log(`Parsed ${parsedBooks.length} English-medium books (9–12)`);

  if (parsedBooks.length === 0) {
    throw new Error("No books parsed — aborting to preserve last good catalog");
  }

  const titleCache = await loadChapterTitleCache(TITLE_CACHE_PATH);
  const enriched = await enrichChapterTitles(parsedBooks, titleCache);

  const books: Book[] = parsedBooks.map((parsed) => ({
    id: toBookId(parsed),
    class: parsed.class,
    subject: parsed.subject,
    title: parsed.title,
    ncertBookCode: parsed.code,
    ncertBookUrl: `${NCERT_ORIGIN}/textbook.php?${parsed.code}=${parsed.start}-${parsed.end}`,
    chapters: buildChapters(parsed, enriched.titles),
  }));

  const catalog: Catalog = {
    syncedAt: new Date().toISOString(),
    language: "en",
    books,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  await writeFile(OUTPUT_PATH, serialized, "utf8");

  const written = JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as Catalog;
  const realTitles = written.books
    .flatMap((book) => book.chapters)
    .filter((chapter) => !/^Chapter \d+$/i.test(chapter.title) && chapter.title !== "Prelims")
    .length;
  console.log(
    `Wrote ${written.books.length} books to ${OUTPUT_PATH} (syncedAt ${written.syncedAt}); ${realTitles} chapters have real titles`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
