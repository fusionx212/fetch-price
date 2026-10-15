/**
 * GET /api/tle/leads — matched leads purchased by the token holder
 *
 * Identity comes from a signed capability token ONLY. An ?email= parameter is
 * never trusted: it is a public identifier, so honouring it would hand any
 * stranger the leads a customer paid for.
 */
import { getAdminClient, getSubscriberProfile, identityFromRequest, unauthorized, json, CORS } from "./_shared/access-gate.mjs";
import { leadToCustomerRow } from "./_shared/match.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });
  if (req.method !== "GET") return json(405, { error: "Method Not Allowed" });

  const email = identityFromRequest(req);
  if (!email) return unauthorized();

  const sb = getAdminClient();

  const { data: purchases, error: pErr } = await sb
    .from("tle_lead_purchases")
    .select("company_number, delivered_at, lead_id")
    .eq("email", email)
    .order("delivered_at", { ascending: false })
    .limit(50);

  if (pErr) return json(500, { error: pErr.message });
  if (purchases?.length) {
    const numbers = purchases.map((p) => p.company_number);
    const { data: leads, error } = await sb
      .from("tle_leads")
      .select(
        "company_number, industry_slug, region_slug, quality_tier, quality_score, quality_signals, created_at, purchased_by_email, tle_companies(company_name, incorporated_on, company_status, registered_address)"
      )
      .in("company_number", numbers);
    if (error) return json(500, { error: error.message });
    const byNum = new Map((leads || []).map((l) => [l.company_number, l]));
    const rows = purchases
      .map((p) => byNum.get(p.company_number))
      .filter(Boolean)
      .map(leadToCustomerRow);
    return json(200, { tier: "purchased", email, leads: rows });
  }

  // Authenticated but nothing bought yet — safe to echo their own profile back
  return json(402, {
    error: "No matched leads yet — buy one for £5",
    checkout: "https://regionalcommercedata.co.uk/subscribe/?product=leads",
    profile: await getSubscriberProfile(email),
  });
};

export const config = { path: "/api/tle/leads" };
