import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Typography } from "@/components/typography";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
        <Typography variant="h1">Page not found</Typography>
        <Typography variant="bodyMedium">
          That link does not match a class or book on this site. Browse the
          catalog from the home page, or open a class page directly.
        </Typography>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/"
            className="touch-target inline-flex items-center justify-center rounded-xl bg-foreground px-5 py-3 text-background"
          >
            <Typography variant="button" className="text-background">
              Go home
            </Typography>
          </Link>
          <Link
            href="/class/10"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-line bg-surface px-5 py-3"
          >
            <Typography variant="button">Browse Class 10</Typography>
          </Link>
        </div>
      </main>
    </div>
  );
}
