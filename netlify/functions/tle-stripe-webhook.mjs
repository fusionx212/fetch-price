/**
 * POST /api/tle/stripe-webhook — sync subscription state + fulfill matched leads
 */
import { getAdminClient, json } from "./_shared/access-gate.mjs";
import { fulfillPredatorPurchase, upsertSubscriberProfile } from "./_shared/fulfill.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(503, { error: "Webhook not configured" });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "Missing signature" });

  let event;
  try {
    event = await verifyStripeWebhook(body, sig, secret);
  } catch (e) {
    return json(400, { error: e.message });
  }

  const sb = getAdminClient();

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const pillar = s.metadata?.revenue_pillar || "monitor";
    const email = (s.customer_email || s.customer_details?.email || "").toLowerCase();

    if (email) {
      await upsertSubscriberProfile(sb, {
        email,
        industry_slug: s.metadata?.industry_slug || null,
        region_slug: s.metadata?.region_slug || "uk-all",
        delivery_cadence: pillar === "monitor" ? "monthly" : "instant",
        is_free_list: false,
      });
    }

    if (pillar === "predator" && s.mode === "payment" && email) {
      await fulfillPredatorPurchase(sb, email, {
        industry_slug: s.metadata?.industry_slug,
        region_slug: s.metadata?.region_slug,
      }, s.id);
    } else if (s.mode === "subscription") {
      await sb.from("tle_subscriptions").upsert(
        {
          email,
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.subscription,
          revenue_pillar: pillar,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" }
      );
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    await sb
      .from("tle_subscriptions")
      .update({
        status: sub.status,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", sub.id);
  }

  return json(200, { received: true });
};

async function verifyStripeWebhook(payload, sigHeader, secret) {
  const crypto = await import("node:crypto");
  const parts = sigHeader.split(",").reduce((acc, p) => {
    const [k, v] = p.split("=");
    acc[k] = v;
    return acc;
  }, {});
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) throw new Error("Invalid signature header");

  const signed = `${ts}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  if (expected !== v1) throw new Error("Signature mismatch");

  return JSON.parse(payload);
}

export const config = { path: "/api/tle/stripe-webhook" };
