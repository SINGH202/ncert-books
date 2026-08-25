import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ncert-books.vercel.app";

export const SITE_NAME = "NCERT Books";

export const DEFAULT_DESCRIPTION =
  "Browse and preview English-medium NCERT textbooks for Classes 9–12 in one place.";

/** Shared social preview image (favicon package 512px icon). */
export const DEFAULT_OG_IMAGE = "/icon-512x512.png";

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageSeoInput = {
  title: string;
  description: string;
  /** Path for this page (e.g. `/class/9`). */
  path: string;
  /**
   * Canonical path when it should differ from `path`
   * (e.g. `/read` pages canonicalize to the book landing page).
   */
  canonicalPath?: string;
  index?: boolean;
  follow?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  canonicalPath,
  index = true,
  follow = true,
}: PageSeoInput): Metadata {
  const canonical = absoluteUrl(canonicalPath ?? path);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index,
      follow,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 512,
          height: 512,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}
