/**
 * GET /api/tle/valuations — Fetch-Price liquidation comps (vulture gate)
 */
import { getAdminClient, hasActiveSubscription, json, CORS } from "./_shared/access-gate.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const industry = url.searchParams.get("industry");

  if (!(await hasActiveSubscription(email, "vulture"))) {
    return json(402, { error: "Vulture subscription required", pillar: "vulture" });
  }

  const sb = getAdminClient();
  let q = sb
    .from("tle_valuations")
    .select("asset_category, asset_query, liquidation_low_gbp, liquidation_mid_gbp, liquidation_high_gbp, comp_sources, scraped_at, company_number")
    .order("scraped_at", { ascending: false })
    .limit(100);

  if (industry) {
    const { data: deaths } = await sb.from("tle_death_events").select("id").eq("industry_slug", industry);
    const ids = (deaths || []).map((d) => d.id);
    if (ids.length) q = q.in("death_event_id", ids);
  }

  const { data, error } = await q;
  if (error) return json(500, { error: error.message });
  return json(200, { valuations: data });
};

export const config = { path: "/api/tle/valuations" };
