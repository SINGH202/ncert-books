export function controlButtonClassName(extra?: string): string {
  return [
    "touch-target inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-2 disabled:opacity-40",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
