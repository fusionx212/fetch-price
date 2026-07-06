import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Build-time reads only — the public site is fully static (SSG), so there is no
// client-side Supabase usage. That means we can safely use the service_role key at
// BUILD time (it never ships to the browser as long as it is not PUBLIC_-prefixed and
// not referenced in client code). Preference: service_role (reliable) → anon. When no
// key is configured the site falls back to the demo dataset (see data.ts) so it still
// builds and deploys before the DB is wired.
const url =
  import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceKey =
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

const key = serviceKey || anonKey;
export const isLive = Boolean(url && key);

export const supabase: SupabaseClient | null = isLive
  ? createClient(url as string, key as string, { auth: { persistSession: false } })
  : null;
