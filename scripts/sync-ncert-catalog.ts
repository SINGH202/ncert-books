import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import type { Book, Catalog, Chapter, SchoolClass } from "../src/lib/types";

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
const LOCAL_PAGE_FALLBACK = path.join(process.cwd(), "ncert-textbook.html");
const USER_AGENT =
  "ncrt-books-catalog-sync/0.1 (+https://github.com/SINGH202/ncrt-books)";

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

function buildChapters(book: ParsedBook): Chapter[] {
  const chapters: Chapter[] = [];

  // Prelims are commonly published as {code}ps.pdf alongside numbered chapters.
  chapters.push({
    index: 1,
    title: "Prelims",
    pdfUrl: prelimsPdfUrl(book.code),
  });

  for (let n = Math.max(book.start, 1); n <= book.end; n += 1) {
    chapters.push({
      index: chapters.length + 1,
      title: `Chapter ${n}`,
      pdfUrl: chapterPdfUrl(book.code, n),
    });
  }

  return chapters;
}

function toBookId(book: ParsedBook): string {
  return `class-${book.class}-${book.code}`;
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

  const books: Book[] = parsedBooks.map((parsed) => ({
    id: toBookId(parsed),
    class: parsed.class,
    subject: parsed.subject,
    title: parsed.title,
    ncertBookCode: parsed.code,
    ncertBookUrl: `${NCERT_ORIGIN}/textbook.php?${parsed.code}=${parsed.start}-${parsed.end}`,
    chapters: buildChapters(parsed),
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
  console.log(
    `Wrote ${written.books.length} books to ${OUTPUT_PATH} (syncedAt ${written.syncedAt})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
