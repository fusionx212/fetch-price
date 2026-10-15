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

// Tokens are bound to this site. A token minted for another site that shares
// the secret (e.g. regionalcommercedata.co.uk) fails both the audience check
// and the signature, because the HMAC key is derived per purpose + audience.
export const TOKEN_AUDIENCE = "fetch-price.com";
const TOKEN_PURPOSE = "tle-access-v1";

// Dedicated secret only — never fall back to CRON_SECRET/PIPELINE_SECRET, which
// are also the bearer credential for /api/tle/pipeline (one key, two purposes).
function tokenKey() {
  const s = process.env.RCD_TOKEN_SECRET;
  if (!s) throw new Error("RCD_TOKEN_SECRET not configured");
  return crypto.createHmac("sha256", s).update(`${TOKEN_PURPOSE}:${TOKEN_AUDIENCE}`).digest();
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function sign(payload) {
  return crypto.createHmac("sha256", tokenKey()).update(payload).digest("base64url");
}

/** Mint a capability token for an email. Deliver by email ONLY — never in an API response. */
export function mintAccessToken(email, ttlDays = TOKEN_TTL_DAYS) {
  const addr = String(email || "").trim().toLowerCase();
  if (!addr) throw new Error("email required");
  const exp = Date.now() + ttlDays * 86400000;
  const payload = `${b64url(TOKEN_AUDIENCE)}.${b64url(addr)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a token and return its email, or null. Constant-time signature compare. */
export function verifyAccessToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [audPart, emailPart, expPart, sig] = parts;
  const expected = sign(`${audPart}.${emailPart}.${expPart}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Buffer.from(audPart, "base64url").toString("utf8") !== TOKEN_AUDIENCE) return null;
  const exp = Number(expPart);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return Buffer.from(emailPart, "base64url").toString("utf8").toLowerCase() || null;
}

/**
 * The ONLY way a request may claim an identity: `Authorization: Bearer <token>`.
 * Query-string tokens are refused — they leak into access logs, browser history
 * and Referer headers. Returns null when absent/invalid; callers must treat null
 * as unauthenticated, never fall back to a query-param email.
 */
export function identityFromRequest(req) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("authorization") || "");
  return match ? verifyAccessToken(match[1]) : null;
}

export function unauthorized(reason = "Access token required") {
  return json(401, {
    error: reason,
    how: "Send Authorization: Bearer <token> issued for fetch-price.com. Tokens in the URL are not accepted.",
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
