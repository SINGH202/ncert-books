export type PdfSearchRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PdfSearchMatch = {
  id: string;
  metaIndex: number;
  pageInChapter: number;
  globalPage: number;
  /** Rectangles in PDF page units (unscaled). */
  pdfRects: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

type SearchItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type ItemSpan = {
  itemIndex: number;
  /** Inclusive start in haystack */
  start: number;
  /** Exclusive end in haystack */
  end: number;
};

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[a-z0-9]/i.test(ch);
}

/**
 * Find needle ranges in haystack. For plain alphanumeric queries, require
 * word boundaries so "cat" does not match inside "catalog".
 */
export function findRanges(
  haystack: string,
  needle: string,
): Array<[number, number]> {
  if (!needle) return [];
  const ranges: Array<[number, number]> = [];
  const requireBoundary = /^[a-z0-9]+$/i.test(needle);
  let from = 0;

  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;

    const before = index > 0 ? haystack[index - 1] : undefined;
    const after =
      index + needle.length < haystack.length
        ? haystack[index + needle.length]
        : undefined;

    const ok =
      !requireBoundary ||
      (!isWordChar(before) && !isWordChar(after));

    if (ok) {
      ranges.push([index, index + needle.length]);
      from = index + Math.max(1, needle.length);
    } else {
      from = index + 1;
    }
  }

  return ranges;
}

function itemHeight(item: SearchItem): number {
  return item.height || Math.abs(item.transform[3]) || 10;
}

/**
 * Highlight only the matched slice of a text item (not the whole sentence/run).
 * Assumes mostly horizontal LTR text — typical for NCERT PDFs.
 */
export function rectForItemSlice(
  item: SearchItem,
  localStart: number,
  localEnd: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const text = item.str ?? "";
  if (!text || localEnd <= localStart) return null;

  const start = Math.max(0, Math.min(localStart, text.length));
  const end = Math.max(start, Math.min(localEnd, text.length));
  if (end <= start) return null;

  const [, , , , x, y] = item.transform;
  const w = item.width || 0;
  const h = itemHeight(item);
  const len = text.length || 1;

  // Proportional advance along the item's width.
  const x1 = x + (w * start) / len;
  const x2 = x + (w * end) / len;

  return {
    x1: Math.min(x1, x2),
    y1: y,
    x2: Math.max(x1, x2),
    y2: y + h,
  };
}

/**
 * Build haystack from PDF.js text items WITHOUT inserting artificial spaces.
 * Items already include their own spacing; adding spaces created false matches.
 */
export function buildHaystack(items: SearchItem[]): {
  haystack: string;
  spans: ItemSpan[];
} {
  const spans: ItemSpan[] = [];
  let haystack = "";

  items.forEach((item, itemIndex) => {
    const text = item.str ?? "";
    if (!text) return;
    const start = haystack.length;
    haystack += text;
    spans.push({ itemIndex, start, end: haystack.length });
  });

  return { haystack: haystack.toLowerCase(), spans };
}

function rectsForRange(
  items: SearchItem[],
  spans: ItemSpan[],
  rangeStart: number,
  rangeEnd: number,
): PdfSearchMatch["pdfRects"] {
  const pdfRects: PdfSearchMatch["pdfRects"] = [];

  for (const span of spans) {
    if (span.end <= rangeStart || span.start >= rangeEnd) continue;
    const item = items[span.itemIndex];
    if (!item) continue;

    const localStart = Math.max(0, rangeStart - span.start);
    const localEnd = Math.min(item.str.length, rangeEnd - span.start);
    const rect = rectForItemSlice(item, localStart, localEnd);
    if (rect) pdfRects.push(rect);
  }

  return pdfRects;
}

/**
 * Find query matches on a page and map them to tight PDF-space rectangles.
 */
export function findMatchesOnPage(args: {
  items: SearchItem[];
  query: string;
  metaIndex: number;
  pageInChapter: number;
  globalPage: number;
}): PdfSearchMatch[] {
  const needle = normalizeQuery(args.query);
  if (needle.length < 2) return [];

  const { haystack, spans } = buildHaystack(args.items);
  // Normalize whitespace in haystack the same way as the query for phrase search.
  // Keep original offsets by only lowercasing in buildHaystack; for multi-word
  // queries, search the raw lowercased stream (PDF spaces are already present).
  const ranges = findRanges(haystack, needle);
  if (ranges.length === 0) {
    // Phrase with collapsed spaces: try a whitespace-flexible search.
    if (/\s/.test(needle)) {
      return findPhraseMatchesFlexible(args, needle);
    }
    return [];
  }

  const matches: PdfSearchMatch[] = [];
  for (const [rangeStart, rangeEnd] of ranges) {
    const pdfRects = rectsForRange(args.items, spans, rangeStart, rangeEnd);
    if (pdfRects.length === 0) continue;
    matches.push({
      id: `${args.metaIndex}-${args.pageInChapter}-${rangeStart}-${rangeEnd}`,
      metaIndex: args.metaIndex,
      pageInChapter: args.pageInChapter,
      globalPage: args.globalPage,
      pdfRects,
    });
  }

  return matches;
}

/**
 * Fallback for multi-word queries when PDF spacing differs (multiple spaces,
 * newlines as spaces, etc.).
 */
function findPhraseMatchesFlexible(
  args: {
    items: SearchItem[];
    metaIndex: number;
    pageInChapter: number;
    globalPage: number;
  },
  needle: string,
): PdfSearchMatch[] {
  const { haystack, spans } = buildHaystack(args.items);
  const pattern = needle
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("\\s+");
  if (!pattern) return [];

  const re = new RegExp(pattern, "gi");
  const matches: PdfSearchMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = re.exec(haystack))) {
    const rangeStart = match.index;
    const rangeEnd = rangeStart + match[0].length;
    const pdfRects = rectsForRange(args.items, spans, rangeStart, rangeEnd);
    if (pdfRects.length === 0) continue;
    matches.push({
      id: `${args.metaIndex}-${args.pageInChapter}-${rangeStart}-${rangeEnd}`,
      metaIndex: args.metaIndex,
      pageInChapter: args.pageInChapter,
      globalPage: args.globalPage,
      pdfRects,
    });
    if (match[0].length === 0) re.lastIndex += 1;
  }

  return matches;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toViewportRects(
  pdfRects: PdfSearchMatch["pdfRects"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewport: any,
): PdfSearchRect[] {
  return pdfRects.map((rect) => {
    const converted = viewport.convertToViewportRectangle([
      rect.x1,
      rect.y1,
      rect.x2,
      rect.y2,
    ]) as number[];
    const left = Math.min(converted[0], converted[2]);
    const top = Math.min(converted[1], converted[3]);
    const width = Math.abs(converted[2] - converted[0]);
    const height = Math.abs(converted[3] - converted[1]);
    return { left, top, width, height };
  });
}
