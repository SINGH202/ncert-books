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

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function findRanges(haystack: string, needle: string): Array<[number, number]> {
  if (!needle) return [];
  const ranges: Array<[number, number]> = [];
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    ranges.push([index, index + needle.length]);
    from = index + Math.max(1, needle.length);
  }
  return ranges;
}

/**
 * Build a searchable string from PDF.js text items and map matches back to
 * item-level rectangles in PDF user space.
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

  const parts: string[] = [];
  const map: Array<{ itemIndex: number; start: number; end: number }> = [];
  let cursor = 0;

  args.items.forEach((item, itemIndex) => {
    const text = item.str ?? "";
    if (!text) return;
    if (parts.length > 0) {
      parts.push(" ");
      cursor += 1;
    }
    const start = cursor;
    parts.push(text);
    cursor += text.length;
    map.push({ itemIndex, start, end: cursor });
  });

  const haystack = parts.join("").toLowerCase();
  const ranges = findRanges(haystack, needle);
  if (ranges.length === 0) return [];

  const matches: PdfSearchMatch[] = [];

  for (const [rangeStart, rangeEnd] of ranges) {
    const pdfRects: PdfSearchMatch["pdfRects"] = [];
    for (const entry of map) {
      if (entry.end <= rangeStart || entry.start >= rangeEnd) continue;
      const item = args.items[entry.itemIndex];
      if (!item) continue;
      const [, , , , x, y] = item.transform;
      const w = item.width || 0;
      const h = item.height || Math.abs(item.transform[3]) || 10;
      pdfRects.push({
        x1: x,
        y1: y,
        x2: x + w,
        y2: y + h,
      });
    }
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
