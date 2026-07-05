-- fetch-price.com — Supabase schema v1
-- All tables carry the fp_ prefix so they coexist in a shared Supabase project
-- without colliding with other estate apps. Run in the Supabase SQL editor.
-- RLS enabled on user-facing tables.

create extension if not exists pgcrypto;

-- ── Vendors & pricing data ────────────────────────────────────────────
create table fp_vendors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  category      text not null default 'saas',          -- saas | broadband | telecoms | energy | water
  pricing_url   text not null,
  currency      text not null default 'GBP',
  requires_browser boolean not null default false,      -- force Tier 2
  selectors     jsonb,                                  -- Tier 1 CSS selectors, self-healed by Tier 3
  affiliate_url text,
  affiliate_network text,                               -- partnerstack | impact | awin | direct
  affiliate_status text not null default 'none',        -- none | applied | approved
  check_interval_days int not null default 1,
  next_check_at timestamptz not null default now(),
  consecutive_failures int not null default 0,
  status        text not null default 'active',         -- active | flagged | paused
  created_at    timestamptz not null default now()
);

create table fp_plans (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references fp_vendors(id) on delete cascade,
  name       text not null,
  is_active  boolean not null default true,
  unique (vendor_id, name)
);

create table fp_snapshots (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references fp_vendors(id) on delete cascade,
  captured_at  timestamptz not null default now(),
  raw_hash     text not null,
  extracted    jsonb not null,          -- normalised {plans:[{name,price,period,unit,features[]}]}
  screenshot_path text,
  tier_used    smallint not null,       -- 1 | 2 | 3
  source       text not null default 'scraper'  -- scraper | user_clip
);
create index fp_snapshots_vendor_time on fp_snapshots (vendor_id, captured_at desc);

create table fp_change_events (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references fp_vendors(id) on delete cascade,
  plan_name     text,
  detected_at   timestamptz not null default now(),
  change_type   text not null,          -- price_up | price_down | plan_added | plan_removed |
                                        -- shrinkflation | packaging | copy | cosmetic
  old_value     jsonb,
  new_value     jsonb,
  significance  int not null,           -- 0–100
  summary       text not null,
  published     boolean not null default false,
  newsjack_status text not null default 'none'  -- none | drafted | approved | posted | skipped
);
create index fp_change_events_time on fp_change_events (detected_at desc);
create index fp_change_events_vendor on fp_change_events (vendor_id, detected_at desc);

-- ── Job queue (simple, Supabase-backed) ──────────────────────────────
create table fp_scrape_jobs (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references fp_vendors(id) on delete cascade,
  status      text not null default 'queued',   -- queued | running | done | failed
  attempts    int not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index fp_scrape_jobs_status on fp_scrape_jobs (status, created_at);

-- ── Users & watchlists ────────────────────────────────────────────────
-- auth handled by Supabase Auth; this profile row extends it
create table fp_profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  tier               text not null default 'free',   -- free | starter | pro | msp
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

create table fp_watchlists (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references fp_profiles(id) on delete cascade,
  vendor_id       uuid not null references fp_vendors(id) on delete cascade,
  alert_threshold int not null default 70,
  renewal_date    date,
  current_price   numeric,
  seats           int,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (user_id, vendor_id)
);

-- MSP tier
create table fp_clients (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references fp_profiles(id) on delete cascade,
  name     text not null
);

create table fp_client_watchlists (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references fp_clients(id) on delete cascade,
  vendor_id  uuid not null references fp_vendors(id) on delete cascade,
  renewal_date date,
  seats      int,
  unique (client_id, vendor_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table fp_profiles enable row level security;
alter table fp_watchlists enable row level security;
alter table fp_clients enable row level security;
alter table fp_client_watchlists enable row level security;

create policy "own profile"    on fp_profiles   for all using (auth.uid() = id);
create policy "own watchlist"  on fp_watchlists for all using (auth.uid() = user_id);
create policy "own clients"    on fp_clients    for all using (auth.uid() = user_id);
create policy "own client wl"  on fp_client_watchlists for all
  using (client_id in (select id from fp_clients where user_id = auth.uid()));

-- fp_vendors / fp_snapshots / fp_change_events are public-read (history pages), service-role write
alter table fp_vendors enable row level security;
alter table fp_snapshots enable row level security;
alter table fp_change_events enable row level security;
create policy "public read vendors"  on fp_vendors       for select using (true);
create policy "public read snaps"    on fp_snapshots     for select using (true);
create policy "public read events"   on fp_change_events for select using (true);

-- ── Webhook trigger: significant change → Edge Function fan-out ──────
-- Configure a Database Webhook in Supabase Studio on fp_change_events INSERT
-- filtered client-side in the Edge Function by significance >= threshold.
