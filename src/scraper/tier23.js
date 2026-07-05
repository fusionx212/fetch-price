// Tier 2: Playwright headless render (JS-heavy / lightly protected pages).
// Tier 3: AI extraction — Hermes on page text first, Claude vision on screenshot
//         if text extraction fails. Also self-heals Tier 1 selectors.
import { aiJson, aiVisionJson } from '../ai/client.js';
import { extractFromText, extractFromScreenshot, healSelectors } from '../ai/prompts.js';

const validPlans = (out) =>
  out && Array.isArray(out.plans) && out.plans.length > 0 &&
  out.plans.every((p) => typeof p.name === 'string');

export async function tier2(vendor) {
  const { chromium } = await import('playwright'); // lazy — only loads when needed
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: 'FetchPriceBot/1.0 (+https://fetch-price.com/bot)',
      viewport: { width: 1400, height: 2400 }
    });
    await page.goto(vendor.pricing_url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500); // let pricing toggles settle
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
