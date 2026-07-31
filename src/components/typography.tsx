import type { ElementType, ReactNode } from "react";

type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "bodyMedium"
  | "small"
  | "li"
  | "button"
  | "link";

const variantMap: Record<
  TypographyVariant,
  { tag: ElementType; className: string }
> = {
  h1: {
    tag: "h1",
    className:
      "text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl",
  },
  h2: {
    tag: "h2",
    className: "text-xl font-semibold tracking-tight text-foreground sm:text-2xl",
  },
  h3: {
    tag: "h3",
    className: "text-base font-semibold tracking-tight text-foreground sm:text-lg",
  },
  bodyMedium: {
    tag: "p",
    className: "text-[15px] leading-6 text-foreground/80 sm:text-base sm:leading-7",
  },
  small: {
    tag: "small",
    className: "text-xs leading-5 text-muted sm:text-sm sm:leading-6",
  },
  li: {
    tag: "li",
    className: "text-[15px] leading-6 text-foreground/80 sm:text-base sm:leading-7",
  },
  button: {
    tag: "span",
    className: "text-sm font-medium",
  },
  link: {
    tag: "span",
    className:
      "text-sm font-medium text-foreground underline-offset-4 hover:underline",
  },
};

type TypographyProps = {
  variant: TypographyVariant;
  children?: ReactNode;
  className?: string;
  as?: ElementType;
  dangerouslySetInnerHTML?: { __html: string };
};

function cx(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Typography({
  variant,
  children,
  className,
  as,
  dangerouslySetInnerHTML,
}: TypographyProps) {
  const mapped = variantMap[variant];
  const Tag = as ?? mapped.tag;

  if (dangerouslySetInnerHTML) {
    return (
      <Tag
        className={cx(mapped.className, className)}
        dangerouslySetInnerHTML={dangerouslySetInnerHTML}
      />
    );
  }

  return <Tag className={cx(mapped.className, className)}>{children}</Tag>;
}
