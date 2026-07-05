import { createClient } from '@supabase/supabase-js';

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // farm runs with service role; RLS covers user surface
);

export async function dueVendors(limit = 200) {
  const { data, error } = await db
    .from('vendors')
    .select('*')
    .eq('status', 'active')
    .lte('next_check_at', new Date().toISOString())
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function lastSnapshot(vendorId) {
  const { data } = await db
    .from('snapshots')
    .select('raw_hash, extracted')
    .eq('vendor_id', vendorId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function saveSnapshot(vendorId, hash, extracted, tier) {
  const { error } = await db.from('snapshots').insert({
    vendor_id: vendorId, raw_hash: hash, extracted, tier_used: tier
  });
  if (error) throw error;
}

export async function saveEvents(vendorId, changes) {
  if (!changes.length) return;
  const rows = changes.map((c) => ({
    vendor_id: vendorId,
    plan_name: c.plan_name || null,
    change_type: c.change_type,
    old_value: c.old_value || null,
    new_value: c.new_value || null,
    significance: c.significance,
    summary: c.summary
  }));
  const { error } = await db.from('change_events').insert(rows);
  if (error) throw error;
}

export async function bumpVendor(vendor, { ok, selectors }) {
  const patch = {
    next_check_at: new Date(Date.now() + vendor.check_interval_days * 864e5).toISOString(),
    consecutive_failures: ok ? 0 : vendor.consecutive_failures + 1
  };
  if (selectors) patch.selectors = selectors;               // self-heal writeback
  if (!ok && patch.consecutive_failures >= 2) patch.status = 'flagged';
  await db.from('vendors').update(patch).eq('id', vendor.id);
  return patch.status === 'flagged';
}
