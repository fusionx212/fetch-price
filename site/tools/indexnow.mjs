// IndexNow submit — pushes our URLs to Bing/Yandex/etc. instantly (free). Bing's index is
// what ChatGPT reads, so this is the fast path to search + AI-answer citation.
// Usage: node tools/indexnow.mjs [https://fetch-price.com]  (reads dist/sitemap.xml)
import { readFileSync } from 'node:fs';

const HOST = (process.argv[2] || 'https://fetch-price.com').replace(/\/$/, '');
const host = new URL(HOST).host;
const KEY = 'a7f3c9e14b2d6084f5e19c7a3b8d240e';

let urls = [];
try {
  const xml = readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} catch {
  urls = [`${HOST}/`, `${HOST}/pricing-history/`, `${HOST}/alerts/`];
}
if (!urls.length) { console.log('IndexNow: no URLs'); process.exit(0); }

const body = { host, key: KEY, keyLocation: `${HOST}/${KEY}.txt`, urlList: urls };
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
console.log(`IndexNow: submitted ${urls.length} URLs → HTTP ${res.status} (200/202 = accepted)`);
