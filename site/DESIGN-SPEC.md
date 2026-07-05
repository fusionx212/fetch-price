# FETCH-PRICE (B2B) — DESIGN-SPEC v1

> Inherited verbatim from the approved "Price Wire" identity (consumer fetch-price.com,
> authored via web-design-craft). This B2B build re-points the *content* from retail products
> to business-software vendors; the *design language is unchanged*. Components consume ONLY the
> tokens in §2 — never a raw hex. Do not restyle without editing this file first.

## 0. What changed from the consumer spec (content only)

| Consumer (Price Wire) | B2B (this build) |
|---|---|
| Retail product (DEWALT drill) | SaaS vendor plan (Slack Pro, per seat/mo) |
| Retailers compared (Amazon, B&Q) | Plan tiers + alternatives (affiliate) |
| Verticals (pets, tools, tyres) | Categories (SaaS, broadband, telecoms) |
| "checked 14:32" freshness | identical — "checked 14:32", daily cadence |
| Wire: `DEWALT −12% · £89.00 ▾` | Wire: `SLACK Pro +11% · £8.75/seat ▲ · checked 14:32` |
| Alert: "when the DCD796 drops below £85" | Alert: "when Slack changes price or packaging" |

Everything below is the inherited contract. Rise = price up = **bad for the buyer** (red).
Drop = price down = **good** (green). Same semantics, same restraint.

## 1. North star
**"The Price Wire."** A live market desk for what a business pays — the calm, data-dense trust of a
financial terminal in warm plain-English. A **monitoring instrument, not a catalogue**: every number
carries its freshness, every claim its evidence. Voice = the watchdog: dry, factual, brings the
receipts. The swap-the-logo test: G2/Capterra/Vertice could NOT ship this — live-ness IS the design
language (freshness stamps, pulse states, mono price wire) on a warm editorial base, not a cold grid.

## 2. Tokens (light, warm)
Never pure `#fff`/`#000`. Neutrals are warm stone, saturated toward copper.
```css
:root {
  --color-paper:#f7f3ec; --color-surface-lowest:#efe9de; --color-surface-low:#f3eee5;
  --color-surface:#faf7f1; --color-surface-high:#fffdf8;
  --color-ink:#211d19; --color-ink-2:#5c554c; --color-ink-3:#918777;
  --color-accent:#b4550a; --color-on-accent:#fff6ec;
  --color-accent-container:#f6e5d2; --color-on-accent-container:#7a3906;
  --color-drop:#1a7a3d; --color-drop-container:#e2f0e4;   /* price DOWN — good */
  --color-rise:#b3261e; --color-rise-container:#f7e3e0;   /* price UP — bad   */
  --color-hairline:rgb(33 29 25 / 0.12);
  --category-accent:var(--color-accent);  /* saas:copper · broadband:#33556e steel · telecoms:#3f3f46 graphite */
}
```

## 3. Type — Fraunces display · Geist workhorse · Geist Mono data
Two families + mono. **Inter is banned.** All numerals `font-variant-numeric:tabular-nums`.
- display-xl: Fraunces 600, `clamp(2.75rem,6.5vw,5.25rem)` / −0.02em / 1.04
- headline-lg: Fraunces 600, 32 / −0.01em / 1.15
- headline-md: Geist 600, 22 / −0.01em / 1.2
- body-lg: Geist 400, 18 / 1.55, prose `max-width:65ch`
- body-md: Geist 400, 16 / 1.5
- label: Geist 500, 13 / +0.07em / caps
- **data: Geist Mono 500, 15–20 / 1.3 — every price, delta, timestamp, count.** Prices right-aligned.

## 4–6. Elevation / shape / spacing
Two-part ambient shadows, 3 levels (`--shadow-1/2/3`). No glow/glass/gradient/dark-theme.
Radius: buttons/inputs/chips 6 · cards/rows 10 · hero/modal 14 · thumbs 4 · wire/rules 0.
4px base spacing; section gap 96/64; sections alternate paper→surface-lowest→paper.

## 7. Signature moves (exactly two)
1. **The Wire** — full-bleed hairline strip under the nav, every page. Real `change_events` ticking in
   mono: `SLACK Pro +11% · £8.75/seat ▲ · checked 14:32`. Drop=green, rise=red. No data → no strip.
2. **The hero IS the instrument** — no marketing hero. Display headline cols 1–7; a real live vendor
   comparison card (real vendor, plan rows, mono prices, 12-mo sparkline, freshness stamp) cols 7–12,
   overlapping the headline band ~48px with shadow-3. The data proves itself above the fold.

## 8. Core molecule — the vendor/plan row
thumb-free. vendor name (body-md) · plan (label) · category (label, ink-3) · 12-mo sparkline
(hairline, rise/drop tint on last segment) · current price (data 18, right) · delta chip
(rise/drop-container, data 13) · freshness (label, ink-3). Best/most-changed row: accent-container
tint — the ONE Von-Restorff highlight per table.

## 11. Do / Don't (hard rules — unchanged)
- DO state real numbers computed from data at render (`computeStats()`); never hardcode a count.
- DON'T reveal the mechanism: never "scrape"/proxy/AI/LLM/agent/"zero cost". Say "check"/"update".
  Naming vendors is fine; naming *how we get data* arms competitors and antagonises vendors.
- DON'T emoji, icon fonts, decoration, gradient, glass, dark theme, "coming soon" skeletons.
- DO show a freshness stamp beside every price, always.

## 12. Gate
Playwright desktop + 390px, zero console errors, no hidden CTAs, screenshots reviewed before "done".
