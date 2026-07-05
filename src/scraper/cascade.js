// Cascade: Tier 1 → Tier 2 → Tier 3, LootLab QA-pipeline pattern.
import { tier1 } from './tier1.js';
import { tier2, tier3 } from './tier23.js';

export async function scrapeVendor(vendor) {
  // Tier 1 unless the vendor is flagged browser-only
  if (!vendor.requires_browser) {
    try {
      return await tier1(vendor);
    } catch (e) {
      console.log(`[${vendor.slug}] tier1 miss (${e.message}) → tier2`);
    }
  }

  // Tier 2 render → Tier 3 AI extraction (Hermes text → Claude vision).
  // Tier 3 self-heals selectors so this vendor drops back to Tier 1 next run.
  const rendered = await tier2(vendor);
  return await tier3(vendor, rendered);
}
