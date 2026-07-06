// Single data accessor for the whole site. Reads live Supabase rows when configured
// (public-read RLS), otherwise the demo dataset. Every page imports from here — never
// from supabase.ts or demo.ts directly — so the live/demo switch lives in one place.
import { supabase, isLive } from './supabase';
import { DEMO_VENDORS, demoHistory, demoChangeEvents } from './demo';
import type { Vendor, ChangeEvent, PricePoint, Plan, Snapshot } from './types';

export const dataMode: 'live' | 'demo' = isLive ? 'live' : 'demo';

/** Publish gate (mirrors the farm's sanePlans): only trustworthy extractions go live. */
export function isPublishable(plans: Plan[]): boolean {
  if (!plans || plans.length === 0 || plans.length > 8) return false;
  if (!plans.every((p) => p && typeof p.name === 'string' && p.name.trim())) return false;
  const priced = plans.filter((p) => p.price != null);
  if (priced.length < 1) return false;
  if (priced.some((p) => (p.price as number) < 0 || (p.price as number) > 20000)) return false;
  const names = plans.map((p) => p.name.toLowerCase().trim());
  return new Set(names).size === names.length;
}

export interface VendorPage {
  vendor: Vendor;
  plans: Plan[];                          // latest snapshot's plans
  history: Record<string, PricePoint[]>;  // per-plan 12-mo history
  events: ChangeEvent[];                  // this vendor's change events, newest first
  lastChecked: string | null;
}

// ── live helpers ──────────────────────────────────────────────────────────
async function liveVendors(): Promise<Vendor[]> {
  const { data } = await supabase!.from('fp_vendors').select('*').eq('status', 'active').order('name');
  return (data as Vendor[]) ?? [];
}

async function liveSnapshots(vendorId: string): Promise<Snapshot[]> {
  const { data } = await supabase!
    .from('fp_snapshots')
    .select('captured_at, extracted')
    .eq('vendor_id', vendorId)
    .order('captured_at', { ascending: true })
    .limit(400);
  return (data as Snapshot[]) ?? [];
}

async function liveEvents(limit = 200): Promise<ChangeEvent[]> {
  const { data } = await supabase!
    .from('fp_change_events')
    .select('*, vendor:fp_vendors(*)')
    .order('detected_at', { ascending: false })
    .limit(limit);
  return (data as ChangeEvent[]) ?? [];
}

/** Build per-plan history from an ordered snapshot series. */
function historyFromSnapshots(snaps: Snapshot[]): Record<string, PricePoint[]> {
  const out: Record<string, PricePoint[]> = {};
  for (const s of snaps) {
    for (const plan of s.extracted?.plans ?? []) {
      (out[plan.name] ??= []).push({ date: s.captured_at, price: plan.price });
    }
  }
  return out;
}

// ── public API ────────────────────────────────────────────────────────────
export async function getVendors(): Promise<Vendor[]> {
  if (isLive) {
    const vendors = await liveVendors();
    // keep only vendors whose latest snapshot passes the publish gate
    const { data: snaps } = await supabase!
      .from('fp_snapshots').select('vendor_id, captured_at, extracted')
      .order('captured_at', { ascending: false }).limit(3000);
    const latest = new Map<string, Plan[]>();
    for (const s of (snaps as Snapshot[] & { vendor_id: string }[] ?? [])) {
      const vid = (s as any).vendor_id;
      if (!latest.has(vid)) latest.set(vid, s.extracted?.plans ?? []);
    }
    return vendors.filter((v) => isPublishable(latest.get(v.id) ?? []));
  }
  return DEMO_VENDORS.map(({ plans, history, events, ...v }) => v);
}

export async function getVendorPage(slug: string): Promise<VendorPage | null> {
  if (isLive) {
    const { data: v } = await supabase!.from('fp_vendors').select('*').eq('slug', slug).maybeSingle();
    if (!v) return null;
    const snaps = await liveSnapshots(v.id);
    const latest = snaps[snaps.length - 1];
    if (!isPublishable(latest?.extracted?.plans ?? [])) return null; // don't render un-gated data
    const { data: evs } = await supabase!
      .from('fp_change_events').select('*').eq('vendor_id', v.id).order('detected_at', { ascending: false });
    return {
      vendor: v as Vendor,
      plans: latest?.extracted?.plans ?? [],
      history: historyFromSnapshots(snaps),
      events: (evs as ChangeEvent[]) ?? [],
      lastChecked: latest?.captured_at ?? null,
    };
  }
  const dv = DEMO_VENDORS.find((x) => x.slug === slug);
  if (!dv) return null;
  const { plans, history, events, ...vendor } = dv;
  const hist: Record<string, PricePoint[]> = {};
  for (const pl of plans) hist[pl.name] = demoHistory(dv, pl.name);
  return {
    vendor,
    plans,
    history: hist,
    events: demoChangeEvents().filter((e) => e.vendor_id === dv.id),
    lastChecked: '2026-07-01T09:00:00Z',
  };
}

export async function getChangeEvents(limit = 60): Promise<ChangeEvent[]> {
  if (isLive) return liveEvents(limit);
  return demoChangeEvents().slice(0, limit);
}

/** Cheapest current price across a vendor's plans (for row/wire display). */
export function bestPrice(plans: Plan[]): Plan | null {
  const priced = plans.filter((p) => typeof p.price === 'number');
  if (!priced.length) return null;
  return priced.reduce((a, b) => ((a.price as number) <= (b.price as number) ? a : b));
}

/** Real counts computed from the data at render — never hardcode a count (DESIGN-SPEC §11). */
export async function computeStats() {
  const vendors = await getVendors();
  const events = await getChangeEvents(500);
  const categories = new Set(vendors.map((v) => v.category));
  const priceMoves = events.filter((e) => e.change_type === 'price_up' || e.change_type === 'price_down').length;
  return {
    vendorCount: vendors.length,
    categoryCount: categories.size,
    changeCount: events.length,
    priceMoveCount: priceMoves,
    mode: dataMode,
  };
}
