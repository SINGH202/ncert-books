import type { MetadataRoute } from "next";
import { getAllBooks, getCatalog, SCHOOL_CLASSES } from "@/lib/catalog";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "@/lib/seo";
import {
  getAllChapterParams,
  getAllClassSubjectParams,
} from "@/lib/subject-slug";

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
    {
      url: `${SITE_URL}/guides`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}/guides/${guide.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...SCHOOL_CLASSES.map((schoolClass) => ({
      url: `${SITE_URL}/class/${schoolClass}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...getAllClassSubjectParams().map(({ class: schoolClass, subject }) => ({
      url: `${SITE_URL}/class/${schoolClass}/${subject}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
  ];

  for (const book of getAllBooks()) {
    entries.push({
      url: `${SITE_URL}/books/${book.id}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  for (const { slug, chapter } of getAllChapterParams()) {
    entries.push({
      url: `${SITE_URL}/books/${slug}/chapter/${chapter}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.55,
    });
  }

  return entries;
}
