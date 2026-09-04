export type PdfTextItem = {
  str: string;
  /** PDF.js transform[4] */
  x: number;
  /** PDF.js transform[5] */
  y: number;
  height: number;
};

type TitleLine = {
  text: string;
  maxHeight: number;
  avgY: number;
};

/** Join NCERT's letter-spaced title tokens ("R"+"EAL"+" "+"N"+"UMBERS"). */
export function joinNcertTitleTokens(tokens: string[]): string {
  let out = "";
  for (const token of tokens) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      if (out && !out.endsWith(" ")) out += " ";
      continue;
    }
    out += token;
  }
  return out.replace(/\s+/g, " ").trim();
}

export function toTitleCaseWords(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d+(\.\d+)?$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function isMostlyDigits(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  return compact.length > 0 && /^[\d.IVXivx]+$/.test(compact);
}

function clusterByY(items: PdfTextItem[], tolerance = 2): PdfTextItem[][] {
  const sorted = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const clusters: PdfTextItem[][] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= tolerance) {
      last.push(item);
      continue;
    }
    clusters.push([item]);
  }
  for (const cluster of clusters) {
    cluster.sort((a, b) => a.x - b.x);
  }
  return clusters;
}

function titleFromCluster(cluster: PdfTextItem[]): TitleLine | null {
  const letterItems = cluster.filter(
    (item) => item.str.trim() && !isMostlyDigits(item.str) && item.height >= 14,
  );
  if (letterItems.length === 0) return null;

  const minX = Math.min(...letterItems.map((item) => item.x));
  const maxX = Math.max(...letterItems.map((item) => item.x));
  // Keep spaces between title glyphs; drop far-right chapter numbers.
  const tokens = cluster.filter((item) => {
    if (item.x < minX - 2 || item.x > maxX + 40) return false;
    if (/^\s+$/.test(item.str)) return true;
    if (isMostlyDigits(item.str)) return false;
    return item.height >= 14;
  });

  const text = joinNcertTitleTokens(tokens.map((item) => item.str));
  if (!text || text.length < 3 || text.length > 120) return null;
  if (/^\d+(\.\d+)?\s+\S/.test(text)) return null;

  return {
    text,
    maxHeight: Math.max(...letterItems.map((item) => item.height)),
    avgY:
      letterItems.reduce((sum, item) => sum + item.y, 0) / letterItems.length,
  };
}

const TRAILING_INCOMPLETE =
  /^(And|Of|The|To|A|An|In|For|Or|With|From|Into|Onto|As|By|On|At|Vs|Versus)$/i;

/** True when a cached/extracted title likely lost a wrapped second line. */
export function looksLikeTruncatedChapterTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  const words = trimmed.split(/\s+/);
  const last = words[words.length - 1] ?? "";
  if (TRAILING_INCOMPLETE.test(last)) return true;
  // Common NCERT wrap: "Inverse Trigonometric" / "Exploring Algebraic"
  if (
    words.length >= 2 &&
    /^(Trigonometric|Algebraic|Linear|Quadratic|Geometric|Arithmetic|Differential|Integral)$/i.test(
      last,
    )
  ) {
    return true;
  }
  return false;
}

function similarHeight(a: number, b: number): boolean {
  const larger = Math.max(a, b);
  if (larger <= 0) return false;
  return Math.abs(a - b) / larger <= 0.35;
}

/**
 * NCERT titles often wrap onto a second large-font line. Merge nearby
 * same-size lines below the best-scoring opener line.
 */
export function mergeWrappedTitleLines(lines: TitleLine[]): string | null {
  if (lines.length === 0) return null;

  const scored = lines
    .map((line) => ({
      ...line,
      score: line.maxHeight * 10 + line.avgY / 100,
    }))
    .sort((a, b) => b.score - a.score);

  const seed = scored[0];
  const used = new Set<TitleLine>([seed]);
  const ordered: TitleLine[] = [seed];

  while (ordered.length < 3) {
    const last = ordered[ordered.length - 1];
    const candidates = lines
      .filter((line) => !used.has(line))
      .filter((line) => line.avgY < last.avgY - 2)
      .filter((line) => similarHeight(line.maxHeight, last.maxHeight))
      .map((line) => ({ line, gap: last.avgY - line.avgY }))
      .filter(({ gap }) => gap <= last.maxHeight * 2.4)
      .sort((a, b) => a.gap - b.gap);

    if (candidates.length === 0) break;

    const { line: next, gap } = candidates[0];
    const currentText = ordered.map((line) => line.text).join(" ");
    const incomplete = looksLikeTruncatedChapterTitle(currentText);
    const veryClose = gap <= last.maxHeight * 1.6;
    // Incomplete openers always take the next same-size line; otherwise only
    // merge one very close continuation (tight wraps without a cue word).
    if (!incomplete && !(veryClose && ordered.length === 1)) break;

    used.add(next);
    ordered.push(next);
  }

  ordered.sort((a, b) => b.avgY - a.avgY);
  const merged = ordered
    .map((line) => line.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!merged || merged.length < 3 || merged.length > 160) return null;
  return merged;
}

/**
 * Pick the chapter title from first-page text items.
 * NCERT chapter openers usually put a large letter-spaced title near the top,
 * beside an oversized chapter number — sometimes wrapped across two lines.
 */
export function extractChapterTitleFromTextItems(
  items: PdfTextItem[],
): string | null {
  if (items.length === 0) return null;

  const lines: TitleLine[] = [];
  for (const cluster of clusterByY(items)) {
    const extracted = titleFromCluster(cluster);
    if (extracted) lines.push(extracted);
  }

  const best = mergeWrappedTitleLines(lines);
  if (!best) return null;
  if (best === best.toUpperCase() && /[A-Z]/.test(best)) {
    return toTitleCaseWords(best);
  }
  return best;
}

export function looksLikeGenericChapterTitle(title: string): boolean {
  return /^chapter\s+\d+$/i.test(title.trim()) || /^prelims$/i.test(title.trim());
}
