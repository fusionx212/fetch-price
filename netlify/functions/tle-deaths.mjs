/**
 * GET /api/tle/deaths — matched distress signals (paid gate, token identity)
 */
import { getAdminClient, getSubscriberProfile, hasActiveSubscription, identityFromRequest, unauthorized, json, CORS } from "./_shared/access-gate.mjs";
import { fetchMatchedDeaths } from "./_shared/match.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const email = identityFromRequest(req);
  if (!email) return unauthorized();

  if (!(await hasActiveSubscription(email, "vulture"))) {
    return json(402, { error: "Alerts subscription required", pillar: "vulture" });
  }

  const profile = (await getSubscriberProfile(email)) || { email, region_slug: "uk-all" };
  const sb = getAdminClient();
  const since = profile.last_alert_at || new Date(Date.now() - 30 * 86400000).toISOString();
  const deaths = await fetchMatchedDeaths(sb, profile, { since, limit: 100 });

  return json(200, {
    deaths,
    profile: { industry_slug: profile.industry_slug, region_slug: profile.region_slug },
  });
};

export const config = { path: "/api/tle/deaths" };
