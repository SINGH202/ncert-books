import { Typography } from "@/components/typography";
import type { FaqItem } from "@/lib/seo-content";

type FaqSectionProps = {
  items: FaqItem[];
  heading?: string;
};

export function FaqSection({
  items,
  heading = "Frequently asked questions",
}: FaqSectionProps) {
  return (
    <section className="space-y-3">
      <Typography variant="h2">{heading}</Typography>
      <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {items.map((item) => (
          <div key={item.question} className="space-y-2 px-4 py-4">
            <Typography variant="h3" as="dt" className="text-[15px] sm:text-base">
              {item.question}
            </Typography>
            <Typography variant="bodyMedium" as="dd" className="text-foreground/80">
              {item.answer}
            </Typography>
          </div>
        ))}
      </dl>
    </section>
  );
}
