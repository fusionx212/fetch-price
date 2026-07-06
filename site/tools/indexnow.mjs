// Publish-time indexing push: IndexNow (Bing/Yandex, instant) + Bing Webmaster API
// (SubmitUrlBatch, priority crawl — direct submission, not just a sitemap ping) + a
// sitemap re-notify via SubmitFeed. Bing's index is what ChatGPT reads, so this is the
// fast path to both search ranking and AI-answer citation.
// Usage: node tools/indexnow.mjs [https://fetch-price.com]  (reads dist/sitemap.xml)
import { readFileSync } from 'node:fs';

const HOST = (process.argv[2] || 'https://fetch-price.com').replace(/\/$/, '');
const host = new URL(HOST).host;
const INDEXNOW_KEY = 'a7f3c9e14b2d6084f5e19c7a3b8d240e';
const BING_KEY = process.env.BING_WEBMASTER_API_KEY;

let urls = [];
try {
  const xml = readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} catch {
  urls = [`${HOST}/`, `${HOST}/pricing-history/`, `${HOST}/alerts/`];
}
if (!urls.length) { console.log('publish-index: no URLs'); process.exit(0); }

// 1. IndexNow — instant push to Bing/Yandex/etc.
const inBody = { host, key: INDEXNOW_KEY, keyLocation: `${HOST}/${INDEXNOW_KEY}.txt`, urlList: urls };
const inRes = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(inBody),
});
console.log(`IndexNow: submitted ${urls.length} URLs → HTTP ${inRes.status} (200/202 = accepted)`);

// 2. Bing Webmaster API — direct priority-crawl submission (separate from IndexNow's
// passive ping) + a sitemap re-notify. Daily quota is per-site (check GetUrlSubmissionQuota
// if this ever silently stops working); cap the batch to leave headroom for manual
// "Request indexing" clicks in the dashboard.
if (BING_KEY) {
  const call = async (method, body) => {
    const res = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?apikey=${BING_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.text() };
  };
  const feed = await call('SubmitFeed', { siteUrl: HOST, feedUrl: `${HOST}/sitemap.xml` });
  console.log(`Bing SubmitFeed: HTTP ${feed.status}`);

  // Quota-aware: the daily URL-submission quota is per-site and resets daily. Check
  // remaining quota first — submitting more than what's left is a hard 400, not a soft cap.
  let quotaRes;
  try {
    const q = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/GetUrlSubmissionQuota?apikey=${BING_KEY}&siteUrl=${encodeURIComponent(HOST)}`);
    quotaRes = (await q.json()).d?.DailyQuota ?? 0;
  } catch { quotaRes = 0; }
  const room = Math.max(0, quotaRes - 5); // keep 5 in reserve for manual "Request indexing" clicks
  if (room > 0) {
    const batch = urls.slice(0, room);
    const sub = await call('SubmitUrlBatch', { siteUrl: HOST, urlList: batch });
    console.log(`Bing SubmitUrlBatch: ${batch.length}/${urls.length} URLs (quota ${quotaRes}) → HTTP ${sub.status}`);
  } else {
    console.log(`Bing SubmitUrlBatch: skipped — daily quota exhausted (${quotaRes} remaining); sitemap feed still notified`);
  }
} else {
  console.log('Bing Webmaster: skipped (no BING_WEBMASTER_API_KEY)');
}
