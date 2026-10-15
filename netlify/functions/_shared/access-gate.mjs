/**
 * Server-side paywall gate — checks tle_subscriptions via service role.
 *
 * IDENTITY RULE (estate ACCESS-CONTROL LAW): paid data is scoped by a signed
 * capability token, never by a caller-supplied ?email=. An email address is a
 * public identifier — anyone can type a customer's address. The token is minted
 * server-side and delivered only to the mailbox that owns it.
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeProfile } from "./match.mjs";

const TOKEN_TTL_DAYS = 90;

function tokenSecret() {
  const s = process.env.RCD_TOKEN_SECRET || process.env.CRON_SECRET || process.env.PIPELINE_SECRET;
  if (!s) throw new Error("RCD_TOKEN_SECRET not configured");
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function sign(payload) {
  return crypto.createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

/** Mint a capability token for an email. Deliver by email ONLY — never in an API response. */
export function mintAccessToken(email, ttlDays = TOKEN_TTL_DAYS) {
  const addr = String(email || "").trim().toLowerCase();
  if (!addr) throw new Error("email required");
  const exp = Date.now() + ttlDays * 86400000;
  const payload = `${b64url(addr)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a token and return its email, or null. Constant-time signature compare. */
export function verifyAccessToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailPart, expPart, sig] = parts;
  const expected = sign(`${emailPart}.${expPart}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const exp = Number(expPart);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  try {
    return Buffer.from(emailPart, "base64url").toString("utf8").toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * The ONLY way a request may claim an identity. Accepts ?token= or
 * `Authorization: Bearer <token>`. Returns null when absent/invalid — callers
 * must treat null as unauthenticated, never fall back to a query-param email.
 */
export function identityFromRequest(req) {
  const url = new URL(req.url);
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return verifyAccessToken(url.searchParams.get("token") || bearer || "");
}

export function unauthorized(reason = "Access token required") {
  return json(401, {
    error: reason,
    how: "Request a sign-in link at https://regionalcommercedata.co.uk/api/tle/access-link (POST {email}) — the link is emailed to you.",
  });
}

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getSubscriberProfile(email) {
  if (!email) return null;
  const sb = getAdminClient();
  const { data } = await sb
    .from("tle_subscriber_profiles")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data;
}

export async function hasActiveSubscription(email, pillar) {
  if (!email) return false;
  const sb = getAdminClient();
  const { data } = await sb
    .from("tle_subscriptions")
    .select("status, revenue_pillar")
    .eq("email", email.toLowerCase())
    .eq("status", "active")
    .in("revenue_pillar", pillar === "vulture" ? ["vulture"] : [pillar, "vulture"]);
  return (data || []).length > 0;
}

export async function createCheckoutSession({ email, pillar, successUrl, cancelUrl, profile = {} }) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

  const priceMap = {
    predator: process.env.STRIPE_PRICE_PREDATOR_LEAD,
    monitor: process.env.STRIPE_PRICE_MONITOR_MONTHLY,
    vulture: process.env.STRIPE_PRICE_VULTURE_MONTHLY,
  };
  const priceId = priceMap[pillar];
  if (!priceId) throw new Error(`Stripe price not configured for ${pillar}`);

  const p = normalizeProfile({ ...profile, email });
  const params = new URLSearchParams();
  params.set("mode", pillar === "predator" ? "payment" : "subscription");
  params.set("customer_email", email);
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[revenue_pillar]", pillar);
  if (p.industry_slug) params.set("metadata[industry_slug]", p.industry_slug);
  if (p.industry_slugs?.length) params.set("metadata[industry_slugs]", p.industry_slugs.join(","));
  if (p.region_slug) params.set("metadata[region_slug]", p.region_slug);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) throw new Error(`Stripe checkout failed: ${await res.text()}`);
  return res.json();
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function requireCronAuth(req) {
  const secret = process.env.CRON_SECRET || process.env.PIPELINE_SECRET;
  return secret && (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}
