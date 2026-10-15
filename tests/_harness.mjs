import crypto from "node:crypto";

export const OWNER = "owner@example.com";
export const STRANGER = "stranger@example.com";
export const SECRET = "test-secret-not-real";

const TABLES = {
  tle_lead_purchases: [{ email: OWNER, company_number: "12345678", delivered_at: "2026-07-01T00:00:00Z", lead_id: 1 }],
  tle_leads: [
    {
      company_number: "12345678",
      industry_slug: "construction",
      region_slug: "west-midlands",
      quality_tier: "A",
      quality_score: 90,
      quality_signals: [],
      created_at: "2026-06-30T00:00:00Z",
      purchased_by_email: OWNER,
      tle_companies: { company_name: "Owner Paid Ltd", incorporated_on: "2026-06-01", company_status: "active", registered_address: {} },
    },
  ],
  tle_subscriptions: [
    { email: OWNER, status: "active", revenue_pillar: "vulture" },
    { email: OWNER, status: "active", revenue_pillar: "monitor" },
  ],
  tle_subscriber_profiles: [{ email: OWNER, industry_slug: "construction", region_slug: "west-midlands" }],
  tle_death_events: [{ id: 7, company_name: "Paid Distress Ltd", company_number: "87654321", industry_slug: "construction", region_slug: "west-midlands" }],
  tle_valuations: [{ asset_category: "plant", asset_query: "PAID-COMP", liquidation_mid_gbp: 1000, company_number: "87654321" }],
  tle_industries: [{ slug: "construction", label: "Construction" }],
  tle_companies: [{ company_number: "11111111", company_name: "Paid Monitor Row Ltd", industry_slug: "construction", lifecycle_stage: "birth" }],
};

/** Stub the Supabase REST API at the fetch layer so the real handlers + supabase-js run unmodified. */
export function installStub() {
  process.env.SUPABASE_URL = "https://stub.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";
  process.env.RCD_TOKEN_SECRET = SECRET;
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const table = url.pathname.split("/").pop();
    if (!(table in TABLES)) throw new Error(`unexpected fetch ${url}`);
    let rows = TABLES[table];
    const emailEq = url.searchParams.get("email");
    if (emailEq) rows = rows.filter((r) => `eq.${r.email}` === emailEq);
    const headers = { "Content-Type": "application/json", "Content-Range": `0-${rows.length}/${rows.length}` };
    if (req.method === "HEAD") return new Response(null, { status: 200, headers });
    if ((req.headers.get("accept") || "").includes("pgrst.object")) {
      return new Response(JSON.stringify(rows[0] ?? null), { status: 200, headers });
    }
    return new Response(JSON.stringify(rows), { status: 200, headers });
  };
  return () => {
    globalThis.fetch = real;
  };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** A token in the format regional-commerce-data mints today: email.exp.HMAC(raw secret). */
export function rcdLegacyToken(email, secret = SECRET) {
  const payload = `${Buffer.from(email).toString("base64url")}.${Date.now() + 86400000}`;
  return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

/** A correctly-formed audience-bound token, but for another site. */
export function otherAudienceToken(email, aud = "regionalcommercedata.co.uk") {
  const key = crypto.createHmac("sha256", SECRET).update(`tle-access-v1:${aud}`).digest();
  const payload = `${Buffer.from(aud).toString("base64url")}.${Buffer.from(email).toString("base64url")}.${Date.now() + 86400000}`;
  return `${payload}.${crypto.createHmac("sha256", key).update(payload).digest("base64url")}`;
}
