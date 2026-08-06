import { track } from "@vercel/analytics";

export type AnalyticsProps = Record<string, string | number | boolean | null>;

/** Privacy-friendly custom events via Vercel Analytics (no PII). */
export function trackEvent(name: string, props?: AnalyticsProps): void {
  try {
    track(name, props);
  } catch {
    // Analytics must never break the app.
  }
}
