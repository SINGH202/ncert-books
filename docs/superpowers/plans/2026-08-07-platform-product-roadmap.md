# NCERT Books — Platform & Product Roadmap

> **For agentic workers:** Execute phase-by-phase. Prefer small PRs to `main`. After Phase A, add analytics before large feature bets so decisions are data-backed.

**Goal:** Stabilize and observe the live product, then ship high-impact user features in a clear order.

**Live:** https://ncert-books.vercel.app/  
**Scope today:** Classes 9–12, English-medium, official NCERT PDFs via allowlisted proxy (no hosting).

**Architecture:** Next.js App Router + static `data/catalog.json` + `/api/pdf` proxy + client PDF.js reader with IndexedDB/HTTP cache.

---

## Guiding principles

1. **Platform before features** — reliability, freshness, observability first.
2. **Ship thin vertical slices** — each PR should be usable alone.
3. **Privacy-first analytics** — no cookie banners if we can avoid personal tracking.
4. **Stay legally conservative** — stream/proxy only; attribute NCERT; don’t redistribute files.

---

## Phase A — Platform improvements (ship first)

Order matters: do these before net-new product features.

| Order | Work item | Why | Outcome | Est. |
| --- | --- | --- | --- | --- |
| A1 | Sync local `main` / confirm production matches PR #3 | Avoid building on stale code | Dev = prod | 0.5d |
| A2 | Weekly catalog sync (GitHub Action → PR or commit) | Catalog goes stale; books change | Fresh catalog without manual runs | 1d |
| A3 | Catalog quality: omit/soft-fail Prelims 404s; realer section counts | Inflated “sections”, wasted first-load races | Cleaner browse + faster first chapter | 1–2d |
| A4 | Proxy hardening: structured logging, rate-ish guardrails, clearer 502/404 | Debug NCERT flakiness; protect origin | Operable proxy | 1d |
| A5 | Reader reliability pass: first-page paint, chapter remap, error retry UX | Trust is the product | Fewer blank/wrong-page reports | 1–2d |
| A6 | Cache hygiene: IDB size awareness / simple eviction of oldest PDFs | Quota silent-fail on mobile | Stable reopens | 1d |
| A7 | SEO basics: per-book `generateMetadata`, `sitemap.ts`, `robots.ts` | Free discovery | Indexable book pages | 0.5–1d |
| A8 | Minimal smoke checks: proxy allowlist unit test + Playwright “open a book” | Catch regressions | CI confidence | 1–2d |

**Phase A exit criteria**

- [ ] Catalog refreshes on a schedule
- [ ] First open of a typical Class 10 book shows page 1 reliably
- [ ] Reopen of a cached chapter feels clearly faster
- [ ] Book pages have unique titles/descriptions
- [ ] One automated happy-path check in CI

**Do not start major features until A2–A5 are done.**

---

## Phase B — Free user-behavior analytics (after A, before big features)

### What we need to learn

| Question | Metric / event |
| --- | --- |
| Who arrives? | Visitors, countries, devices, referrers |
| What do they open? | `/`, `/class/[n]`, `/books/[slug]`, `/books/[slug]/read` |
| Do they actually read? | `reader_open`, time on read page, fullscreen enter |
| Where do they struggle? | `reader_error`, `pdf_proxy_fail` (status), exit after &lt;10s on read |
| What should we build next? | Top books/classes, search usage (once shipped), chapter jumps |

### Recommended free stack (pick 1 primary + optional events)

| Option | Cost | Best for | Limits |
| --- | --- | --- | --- |
| **Vercel Analytics + Speed Insights** (if plan allows free tier) | Free on hobby (check current limits) | Page views + Web Vitals on Vercel | Light on custom events |
| **Cloudflare Web Analytics** | Free | Privacy-friendly traffic if DNS on CF | Needs CF in front or beacon snippet |
| **GoatCounter** (hosted free for reasonable non-commercial use) | Free | Simple pageviews, referrers, paths | Limited custom events |
| **Umami Cloud free tier / self-host** | Free tier or free self-host | Pageviews + custom events | Self-host = ops cost |
| **PostHog free cloud** | Generous free events | Product events/funnels | Heavier; review privacy defaults |

**Recommendation for this app (practical + free):**

1. **Primary traffic:** Vercel Analytics (already on Vercel) *or* GoatCounter / Cloudflare Web Analytics for privacy-first pageviews.
2. **Product events (lightweight):** PostHog free **or** Umami custom events — only a handful of events (see list below). Avoid Google Analytics unless you accept cookie consent complexity.

### Events to instrument (minimal)

```text
pageview                 # automatic via chosen tool
book_open                # book detail viewed { class, subject, bookId }
reader_open              # read page mounted { bookId }
reader_ready             # first page painted { bookId, ms_to_ready }
reader_error             # { bookId, reason }
fullscreen_enter         # { bookId }
search_used              # { bookId, has_results }  (after search ships in non-FS or FS)
catalog_filter_used      # once browse search ships
```

No PII. No user IDs. Prefer aggregate paths + bookId only.

### Phase B exit criteria

- [ ] Dashboard shows daily visitors and top pages
- [ ] Can answer: top 5 books opened this week
- [ ] Can see share of visits that reach `/read`
- [ ] Privacy note in README / footer (“privacy-friendly analytics, no ads”)

---

## Phase C — Features (implementation order)

Ship in this order. Each item is one PR-sized slice where possible.

### Wave 1 — Discovery (highest user value)

| Order | Feature | Depends on | Ship note |
| --- | --- | --- | --- |
| C1 | **Browse search / filter** (title, subject, class) using `useDebouncedValue` | A7 optional | ✅ Home + class pages |
| C2 | **Real chapter titles** in catalog sync | A2, A3 | Biggest catalog upgrade |
| C3 | **Reader chrome parity** — chapter jump + find available without fullscreen (desktop); keep rail on mobile FS | A5 | Reduces “hidden” features |

### Wave 2 — Reading quality

| Order | Feature | Depends on | Ship note |
| --- | --- | --- | --- |
| C4 | Search UX: progress (“Searching…” / loaded-chapters only) + cancel | B events optional | Prevents “broken search” feeling |
| C5 | Clearer loading states (“Opening chapter…”, background chapters progress) | A5 | Trust during slow NCERT |
| C6 | Optional **Continue reading** (opt-in or soft prompt) — reintroduce progress store carefully | B: measure if users bounce mid-book | Only if data shows need |

### Wave 3 — Reach & polish

| Order | Feature | Depends on | Ship note |
| --- | --- | --- | --- |
| C7 | Hindi (or second medium) for 9–12 | A2 sync redesign | Doubles audience; harder scrape |
| C8 | Classes 6–8 or 1–5 (phased) | C7 patterns | Scope control |
| C9 | PWA / installable “offline chapters you’ve opened” | A6 | True offline shell |
| C10 | Continuous scroll / multi-page view | Large reader rewrite | Don’t start early |

### Explicitly later / maybe never

- Self-hosting textbook files (legal risk)
- Accounts / social (ops + privacy cost)
- Heavy GA4 without consent strategy

---

## Suggested calendar (indicative)

| Week | Focus | Ship |
| --- | --- | --- |
| 1 | A1–A5 | Reliability + catalog schedule |
| 2 | A6–A8 + **Phase B analytics** | Observable baseline |
| 3 | C1–C2 | Search + real titles |
| 4 | C3–C5 | Reader UX polish |
| 5+ | Data review → C6 / C7 | Resume only if needed; then language expansion |

---

## How to use analytics to prioritize

After 1–2 weeks of Phase B data:

1. If **&lt;30%** of book-page views reach `/read` → fix CTAs / load speed (A5, C5), not new languages.
2. If **top books** cluster in one class/subject → feature that path first (filters, SEO).
3. If **reader_error** rate high → proxy/cache work before features.
4. If users **fullscreen + search** often → invest in C3/C4.
5. If many **single-page bounces on `/read`** → first-paint and NCERT failure messaging.

---

## First concrete PR after this plan

1. Confirm production = latest `main` (includes faster load + page-1 always).
2. ~~Add weekly `sync:catalog` workflow.~~
3. ~~Add GoatCounter **or** Vercel Analytics + 3 custom events (`book_open`, `reader_open`, `reader_ready`).~~

**Shipped in `feature/platform-analytics-seo`:** weekly catalog Action, Vercel Analytics + Speed Insights, SEO sitemap/robots/metadata, core events.

Then start **C1 Browse search**.
