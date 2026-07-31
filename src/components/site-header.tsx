import Link from "next/link";
import { Typography } from "@/components/typography";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/95 pt-[var(--safe-top)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="min-w-0 no-underline">
          <Typography variant="h3" className="truncate text-base sm:text-lg">
            NCERT Books
          </Typography>
        </Link>
        <a
          href="https://ncert.nic.in/textbook.php"
          target="_blank"
          rel="noopener noreferrer"
          className="touch-target inline-flex shrink-0 items-center justify-center rounded-md px-2"
        >
          <Typography variant="link" className="whitespace-nowrap text-xs sm:text-sm">
            Official NCERT
          </Typography>
        </a>
      </div>
    </header>
  );
}
