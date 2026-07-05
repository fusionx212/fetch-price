# fetch-price.com — MVP Build Spec & Positioning
**The price watchdog for your software stack.**
Claude Code handoff package · v1.0 · July 2026

---

## 1. Product thesis

Buyer-side SaaS pricing intelligence for SMEs and MSPs. We monitor the public pricing pages of business software vendors, keep a dated history of every change, alert subscribers when tools in their stack change price or packaging, and surface cheaper alternatives (affiliate-monetised).

Category framing: **camelcamelcamel for business software.**

Revenue model:
1. Free vendor price-history pages → SEO traffic → affiliate revenue
2. Paid watchlists (SME self-serve, £15–39/mo)
3. MSP/accountant multi-client tier (£99+/mo)
4. Later: data/API licensing

---

## 2. Architecture (existing stack, no new vendors)

```
┌─────────────────────────────────────────────────────┐
│  SCRAPE TIER (scheduled workers)                    │
│  Cloudflare Workers Cron OR VPS + node-cron         │
│  ├─ Tier 1: HTTP fetch + cheerio (cheap, ~80%)      │
│  ├─ Tier 2: Playwright headless (JS-rendered pages) │
│  └─ Tier 3: Claude API vision/extract fallback      │
│      (screenshot → structured JSON, LootLab-style   │
│       cascade: deterministic → VLM → human review)  │
├─────────────────────────────────────────────────────┤
│  DIFF ENGINE                                        │
│  Normalise → hash → compare vs last snapshot        │
│  Semantic diff via Claude API (only when hash       │
│  changes — keeps token cost near zero)              │
│  Output: change_event {vendor, plan, old, new,      │
│  change_type, significance_score, evidence}         │
├─────────────────────────────────────────────────────┤
│  DATA LAYER — Supabase (Postgres)                   │
│  vendors / plans / snapshots / change_events /      │
│  users / watchlists / renewals / affiliate_links    │
│  pgvector optional later for "similar tools"        │
├─────────────────────────────────────────────────────┤
│  DELIVERY                                           │
│  Netlify (Astro or Next SSG) — public history pages │
│  Resend — alert emails + weekly digest              │
│  Stripe — subscriptions (Starter/Pro/MSP)           │
│  Make.com — Slack/Telegram alert routing (Pro tier) │
└─────────────────────────────────────────────────────┘
```

### Scraping cascade detail
- **Tier 1 (deterministic):** fetch HTML, extract JSON-LD/microdata where present, else CSS selectors stored per-vendor in DB (`vendors.selectors` JSONB). Cost ≈ £0.
- **Tier 2 (headless):** Playwright on a small VPS (or Browserless) for Cloudflare-protected / JS-rendered pages. Only vendors flagged `requires_browser`.
- **Tier 3 (AI extract):** full-page screenshot + Claude vision → structured plan JSON. Also the self-healing layer: when a Tier 1 selector breaks, Tier 3 re-derives selectors and writes them back. This is the same three-tier QA pattern as the LootLab defect pipeline — reuse the orchestration code.
- **Cadence:** daily for top 100 vendors, 3-day for long tail. Respect robots.txt, identify UA, 1 req/vendor/day is trivially polite.

### Diff → significance scoring
Hash-change triggers semantic diff. Score 0–100:
- Price change on any plan: 90+
- Plan added/removed, seat minimums, feature moved between tiers (shrinkflation): 70–90
- Copy/FAQ changes: 30–60
- Cosmetic: <30 (logged, no alert)
Alert threshold per user (default 70).

### Data model (core tables)
```sql
vendors(id, name, slug, pricing_url, category, requires_browser,
        selectors jsonb, affiliate_url, affiliate_network, status)
plans(id, vendor_id, name, is_active)
snapshots(id, vendor_id, captured_at, raw_hash, extracted jsonb,
          screenshot_path, tier_used)
change_events(id, vendor_id, plan_id, detected_at, change_type,
              old_value jsonb, new_value jsonb, significance int,
              summary text, published bool)
users(id, email, stripe_customer_id, tier)
watchlists(id, user_id, vendor_id, alert_threshold, renewal_date,
           current_price, seats, notes)
clients(id, user_id, name)          -- MSP tier
client_watchlists(client_id, ...)   -- MSP tier
```

---

## 3. Public pages (the SEO engine)

Programmatic pages, statically generated nightly from Supabase:

- `/pricing-history/{vendor}` — chart (12–24mo), dated change log, shrinkflation flags, current plans table, 3 alternatives (affiliate), "watch this vendor" CTA.
- `/has-{vendor}-raised-prices` — question-format page targeting the exact query. Canonical to history page or standalone.
- `/compare/{vendor}-vs-{vendor}` — head-to-head with *price history* as the differentiator vs G2/Capterra.
- `/alerts` — public feed of recent detected changes (freshness signal + newsjacking source).

Launch set: 100 vendors across the SME stack — accounting (Xero, QuickBooks, Sage, FreeAgent), comms (M365, Google Workspace, Slack, Zoom), PM (Monday, ClickUp, Asana, Notion, Jira), CRM (HubSpot, Pipedrive), design (Adobe, Canva, Figma), dev/infra (GitHub, Netlify, Vercel, Cloudflare), HR/payroll (BrightHR, Deel), AI tools (OpenAI, Anthropic, Midjourney). UK-priced pages where vendors show GBP.

Schema.org `PriceSpecification` markup on every plan. OG images auto-generated per change event (chart card) for LinkedIn/X sharing.

---

## 4. Paid product

**Starter — £15/mo:** 25 watched tools, email alerts, renewal calendar, price history access, negotiation snapshot PDF ("what this vendor charged when you signed").
**Pro — £39/mo:** 100 tools, Slack/Teams/Telegram alerts, shrinkflation alerts, alternatives report per alert, CSV/API export.
**MSP — £99/mo:** unlimited clients, per-client watchlists + branded monthly "software spend & price movement" report (white-label PDF — retention gold for MSPs), team seats.
**Free:** browse all history pages, watch 3 tools, weekly digest only.

Annual = 2 months free. Stripe Checkout + customer portal, no sales calls anywhere.

---

## 5. Landing page positioning

**Hero:**
> **Your software vendors raise prices quietly. We don't.**
> Fetch-Price watches the pricing of every tool your business pays for — and tells you the moment anything changes.
> [Watch my stack — free] [Browse price histories]

**Sub-hero proof bar:** "SaaS prices rose 13% last year — 4x inflation. 79% of businesses were hit with an increase at renewal. Most found out from the invoice."

**Three-step how it works:**
1. Add your stack (or paste your invoices — we'll match the vendors)
2. We watch every pricing page, every day
3. You get the alert, the price history, and the alternatives — before renewal, not after

**Objection blocks:**
- "Isn't this what spend-management tools do?" → They track your contracts. We track the *market*. Vertice and Tropic start where your SaaS bill hits six figures; we start at £15/mo.
- "Shrinkflation too?" → Features moved to higher tiers, seat minimums, credit-rate changes — we flag packaging changes, not just headline prices.
- Negotiation angle → "Walk into renewal knowing exactly what they charged 12 months ago."

**Tone rules:** UK English, punchy, zero AI-isms, watchdog personality (dry, slightly adversarial toward vendor pricing tactics — "we read the pricing page so you don't have to"). No stock-photo corporate gloss.

---

## 6. Build order (6 sprints)

1. **Scraper core + 20 vendors** — Tier 1 only, Supabase schema, snapshots + diffs working. Prove the pipeline.
2. **History pages** — Astro SSG on Netlify, charts (Chart.js), schema markup, first 100 vendors seeded (Tier 2/3 added for the awkward ones).
3. **Alerts + auth** — Supabase Auth, free-tier watchlists, Resend digest + instant alerts.
4. **Stripe + paid tiers** — Checkout, gating, renewal calendar, negotiation PDF.
5. **Newsjacking loop** — auto-draft change posts (Claude API) queued for review → LinkedIn/X; public /alerts feed; OG chart cards.
6. **MSP tier + affiliate layer** — client management, white-label report, PartnerStack/Impact links wired into alternatives blocks.

Ship 1–3 before July's Microsoft M365 increase fully lands with SMEs at renewal — that wave is the launch story.

---

## 7. Risks & mitigations
- **SpendHound (free) / Termedora:** they're contract-side, not market-side. Don't build spend analytics; stay the watchdog.
- **SaaS Price Pulse:** closest competitor, vendor-CI framing. Win on buyer framing, UK/SME focus, alternatives + affiliate layer, MSP channel.
- **Scraping blocks:** cascade absorbs most; for hard blockers, fall back to weekly manual-assisted Tier 3 and mark data "verified weekly".
- **"Contact sales" vendors:** show last-known public pricing + crowd-sourced quote submissions (later feature — becomes unique data, see §10).

---

## 8. Automation & ops (steady-state: ~20 min/day human input)

### Scheduling
- Nightly cron: Cloudflare Worker Cron Trigger, GitHub Actions scheduled workflow, or plain cron on the Playwright VPS.
- Reads `vendors` where `next_check_at <= now()`, enqueues into a Supabase job table (`status: queued/running/done/failed`). No Redis/BullMQ needed below a few thousand vendors.
- Cadence per vendor: daily (top 100), 3-day (long tail), set via `check_interval`.

### Scrape loop (per job)
1. Tier 1 (HTTP + stored selectors) → fail or `requires_browser` → Tier 2 (Playwright) → extraction fail → Tier 3 (screenshot → Claude vision → JSON).
2. Hash extracted output vs last snapshot. **Unchanged → write snapshot, bump `next_check_at`, stop. Zero AI cost.**
3. Changed → Claude semantic diff → `change_event` with significance score.

### Self-healing
- Tier 3 re-derives CSS selectors on success and writes them back to `vendors.selectors` — next run drops to Tier 1 cost again.
- Vendor failing all tiers twice consecutively → flagged to Telegram review queue (Clawbot command pattern: `/queue`, `/approve`, `/fix`).

### Fan-out (trigger-driven, no polling)
- New `change_event` ≥ threshold fires Supabase webhook / pg_notify → Edge Function:
  - Resend instant alerts to watchers
  - Make.com → Slack/Teams/Telegram (Pro tier)
  - Claude-drafted newsjack post → review queue
  - Mark vendor page stale
- Nightly SSG rebuild of stale pages only (Netlify build hook).
- Sunday cron → weekly digest per watchlist.
- Stripe webhooks → tier gating, fully automatic.

### Monitoring
- Dead-man's switch: healthchecks.io ping from cron; missed ping = alert.
- Per-tier success-rate dashboard; alert if Tier 1 success drops (mass selector rot).

---

## 9. Affiliate signups & business outreach

### Affiliate sequencing (site first, applications second)
1. Launch with 30–50 live history pages + running /alerts feed **before applying** — programmes approve sites with visible data and freshness, reject shells.
2. **Networks:** PartnerStack (B2B SaaS bulk — Monday, ClickUp, Webflow, Freshworks…), then Impact and Awin (strong UK coverage, e.g. Sage). One account, per-programme applications inside.
3. **Direct programmes for whales:** HubSpot, Shopify, Xero, QuickBooks. Pitch line: "pricing-intelligence site with purchase-intent traffic."
4. `affiliate_links` table drives alternatives blocks: network, commission_type, cookie_window, status. Only `status = approved` links render. EPC field for later ranking tiebreaks.
5. **Integrity rule:** affiliate availability never determines *which* alternatives appear, only tiebreaks order. Disclosure line on every page. The watchdog positioning dies the moment data looks pay-to-play.

### Outreach motion
- **SMEs: inbound only.** Content/SEO acquires them passively; unit economics don't support cold outreach or paid ads at £15–39/mo.
- **Active outreach = MSPs + accountants** (1 conversion = 20–50 end clients):
  - r/msp, UK MSP communities (Tubblog, MSP Growth Hub), MSP Facebook groups — lead with free history pages, product second.
  - Accountants: Xero/QuickBooks advisor directories, AccountingWEB. Pitch = white-label client report, not the tool.
  - LinkedIn direct: always event-triggered, never generic ("Microsoft's July increase hits your M365 clients at next renewal — here's the per-seat delta").
- **Newsjack loop = outbound trigger engine.** Every significant change_event spawns: public post + Claude-drafted, human-approved outreach batch to MSPs/accountants whose clients likely use that vendor.
- **First 10 conversations:** Dale's own MSP/FinTech network → validation interviews → design partners on lifetime discount.
- **Early metric: replies, not signups.** If event-triggered messages get responses, the channel works; the rest is volume.

---

## 10. ClipperWorkspace integration (SPRINT 6+ ONLY — do not pull forward)

Fetch-Price sprints 1–5 have **zero dependency** on Clipper. Integration lands only once the MSP tier exists.

### 10.1 Capture layer for the hard 20%
- Clipper extension/bookmarklet clips logged-in pages from the user's own browser session — a capture path server-side scraping can't reach (billing portals, renewal quotes, partner pricing, "contact sales" quotes).
- Flow: "Clip your renewal quote to Fetch-Price" → Clipper posts clip payload to a Fetch-Price webhook → parsed (Claude extract) → stored as `snapshot {source: 'user_clip', verified: manual}`.
- Result: crowdsourced non-public pricing dataset — the SpendHound/YipitData-style asset nobody in the SME segment holds. Anonymise and aggregate before any public display.

### 10.2 Delivery layer for the MSP report
- Replace/augment the white-label PDF with a Clipper-style live branded page: MSP brand kit applied, change-event cards auto-populated per client from Fetch-Price data, trackable link with open analytics.
- Implementation: MSP report = a Clipper board whose cards are generated from `change_events` joined to `client_watchlists`, rendered through Clipper's existing brand-kit + publish + tracking engine.
- Validate first: ask the 10 design-partner MSPs whether they want a live branded page or a PDF attachment. Build whichever they'll forward to clients.

### 10.3 Outreach one-pagers
- Event-triggered outreach links to a Clipper-generated branded page ("Microsoft July change — cost impact for a 25-seat client") instead of text walls. Open tracking identifies warm prospects for follow-up.

### 10.4 Shared services principle
- Both products want the same primitives: capture engine, brand rendering, published trackable pages. Expose Clipper's clip ingestion + page publishing as internal APIs/webhooks; Fetch-Price is a consumer, not a fork. No duplicated code, no coupled deploys.

---

## 11. Category roadmap — "everything your business pays for"

| Phase | Category | Treatment | Why |
|-------|----------|-----------|-----|
| Sprint 1–4 | **SaaS / software** | Full product | Most scrapeable, clearest market gap, Dale's credibility zone |
| Sprint 5–6 | **Broadband / telecoms / mobile (business)** | Full product — same pipeline, new vendor rows | Public list pricing; Ofcom now requires pounds-and-pence mid-contract rises stated upfront → "we tell you exactly when your rise lands and what it costs" |
| Sprint 6+ | **Business energy (gas/electric)** | Content + referral ONLY (see 11.1) | Big commissions but quote-based pricing + incoming regulation |
| Content only | **Water (England, deregulated)** | History/guide pages | Low savings, low engagement — SEO surface, not product |
| Never in-house | **Insurance** | Link out only | FCA-regulated intermediation — do not touch |

Brand asset = the watchdog, not the vertical. Each category reuses scraper → diff → alert → history-page pipeline and extends the MSP/accountant report ("software + connectivity + energy renewals on one page").

### 11.1 Energy guardrails — watch and refer, never broker
- Context: broker commissions run 0.3–2p/kWh (£500–£7,500+ per SME contract); complaints up 112% (88% sales-practice related); only 52 of 2,700+ brokers signed the voluntary TPI Code; Ofgem becomes direct TPI regulator (market survey 2026, registration ~2027, enforcement ~2028) and **price comparison services are in scope**.
- Fetch-Price's role: track published tariffs + wholesale-linked trend context, renewal-window alerts, commission-transparency education ("demand your broker's uplift in writing"), watchdog content.
- Monetisation: lead-gen referral to 1–2 vetted brokers who are TPI Code signatories, fee-transparent, Energy Ombudsman registered. Written referral agreement, commission disclosed on-site.
- Hard lines: never arrange contracts, never present supplier quotes as recommendations, never take supplier commission directly, revisit scope when Ofgem authorisation regime lands.
- Same logic, stricter, for insurance: affiliate links to FCA-authorised comparison services only, zero advice.

---

## 12. Local-infrastructure automation (Hermes farm + Clawbot + Claude Code)

Runs on Dale's existing local stack. Cloud services only where they already exist (Supabase, Netlify, Resend, Stripe).

### 12.1 AI routing — Hermes-first, Claude fallback (Clawbot hybrid pattern)
- **Ollama/Hermes handles:** semantic diff summaries, significance assists, newsjack post drafts, selector re-derivation from HTML text. Free, local, PII-irrelevant.
- **Claude API handles:** vision extraction from screenshots (Tier 3), anything Hermes fails confidence checks on, final-copy polish. Escalation is automatic: Hermes output validated against JSON schema → invalid/low-confidence → Claude.
- Config via `AI_PRIMARY=ollama`, `AI_FALLBACK=claude` in .env — same envs Clawbot uses.

### 12.2 Scheduling on the farm
- systemd timer (or crontab) on the Hermes box: nightly scrape run, Sunday digest run, hourly queue-drain for retries.
- healthchecks.io ping at end of each run — missed ping alerts Telegram.
- Playwright lives on the same box (Tier 2) — no external browserless dependency.

### 12.3 Ops via Telegram (Clawbot command surface)
- Scraper failures (2 consecutive all-tier fails) → Telegram message with vendor, error, screenshot.
- Newsjack drafts → Telegram with `approve/skip` reply handling (reuse Clawbot's command router; suggested commands: `/fpqueue`, `/fpapprove <id>`, `/fpskip <id>`, `/fpstatus`).
- Daily one-line status: vendors checked, changes found, tier breakdown, cost.

### 12.4 Division of labour
- **Local (farm):** scraping, diffing, AI drafting, ops bot.
- **Supabase:** state, auth, webhooks → Edge Function fan-out (Resend alerts) so user-facing alerts fire even if the farm is mid-run.
- **Netlify:** SSG rebuild via build hook, called by the farm after each run that produced changes.
- **VS Code / Claude Code:** development surface; repo ships with CLAUDE.md handoff + `skills/fetch-price.skill.md` for Hermes context injection.

