// Weekly Google Search Console → Telegram report for fetch-price.com. Shows traffic
// building, and flags when it's strong enough to (re)apply to affiliate networks.
// Reads gsc-token.json (refresh-token OAuth). Run: node src/ops/gsc-report.js
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { tgSend } from './telegram.js';

const SITE = 'sc-domain:fetch-price.com';
const REAPPLY_IMPRESSIONS = 200; // ~28d impressions that signal a real site to networks
const TOKEN_PATH = process.env.GSC_TOKEN_PATH || '/root/fetch-price/gsc-token.json';

const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

async function accessToken(t) {
  const r = await fetch(t.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  return (await r.json()).access_token;
}

async function query(token, body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok ? r.json() : { rows: [] };
}

async function main() {
  let t;
  try { t = JSON.parse(readFileSync(TOKEN_PATH, 'utf8')); }
  catch { console.log('gsc-report: no token at', TOKEN_PATH); return; }
  const token = await accessToken(t);
  if (!token) { console.log('gsc-report: no access token'); return; }

  const range28 = { startDate: daysAgo(28), endDate: daysAgo(1) };
  const range7 = { startDate: daysAgo(7), endDate: daysAgo(1) };
  const [tot28, tot7, topQ] = await Promise.all([
    query(token, range28),
    query(token, range7),
    query(token, { ...range28, dimensions: ['query'], rowLimit: 5 }),
  ]);
  const a = tot28.rows?.[0] || { clicks: 0, impressions: 0, position: 0 };
  const b = tot7.rows?.[0] || { clicks: 0, impressions: 0 };

  const lines = [
    '📈 *fetch-price.com — Search Console*',
    `28d: ${a.impressions} impressions · ${a.clicks} clicks · avg pos ${(a.position || 0).toFixed(1)}`,
    `7d:  ${b.impressions} impressions · ${b.clicks} clicks`,
  ];
  if (topQ.rows?.length) {
    lines.push('Top queries:');
    for (const r of topQ.rows) lines.push(`  "${r.keys[0]}" — ${r.impressions} impr, pos ${r.position.toFixed(1)}`);
  } else {
    lines.push('_No search impressions yet — still being indexed (normal for a new site)._');
  }
  if (a.impressions >= REAPPLY_IMPRESSIONS) {
    lines.push('', `✅ *${a.impressions} impressions — strong enough to (re)apply to affiliate networks.*`);
    lines.push('Reapply: PartnerStack partnerstack.com/partners · Impact app.impact.com · Awin (Adobe/Microsoft).');
  }
  await tgSend(lines.join('\n'));
  console.log('gsc-report sent:', a.impressions, 'impressions');
}

main().catch((e) => { console.error('gsc-report failed', e); process.exit(1); });
