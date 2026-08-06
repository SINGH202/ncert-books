import type { MetadataRoute } from "next";
import { getAllBooks, SCHOOL_CLASSES } from "@/lib/catalog";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ncert-books.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SCHOOL_CLASSES.map((schoolClass) => ({
      url: `${SITE_URL}/class/${schoolClass}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  for (const book of getAllBooks()) {
    entries.push(
      {
        url: `${SITE_URL}/books/${book.id}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: `${SITE_URL}/books/${book.id}/read`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      },
    );
  }

  return entries;
}
