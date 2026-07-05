# CLAUDE.md — fetch-price.com

## What this is
The price watchdog for everything a business pays for. Scrapes vendor pricing
pages nightly, diffs against history, stores change events, alerts subscribers,
publishes public price-history pages. Full product spec: see
`fetch-price-mvp-spec.md` (12 sections — read §2 architecture, §8 automation,
§11 category roadmap, §12 local infra before changing anything).

## Owner conventions (Dale)
- UK English everywhere, including copy and comments.
- Output-first: deployable code over scaffolding. No placeholder functions
  without a `// SPRINT-N` marker.
- Stack is fixed: Supabase, Netlify, Resend, Stripe, Cloudflare, Make.com,
  Ollama/Hermes local + Claude API fallback. Do not introduce new vendors.
- Copy tone: dry watchdog, factual, dated figures, no AI-isms, no emojis,
  no exclamation marks.

## Architecture in one paragraph
`src/index.js` runs nightly via systemd timer on the Hermes farm. For each due
vendor: cascade (`src/scraper/`) tries Tier 1 (HTTP+cheerio+JSON-LD/selectors),
Tier 2 (Playwright render), Tier 3 (Hermes text-extract → Claude vision).
Tier 3 self-heals Tier 1 selectors and writes them back. `src/diff/diff.js`
hash-gates then semantic-diffs via `src/ai/client.js` (Hermes-first, Claude
fallback — validate JSON, escalate on failure). Events land in Supabase
`change_events`; significance ≥80 triggers a newsjack draft to Telegram for
approval. Supabase webhook → Edge Function handles user alert fan-out (Resend).
Netlify build hook regenerates static history pages when changes occurred.

## Invariants — do not break
1. Hash gate before any AI call in the diff path (cost control).
2. Selector self-heal writeback must never overwrite with null.
3. `consecutive_failures >= 2` → vendor flagged + Telegram notify, never silent.
4. Newsjack posts are DRAFTS — human approves via Telegram. Never auto-post.
5. Energy category: content + referral only. Never quote, arrange, or recommend
   energy contracts (Ofgem TPI regulation — spec §11.1).
6. Affiliate links never determine which alternatives appear, only order ties.
7. Scraper politeness: 1 req/vendor/day, identified UA, respect robots.txt.

## Build order (remaining)
- SPRINT-2: Astro site on Netlify — /pricing-history/{slug} pages from
  Supabase, Chart.js history chart, PriceSpecification schema markup, OG cards.
- SPRINT-3: Supabase Auth (magic link), free watchlists, Resend instant alerts
  (Edge Function on change_events webhook), weekly digest (`src/alerts/digest.js`).
- SPRINT-4: Stripe Checkout + tiers (free/starter £15/pro £39/msp £99),
  renewal calendar, negotiation PDF.
- SPRINT-5: newsjack posting flow completion; broadband/telecoms vendor rows.
- SPRINT-6: MSP client tables UI, white-label report, affiliate link wiring,
  ClipperWorkspace webhook ingestion (spec §10) — NOT before sprint 6.

## Commands
```
npm i && npm run playwright:install
cp .env.example .env        # fill in
npm run seed                # load seeds/vendors.json
node src/index.js --vendor=xero   # single-vendor test
node src/index.js                 # full run
```

## Telegram ops (wire into Clawbot router)
/fpstatus · /fpqueue · /fpapprove <event_id> · /fpskip <event_id> · /fpretry <slug>
Handlers should hit Supabase directly (`fp_change_events.newsjack_status`,
`fp_vendors.status`). Send-side already implemented in `src/ops/telegram.js`.
