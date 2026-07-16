/**
 * Match pipeline intelligence to subscriber profiles.
 * Research pattern: ICP filter + rank + dedupe sent (Signara, LaunchRegister, WA Business Alerts).
 */

export const TRADE_SLUGS = new Set([
  "construction",
  "plumbing-heating",
  "electrical",
  "haulage",
  "motor-trade",
]);

export const REGION_SLUGS = new Set([
  "uk-all",
  "east-midlands",
  "east-of-england",
  "london",
  "north-east",
  "north-west",
  "south-east",
  "south-west",
  "west-midlands",
  "yorkshire-humber",
  "scotland",
  "wales",
  "northern-ireland",
]);

const LEAD_SELECT =
  "id, company_number, industry_slug, region_slug, quality_tier, quality_score, quality_signals, created_at, sold_at, tle_companies(company_name, incorporated_on, company_status, registered_address, sic_codes)";

export function normalizeProfile(input = {}) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const industry_slug = TRADE_SLUGS.has(input.industry_slug) ? input.industry_slug : null;
  const region_slug = REGION_SLUGS.has(input.region_slug) ? input.region_slug : "uk-all";
  const asset_interests = Array.isArray(input.asset_interests)
    ? input.asset_interests.filter(Boolean)
    : [];
  return {
    email,
    industry_slug,
    region_slug,
    asset_interests,
    delivery_cadence: input.delivery_cadence || "weekly",
    is_free_list: Boolean(input.is_free_list),
  };
}

export function applyLeadFilters(q, profile) {
  if (profile.industry_slug) q = q.eq("industry_slug", profile.industry_slug);
  if (profile.region_slug && profile.region_slug !== "uk-all") {
    q = q.eq("region_slug", profile.region_slug);
  }
  return q;
}

export async function fetchMatchedLeads(sb, profile, { tier = "gold", limit = 10, unsoldOnly = true } = {}) {
  let q = sb.from("tle_leads").select(LEAD_SELECT).order("quality_score", { ascending: false }).limit(limit);
  if (unsoldOnly) q = q.is("sold_at", null);
  if (tier !== "all") q = q.eq("quality_tier", tier);
  q = applyLeadFilters(q, profile);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function filterUndelivered(sb, email, deliveryType, entityType, rows, idField = "company_number") {
  if (!rows.length) return [];
  const ids = rows.map((r) => String(r[idField]));
  const { data: sent } = await sb
    .from("tle_delivery_log")
    .select("entity_id")
    .eq("email", email)
    .eq("delivery_type", deliveryType)
    .eq("entity_type", entityType)
    .in("entity_id", ids);
  const sentSet = new Set((sent || []).map((r) => r.entity_id));
  return rows.filter((r) => !sentSet.has(String(r[idField])));
}

export function formatLocality(registered_address) {
  if (!registered_address || typeof registered_address !== "object") return null;
  const locality = registered_address.locality || registered_address.address_line_1;
  const pc = registered_address.postal_code || registered_address.postcode;
  if (locality && pc) return `${locality} · ${pc}`;
  return locality || pc || null;
}

export function whyMatched(lead) {
  const signals = lead.quality_signals || [];
  const parts = [];
  if (signals.includes("incorporated_within_7d")) parts.push("new this week");
  if (signals.includes("incorporated_within_30d")) parts.push("new this month");
  if (signals.includes("sic_match")) parts.push("right trade");
  if (signals.includes("region_match")) parts.push("your patch");
  if (signals.includes("active_status")) parts.push("active on register");
  if (signals.includes("has_registered_address")) parts.push("registered address on file");
  return parts.length ? parts.join(" · ") : "matched to your profile";
}

export function leadToCustomerRow(lead) {
  const co = lead.tle_companies || {};
  const sic = Array.isArray(co.sic_codes)
    ? co.sic_codes.filter(Boolean).slice(0, 3)
    : [];
  return {
    company_name: co.company_name || lead.company_name,
    company_number: lead.company_number,
    incorporated_on: co.incorporated_on,
    industry_slug: lead.industry_slug,
    region_slug: lead.region_slug,
    area: formatLocality(co.registered_address),
    company_status: co.company_status || "active",
    quality_tier: lead.quality_tier,
    quality_score: lead.quality_score,
    listed_at: lead.created_at,
    why: whyMatched(lead),
    sic_codes: sic,
  };
}

export async function fetchMatchedDeaths(sb, profile, { since, limit = 20 } = {}) {
  let q = sb
    .from("tle_death_events")
    .select("id, company_name, company_number, event_type, notice_published_at, industry_slug, region_slug, liquidation_estimated_gbp")
    .order("notice_published_at", { ascending: false })
    .limit(limit);
  if (profile.industry_slug) q = q.eq("industry_slug", profile.industry_slug);
  if (profile.region_slug && profile.region_slug !== "uk-all") {
    q = q.eq("region_slug", profile.region_slug);
  }
  if (since) q = q.gte("notice_published_at", since);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
