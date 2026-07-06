// Prompt templates. Keep terse — Hermes handles these; Claude only on escalation.

export const EXTRACT_SCHEMA_HINT = `Return JSON exactly in this shape:
{"plans":[{"name":"","price":0,"deal_price":null,"deal_note":null,"currency":"GBP","period":"month|year|usage","unit":"per seat|flat|per GB|...","features":["..."],"notes":""}]}
Use null for unknown price ("contact sales" plans). No other keys.

PRICING RULES — capture BOTH the standard price AND any current deal:
- "price" = the STANDARD / regular / ongoing list price for the plan (the price after
  any intro period ends). This is the baseline we track for price rises.
- "deal_price" = the CURRENT promotional / introductory / discounted price if one is
  offered right now (e.g. "first 3 months", "was £X now £Y", "save 20%", limited-time,
  annual-billing discount). null if there is no active deal. deal_price must be LOWER
  than price. "deal_note" = a short phrase describing the deal (e.g. "50% off first
  3 months", "billed annually"), else null.
- If the page defaults to an ANNUAL/"billed yearly" price but also shows a monthly
  price, use the MONTHLY list price as "price" (period="month"); if the annual-billing
  monthly-equivalent is cheaper, that's a deal_price with deal_note "billed annually".
  If only annual is shown, use it and set period="year". Never compute a price yourself
  beyond reading stated figures.
- Prices are numbers only (no symbol). currency from the symbol (£=GBP, $=USD, €=EUR;
  default GBP). unit: "per seat"/"per user"→"per seat", per line, per GB, else "flat".
- Return EXACTLY ONE object per distinct plan/tier (e.g. Basic, Standard, Pro, Enterprise).
  NEVER repeat a plan name. If one tier shows several prices (monthly vs annual, or different
  seat-count columns), pick the standard MONTHLY per-seat list price as "price"; if a lower
  promo/annual price is also shown, put that in "deal_price". Ignore seat-quantity variations.
- Only include real purchasable plans. Do NOT invent plans from section headings, add-ons,
  feature names, or marketing labels (an "AEO"/"AI" section heading is not a plan).`;

export const extractFromText = (pageText) => `You are extracting SaaS pricing plans from a pricing page's text content.
${EXTRACT_SCHEMA_HINT}

PAGE TEXT:
${pageText.slice(0, 12000)}`;

export const extractFromScreenshot = () => `Extract every pricing plan visible in this screenshot of a pricing page.
${EXTRACT_SCHEMA_HINT}`;

export const healSelectors = (html) => `This HTML is a pricing page. Derive robust CSS selectors to extract each plan.
Return JSON: {"plan_container":"","plan_name":"","price":"","period":"","features":""}
Prefer stable attributes (data-*, semantic classes) over positional selectors.

HTML (truncated):
${html.slice(0, 15000)}`;

export const semanticDiff = (oldExtracted, newExtracted) => `Compare two snapshots of a vendor's pricing.
Old: ${JSON.stringify(oldExtracted)}
New: ${JSON.stringify(newExtracted)}
Return JSON: {"changes":[{"plan_name":"","change_type":"price_up|price_down|plan_added|plan_removed|shrinkflation|packaging|copy|cosmetic","old_value":{},"new_value":{},"summary":"one factual sentence, UK English, include figures"}]}
shrinkflation = features removed/moved to higher tier, limits reduced, seat minimums added, at same or higher price. Empty changes array if nothing material.`;

export const newsjackDraft = (vendorName, event) => `Write a short LinkedIn post (UK English, max 90 words) reporting a detected pricing change. Dry watchdog tone, factual, no hashtags, no emojis, no exclamation marks, no marketing fluff. Include the figures and the date. End with: "Full price history: fetch-price.com/pricing-history/{slug}".

Vendor: ${vendorName}
Change: ${JSON.stringify(event)}`;
