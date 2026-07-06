-- fetch-price — email capture / watch list. Anonymous, low-friction (no account needed):
-- the public form inserts directly via the anon key; RLS allows INSERT only (write-only
-- capture, no read/update/delete for the public). The farm (service_role) reads them to
-- send alerts. Run in the Supabase SQL editor for project zfinuyrubvqkexihgszz.

create table fp_watches (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  vendor_slug    text,                                   -- null = whole stack / any change
  source         text not null default 'site',
  confirmed      boolean not null default true,
  unsub_token    uuid not null default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  last_alerted_at timestamptz,
  unique (email, vendor_slug)
);
create index fp_watches_vendor on fp_watches (vendor_slug);

alter table fp_watches enable row level security;

-- public can SUBSCRIBE (insert) but not read/update/delete. Service role bypasses RLS.
create policy "anon subscribe" on fp_watches for insert to anon with check (email is not null);
