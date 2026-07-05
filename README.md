# fetch-price

**The price watchdog for everything your business pays for.**

Nightly pipeline: scrape vendor pricing pages → diff vs history → store change
events in Supabase → alert watchers → publish public price-history pages.
Runs on the local Hermes farm; AI routing is Ollama-first with Claude fallback.

## Setup (15 minutes)

1. **Supabase** — new project → SQL editor → run `supabase/schema.sql`.
   Grab URL + service-role key.
2. **Local** —
   ```bash
   npm i && npm run playwright:install
   cp .env.example .env   # fill Supabase, Ollama, Anthropic, Telegram
   npm run seed
   node src/index.js --vendor=xero   # smoke test one vendor
   node src/index.js                 # first full baseline run
   ```
   First run only baselines (no events); changes appear from run two onward.
3. **Automation** — copy `automation/systemd/*` to `/etc/systemd/system/`,
   `sudo systemctl enable --now fetch-price.timer`. Or use
   `automation/crontab.example`. Add a healthchecks.io URL to `.env`.
4. **Ops bot** — point `TELEGRAM_BOT_TOKEN` at the Clawbot bot (or a new one)
   and wire the `/fp*` commands per `CLAUDE.md`.

## Repo map
```
src/index.js          orchestrator (nightly run)
src/scraper/          tier1 (http+cheerio) · tier23 (playwright + AI) · cascade
src/ai/               ollama/claude router + prompts
src/diff/             normalise, hash gate, semantic diff, significance rules
src/ops/telegram.js   flagged vendors, newsjack drafts, daily status
src/db.js             supabase data layer
supabase/schema.sql   full schema + RLS
seeds/                20 launch vendors + seed script
automation/           systemd units + crontab
skills/               Hermes context injection file
CLAUDE.md             Claude Code handoff (read first)
```

Product spec (positioning, pricing, sprints, guardrails): `fetch-price-mvp-spec.md`.
