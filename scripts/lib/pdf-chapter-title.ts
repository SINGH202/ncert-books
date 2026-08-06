import {
  extractChapterTitleFromTextItems,
  type PdfTextItem,
} from "./extract-chapter-title";

type PdfJsModule = {
  getDocument: (params: {
    data: Uint8Array;
    disableWorker?: boolean;
    useSystemFonts?: boolean;
  }) => { promise: Promise<PdfDocument> };
};

type PdfDocument = {
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy?: () => Promise<void> | void;
};

type PdfPage = {
  getTextContent: () => Promise<{
    items: Array<{ str?: string; transform?: number[]; height?: number }>;
  }>;
};

let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfjs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs") as Promise<PdfJsModule>;
  }
  return pdfjsPromise;
}

export async function extractChapterTitleFromPdfBytes(
  bytes: Uint8Array,
): Promise<string | null> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const item of content.items) {
      if (!item || typeof item.str !== "string" || !item.transform) continue;
      items.push({
        str: item.str,
        x: item.transform[4] ?? 0,
        y: item.transform[5] ?? 0,
        height: item.height ?? Math.abs(item.transform[0] || item.transform[3] || 0),
      });
    }
    return extractChapterTitleFromTextItems(items);
  } finally {
    await pdf.destroy?.();
  }
}
