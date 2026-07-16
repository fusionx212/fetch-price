/**
 * GET /api/tle/intel — free summary or paid matched company rows
 */
import { getAdminClient, getSubscriberProfile, hasActiveSubscription, json, CORS } from "./_shared/access-gate.mjs";
import { applyLeadFilters } from "./_shared/match.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const region = url.searchParams.get("region") || "west-midlands";
  const sb = getAdminClient();

  const profile = email ? await getSubscriberProfile(email) : null;
  const matchRegion = profile?.region_slug && profile.region_slug !== "uk-all" ? profile.region_slug : region;

  const { data: industries } = await sb.from("tle_industries").select("slug, label");

  const summary = [];
  for (const ind of industries || []) {
    if (profile?.industry_slug && ind.slug !== profile.industry_slug) continue;
    let q = sb
      .from("tle_companies")
      .select("*", { count: "exact", head: true })
      .eq("industry_slug", ind.slug)
      .eq("lifecycle_stage", "birth");
    if (matchRegion !== "uk-all") q = q.eq("region_slug", matchRegion);
    const { count } = await q;
    summary.push({ industry: ind.slug, label: ind.label, birth_count_7d: count || 0 });
  }

  const monitor = await hasActiveSubscription(email, "monitor");
  if (!monitor) {
    return json(200, { tier: "free", region: matchRegion, summary, profile: profile ? { industry_slug: profile.industry_slug, region_slug: profile.region_slug } : null });
  }

  let q = sb
    .from("tle_companies")
    .select("company_number, company_name, industry_slug, incorporated_on, lifecycle_stage, sic_codes, region_slug")
    .eq("lifecycle_stage", "birth")
    .order("incorporated_on", { ascending: false })
    .limit(200);

  if (profile?.industry_slug) q = q.eq("industry_slug", profile.industry_slug);
  if (profile?.region_slug && profile.region_slug !== "uk-all") q = q.eq("region_slug", profile.region_slug);
  else if (matchRegion !== "uk-all") q = q.eq("region_slug", matchRegion);

  const { data: companies, error } = await q;
  if (error) return json(500, { error: error.message });
  return json(200, { tier: "monitor", region: matchRegion, summary, companies, profile: { industry_slug: profile?.industry_slug, region_slug: profile?.region_slug } });
};

export const config = { path: "/api/tle/intel" };
