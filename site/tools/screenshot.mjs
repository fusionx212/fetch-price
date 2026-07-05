// Render the built site and capture desktop + mobile screenshots for QA/preview.
// Usage: node tools/screenshot.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:4321';
const out = process.argv[3] || './screenshots';
mkdirSync(out, { recursive: true });

const shots = [
  { name: 'home-desktop', path: '/', width: 1440, full: false },
  { name: 'home-full', path: '/', width: 1440, full: true },
  { name: 'home-mobile', path: '/', width: 390, full: true },
  { name: 'history-slack', path: '/pricing-history/slack/', width: 1440, full: true },
  { name: 'histories-index', path: '/pricing-history/', width: 1440, full: false },
  { name: 'has-monday', path: '/has-monday-raised-prices/', width: 1440, full: false },
  { name: 'alerts', path: '/alerts/', width: 1440, full: false },
];

const browser = await chromium.launch();
const errors = [];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: Math.round(s.width * 0.72) }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${s.name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${s.name}] PAGEERROR ${e.message}`));
  await page.goto(base + s.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: s.full });
  console.log('shot', s.name);
  await ctx.close();
}
await browser.close();
console.log('CONSOLE_ERRORS', errors.length);
for (const e of errors) console.log(' -', e);
