import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const OWNER = "owner@example.com";
const STRANGER = "stranger@example.com";
const BASE = "https://fetch-price.com/api/tle/leads";

const PURCHASES = { [OWNER]: [{ company_number: "12345678", delivered_at: "2026-07-01T00:00:00Z", lead_id: 1 }] };
const LEADS = [
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
];

let realFetch;
let handler;
let mintAccessToken;

function rows(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

before(async () => {
  process.env.SUPABASE_URL = "https://stub.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";
  process.env.RCD_TOKEN_SECRET = "test-secret-not-real";
  realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname.endsWith("/tle_lead_purchases")) {
      const email = (url.searchParams.get("email") || "").replace(/^eq\./, "");
      return rows(PURCHASES[email] || []);
    }
    if (url.pathname.endsWith("/tle_leads")) return rows(LEADS);
    if (url.pathname.endsWith("/tle_subscriber_profiles")) return rows(null);
    throw new Error(`unexpected fetch ${url}`);
  };
  ({ default: handler } = await import("../netlify/functions/tle-leads.mjs"));
  ({ mintAccessToken } = await import("../netlify/functions/_shared/access-gate.mjs"));
});

after(() => {
  globalThis.fetch = realFetch;
});

const get = (qs, headers = {}) => handler(new Request(`${BASE}${qs}`, { headers }));

test("refuses a bare ?email= of a paying customer (SEC-01)", async () => {
  const res = await get(`?email=${encodeURIComponent(OWNER)}`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.leads, undefined);
});

test("refuses a request with no credential", async () => {
  const res = await get("");
  assert.equal(res.status, 401);
});

test("refuses a forged / tampered token", async () => {
  const good = mintAccessToken(STRANGER);
  const [, exp, sig] = good.split(".");
  const forged = `${Buffer.from(OWNER).toString("base64url")}.${exp}.${sig}`;
  const res = await get(`?token=${encodeURIComponent(forged)}`);
  assert.equal(res.status, 401);
});

test("refuses an expired token", async () => {
  const expired = mintAccessToken(OWNER, -1);
  const res = await get(`?token=${encodeURIComponent(expired)}`);
  assert.equal(res.status, 401);
});

test("a valid token for someone else plus ?email=owner never returns the owner's leads", async () => {
  const token = mintAccessToken(STRANGER);
  const res = await get(`?token=${encodeURIComponent(token)}&email=${encodeURIComponent(OWNER)}`);
  assert.notEqual(res.status, 200);
  const body = await res.json();
  assert.equal(body.leads, undefined);
  assert.notEqual(body.email, OWNER);
});

test("the rightful owner gets their leads via ?token=", async () => {
  const res = await get(`?token=${encodeURIComponent(mintAccessToken(OWNER))}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.email, OWNER);
  assert.equal(body.leads.length, 1);
  assert.equal(body.leads[0].company_name, "Owner Paid Ltd");
});

test("the rightful owner gets their leads via Authorization: Bearer", async () => {
  const res = await get("", { Authorization: `Bearer ${mintAccessToken(OWNER)}` });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).leads.length, 1);
});
