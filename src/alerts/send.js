// Farm-side alert sender. When a scrape detects a change, email everyone watching that
// vendor (or the whole stack) via Resend. No Edge Function needed — the farm already runs.
import { db } from '../db.js';

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'Fetch-Price <alerts@fetch-price.com>';
const SITE = process.env.SITE_URL || 'https://fetch-price.com';

async function resendSend(to, subject, html) {
  if (!RESEND_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) console.warn(`[alert] resend ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.ok;
}

function money(v, cur = 'GBP') {
  if (v == null) return 'POA';
  const s = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '£';
  return `${s}${v}`;
}

function alertHtml(vendor, changes, unsubToken) {
  const rows = changes.map((c) => {
    const dir = c.change_type === 'price_down' ? '▼' : '▲';
    return `<li style="margin:0 0 8px"><strong>${dir} ${c.summary}</strong></li>`;
  }).join('');
  const url = `${SITE}/pricing-history/${vendor.slug}/`;
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;color:#211d19">
    <p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#b4550a;margin:0 0 6px">Fetch-Price alert</p>
    <h2 style="margin:0 0 14px;font-size:20px">${vendor.name} just changed</h2>
    <ul style="padding-left:18px;margin:0 0 18px;line-height:1.5">${rows}</ul>
    <p style="margin:0 0 18px"><a href="${url}" style="background:#b4550a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;display:inline-block">See the history + a cheaper switch →</a></p>
    <p style="font-size:12px;color:#918777;margin:16px 0 0">You're getting this because you watch ${vendor.name} on Fetch-Price.
    <a href="${SITE}/unsubscribe?t=${unsubToken}" style="color:#918777">Unsubscribe</a>.</p>
  </div>`;
}

/** Email watchers of this vendor (and whole-stack watchers) about its changes. */
export async function sendChangeAlerts(vendor, changes) {
  if (!RESEND_KEY || !changes?.length) return 0;
  const { data: watchers } = await db
    .from('fp_watches')
    .select('email, unsub_token')
    .or(`vendor_slug.eq.${vendor.slug},vendor_slug.is.null`);
  if (!watchers?.length) return 0;
  const top = changes.reduce((a, b) => (a.significance >= b.significance ? a : b));
  const subject = `${vendor.name}: ${top.summary.slice(0, 64)}`;
  let sent = 0;
  for (const w of watchers) {
    if (await resendSend(w.email, subject, alertHtml(vendor, changes, w.unsub_token))) sent++;
  }
  await db.from('fp_watches')
    .update({ last_alerted_at: new Date().toISOString() })
    .or(`vendor_slug.eq.${vendor.slug},vendor_slug.is.null`);
  return sent;
}
