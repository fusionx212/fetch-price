// Weekly digest — every Sunday, email each watcher a summary of the changes to the tools
// they watch over the past 7 days. Only sends when there's something to report (no spam).
// Run: node src/alerts/digest.js   (systemd fetch-price-digest.timer, weekly)
import 'dotenv/config';
import { db } from '../db.js';

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'Fetch-Price <alerts@fetch-price.com>';
const SITE = process.env.SITE_URL || 'https://fetch-price.com';

async function resendSend(to, subject, html) {
  if (!RESEND_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 fetch-price-farm' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  return res.ok;
}

async function main() {
  if (!RESEND_KEY) { console.log('digest: no RESEND_KEY'); return; }
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: events } = await db
    .from('fp_change_events')
    .select('*, vendor:fp_vendors(name, slug, category)')
    .gte('detected_at', since)
    .order('significance', { ascending: false });
  if (!events?.length) { console.log('digest: no changes this week — nothing to send'); return; }

  const { data: watchers } = await db.from('fp_watches').select('email, vendor_slug, unsub_token');
  if (!watchers?.length) { console.log('digest: no watchers'); return; }

  // group watchers by email → set of vendor slugs (null = whole stack)
  const byEmail = new Map();
  for (const w of watchers) {
    const e = byEmail.get(w.email) || { slugs: new Set(), whole: false, token: w.unsub_token };
    if (w.vendor_slug) e.slugs.add(w.vendor_slug); else e.whole = true;
    byEmail.set(w.email, e);
  }

  let sent = 0;
  for (const [email, w] of byEmail) {
    const relevant = events.filter((ev) => w.whole || w.slugs.has(ev.vendor?.slug));
    if (!relevant.length) continue;
    const items = relevant.slice(0, 12).map((ev) => {
      const arrow = ev.change_type === 'price_down' ? '▼' : '▲';
      return `<li style="margin:0 0 8px"><a href="${SITE}/pricing-history/${ev.vendor?.slug}/" style="color:#211d19;font-weight:600;text-decoration:none">${ev.vendor?.name}</a> — ${arrow} ${ev.summary}</li>`;
    }).join('');
    const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;color:#211d19">
      <p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#b4550a;margin:0 0 6px">Fetch-Price · this week</p>
      <h2 style="margin:0 0 14px;font-size:20px">${relevant.length} change${relevant.length === 1 ? '' : 's'} in the tools you watch</h2>
      <ul style="padding-left:18px;margin:0 0 18px;line-height:1.5">${items}</ul>
      <p style="margin:0 0 18px"><a href="${SITE}/alerts/" style="background:#b4550a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:6px;display:inline-block">See all changes + cheaper switches →</a></p>
      <p style="font-size:12px;color:#918777;margin:16px 0 0"><a href="${SITE}/unsubscribe?t=${w.token}" style="color:#918777">Unsubscribe</a></p></div>`;
    if (await resendSend(email, `Your software this week: ${relevant.length} price change${relevant.length === 1 ? '' : 's'}`, html)) sent++;
  }
  console.log(`digest: sent ${sent} weekly summaries`);
}

main().catch((e) => { console.error('digest failed', e); process.exit(1); });
