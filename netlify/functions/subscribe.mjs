/**
 * Price-drop alert signup → Resend audience + welcome email.
 * Env: RESEND_API_KEY, RESEND_AUDIENCE_ID (optional), RESEND_FROM (optional)
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED = new Set([
  "portable-air-conditioners",
  "dehumidifiers",
  "laptops",
]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 200, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const key = process.env.RESEND_API_KEY;
  if (!key) return json(503, { error: "Email service not configured yet" });

  let email, category, source;
  try {
    ({ email, category, source } = await req.json());
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  email = String(email || "")
    .trim()
    .toLowerCase();
  category = String(category || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Invalid email" });
  if (!ALLOWED.has(category)) return json(400, { error: "Unknown category" });

  const from = process.env.RESEND_FROM || "Fetch Price <alerts@fetch-price.com>";
  const audience = process.env.RESEND_AUDIENCE_ID;

  if (audience) {
    const ar = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        unsubscribed: false,
        first_name: category,
        last_name: source || "fetch-price",
      }),
    });
    if (!ar.ok) {
      const t = await ar.text();
      console.error("Resend audience error:", t);
    }
  }

  const welcome = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: `You're tracking: ${category.replace(/-/g, " ")}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;color:#0b1220">
        <h2 style="margin:0 0 12px">Price-drop alerts are on</h2>
        <p style="color:#5b6b7c;line-height:1.55">You're watching <strong>${category.replace(/-/g, " ")}</strong> on Fetch Price.</p>
        <p style="color:#5b6b7c;line-height:1.55"><strong>Affiliate disclosure:</strong> when we email a deal, links may earn us a commission from Amazon, eBay or Awin partners. The price you pay does not change.</p>
        <p style="margin:20px 0 0"><a href="https://fetch-price.com/categories/${category}.html" style="color:#0f766e">Open category page →</a></p>
        <p style="margin:28px 0 0;font-size:12px;color:#999">Fetch Price · POLICYANDPLAY LTD · <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#999">Unsubscribe</a></p>
      </div>`,
    }),
  });

  if (!welcome.ok) {
    console.error("Resend welcome error:", await welcome.text());
    return json(502, { error: "Could not send confirmation" });
  }

  return json(200, { ok: true });
};

export const config = { path: "/api/subscribe" };
