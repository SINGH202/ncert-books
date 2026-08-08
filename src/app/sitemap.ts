import type { MetadataRoute } from "next";
import { getAllBooks, getCatalog, SCHOOL_CLASSES } from "@/lib/catalog";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ncert-books.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const catalog = getCatalog();
  const lastModified = new Date(catalog.syncedAt);

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SCHOOL_CLASSES.map((schoolClass) => ({
      url: `${SITE_URL}/class/${schoolClass}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  // Index book landing pages only — /read is noindex (reader chrome).
  for (const book of getAllBooks()) {
    entries.push({
      url: `${SITE_URL}/books/${book.id}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  return entries;
}
