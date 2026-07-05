import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Build-time reads only. vendors / snapshots / change_events are public-read (RLS
// policies in schema.sql), so the anon key is sufficient and safe to expose. When
// the env is absent the site falls back to the demo dataset (see data.ts) so it
// renders and deploys before the DB is wired.
const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

export const isLive = Boolean(url && anon);

export const supabase: SupabaseClient | null = isLive
  ? createClient(url as string, anon as string, { auth: { persistSession: false } })
  : null;
