import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type ChapterTitleCache = {
  updatedAt: string;
  /** Key: `${bookCode}:${chapterNumber}` → real title */
  titles: Record<string, string>;
};

export function chapterTitleKey(bookCode: string, chapterNumber: number): string {
  return `${bookCode.toLowerCase()}:${chapterNumber}`;
}

export async function loadChapterTitleCache(
  filePath: string,
): Promise<ChapterTitleCache> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as ChapterTitleCache;
    return {
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      titles: parsed.titles ?? {},
    };
  } catch {
    return { updatedAt: new Date(0).toISOString(), titles: {} };
  }
}

export async function saveChapterTitleCache(
  filePath: string,
  cache: ChapterTitleCache,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const next: ChapterTitleCache = {
    updatedAt: new Date().toISOString(),
    titles: Object.fromEntries(
      Object.entries(cache.titles).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}
