export type PdfTextItem = {
  str: string;
  /** PDF.js transform[4] */
  x: number;
  /** PDF.js transform[5] */
  y: number;
  height: number;
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

function titleFromCluster(cluster: PdfTextItem[]): {
  text: string;
  maxHeight: number;
  avgY: number;
} | null {
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

/**
 * Pick the chapter title from first-page text items.
 * NCERT chapter openers usually put a large letter-spaced title near the top,
 * beside an oversized chapter number.
 */
export function extractChapterTitleFromTextItems(
  items: PdfTextItem[],
): string | null {
  if (items.length === 0) return null;

  const scored: Array<{ text: string; score: number }> = [];
  for (const cluster of clusterByY(items)) {
    const extracted = titleFromCluster(cluster);
    if (!extracted) continue;
    scored.push({
      text: extracted.text,
      score: extracted.maxHeight * 10 + extracted.avgY / 100,
    });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].text;
  if (best === best.toUpperCase() && /[A-Z]/.test(best)) {
    return toTitleCaseWords(best);
  }
  return best;
}

export function looksLikeGenericChapterTitle(title: string): boolean {
  return /^chapter\s+\d+$/i.test(title.trim()) || /^prelims$/i.test(title.trim());
}
