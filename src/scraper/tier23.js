// Tier 2: Playwright headless render (JS-heavy / lightly protected pages).
// Tier 3: AI extraction — Hermes on page text first, Claude vision on screenshot
//         if text extraction fails. Also self-heals Tier 1 selectors.
import { aiJson, aiVisionJson } from '../ai/client.js';
import { extractFromText, extractFromScreenshot, healSelectors } from '../ai/prompts.js';

// Confidence gate — reject broken/over-captured extractions so garbage never publishes.
export function sanePlans(plans) {
  if (!Array.isArray(plans) || plans.length === 0 || plans.length > 8) return false;
  if (!plans.every((p) => p && typeof p.name === 'string' && p.name.trim())) return false;
  const priced = plans.filter((p) => typeof p.price === 'number');
  if (priced.length < 1) return false;                                   // no real prices
  if (priced.some((p) => p.price < 0 || p.price > 20000)) return false;  // implausible
  const names = plans.map((p) => p.name.toLowerCase().trim());
  if (new Set(names).size !== names.length) return false;               // duplicate tiers
  return true;
}

const validPlans = (out) => out && sanePlans(out.plans);

// Best-effort: dismiss cookie/consent banners so they don't obscure pricing or block text.
async function dismissBanners(page) {
  const sel = [
    '#onetrust-accept-btn-handler', '#truste-consent-button', '.cookie-accept',
    '[aria-label*="accept" i]', '[data-testid*="accept" i]', 'button[id*="accept" i]',
  ];
  for (const s of sel) {
    try { const el = page.locator(s).first(); if (await el.isVisible({ timeout: 500 })) { await el.click({ timeout: 1000 }); return; } } catch {}
  }
  for (const t of ['Accept all', 'Accept All', 'Accept cookies', 'I agree', 'Allow all', 'Got it', 'Accept']) {
    try { const el = page.getByRole('button', { name: t, exact: false }).first(); if (await el.isVisible({ timeout: 400 })) { await el.click({ timeout: 1000 }); return; } } catch {}
  }
}

// Best-effort: switch billing toggle to MONTHLY so we read a consistent monthly list price
// (many pages default to annual). We keep both list + deal, so annual becomes a deal_note.
async function selectMonthly(page) {
  for (const t of ['Monthly', 'Pay monthly', 'Bill monthly', 'Billed monthly', 'Month']) {
    try {
      const el = page.getByText(new RegExp(`^\\s*${t}\\s*$`, 'i')).first();
      if (await el.isVisible({ timeout: 400 })) { await el.click({ timeout: 1000 }); await page.waitForTimeout(800); return; }
    } catch {}
  }
}

async function autoScroll(page) {
  try {
    await page.evaluate(async () => {
      await new Promise((res) => {
        let y = 0; const step = 600;
        const t = setInterval(() => { window.scrollBy(0, step); y += step; if (y >= document.body.scrollHeight) { clearInterval(t); res(); } }, 120);
      });
    });
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {}
}

export async function tier2(vendor) {
  const { chromium } = await import('playwright'); // lazy — only loads when needed
  // --disable-http2: some CDNs (Intuit/Adobe) reset HTTP/2 to headless clients (ERR_HTTP2_PROTOCOL_ERROR);
  // forcing HTTP/1.1 gets us in. --no-sandbox for headless root on CLAW.
  const browser = await chromium.launch({ headless: true, args: ['--disable-http2', '--no-sandbox'] });
  try {
    const context = await browser.newContext({
      userAgent: 'FetchPriceBot/1.0 (+https://fetch-price.com/bot)',
      viewport: { width: 1400, height: 2400 },
      locale: 'en-GB',
      extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
    });
    const page = await context.newPage();
    // domcontentloaded (not networkidle): many pricing pages keep long-poll/analytics
    // connections open and never reach idle, so networkidle just times out (e.g. Xero).
    await page.goto(vendor.pricing_url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    await dismissBanners(page);
    await selectMonthly(page);
    await autoScroll(page);          // trigger lazy-loaded pricing cards
    await page.waitForTimeout(1500); // let toggles / lazy content settle
    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    const screenshot = (await page.screenshot({ fullPage: true, type: 'png' })).toString('base64');
    return { html, text, screenshot };
  } finally {
    await browser.close();
  }
}

export async function tier3(vendor, { text, screenshot, html }) {
  // 3a: Hermes on page text (free)
  try {
    const { result, engine } = await aiJson(extractFromText(text), validPlans);
    if (validPlans(result)) {
      const selectors = await maybeHealSelectors(html);
      return { extracted: result, tier: 3, engine, selectors };
    }
  } catch { /* fall through to vision */ }

  // 3b: Claude vision on screenshot (paid, rare)
  const { result } = await aiVisionJson(extractFromScreenshot(), screenshot);
  if (!validPlans(result)) throw new Error('tier3: vision extraction invalid');
  const selectors = await maybeHealSelectors(html);
  return { extracted: result, tier: 3, engine: 'claude-vision', selectors, screenshot };
}

/** Self-healing: derive fresh Tier 1 selectors so the next run is cheap again. */
async function maybeHealSelectors(html) {
  if (!html) return null;
  try {
    const { result } = await aiJson(
      healSelectors(html),
      (o) => o && typeof o.plan_container === 'string' && o.plan_container.length > 0
    );
    return result;
  } catch {
    return null; // healing is best-effort
  }
}
