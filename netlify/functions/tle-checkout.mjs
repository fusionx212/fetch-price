/**
 * POST /api/tle/checkout — Stripe checkout for revenue products
 */
import { createCheckoutSession, getAdminClient, json, CORS } from "./_shared/access-gate.mjs";
import { upsertSubscriberProfile } from "./_shared/fulfill.mjs";
import { TRADE_SLUGS, REGION_SLUGS } from "./_shared/match.mjs";

const PUBLIC_TO_INTERNAL = {
  leads: "predator",
  intel: "monitor",
  alerts: "vulture",
  predator: "predator",
  monitor: "monitor",
  vulture: "vulture",
};

const INTERNAL_TO_PUBLIC = {
  predator: "leads",
  monitor: "intel",
  vulture: "alerts",
};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const requested = String(body.product || body.pillar || "").trim().toLowerCase();
  const internal = PUBLIC_TO_INTERNAL[requested];
  const rawSlugs = Array.isArray(body.industry_slugs)
    ? body.industry_slugs
    : body.industry_slug
      ? [body.industry_slug]
      : [];
  const industry_slugs = [...new Set(rawSlugs.map((s) => String(s || "").trim()).filter((s) => TRADE_SLUGS.has(s)))];
  const industry_slug = industry_slugs[0] || null;
  const region_slug = REGION_SLUGS.has(body.region_slug) ? body.region_slug : "uk-all";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Invalid email" });
  if (!internal) return json(400, { error: "Invalid product — use leads, intel, or alerts" });
  if (!industry_slug) return json(400, { error: "Pick at least one business interest (trade) so we can match packs" });

  const publicCode = INTERNAL_TO_PUBLIC[internal];
  const base = body.returnUrl || "https://regionalcommercedata.co.uk";

  try {
    const sb = getAdminClient();
    await upsertSubscriberProfile(sb, {
      email,
      industry_slug,
      industry_slugs,
      // v1: persist multi-trade interests in asset_interests (trade slugs) — no schema change
      asset_interests: industry_slugs,
      region_slug,
      delivery_cadence:
        internal === "predator" ? "instant" : internal === "monitor" ? "monthly" : "weekly",
      is_free_list: false,
    });

    const session = await createCheckoutSession({
      email,
      pillar: internal,
      successUrl: `${base}/subscribe/?paid=${publicCode}`,
      cancelUrl: `${base}/subscribe/?canceled=1`,
      profile: { industry_slug, industry_slugs, region_slug, asset_interests: industry_slugs },
    });
    return json(200, { url: session.url, session_id: session.id, product: publicCode });
  } catch (e) {
    return json(503, { error: e.message });
  }
};

export const config = { path: "/api/tle/checkout" };
