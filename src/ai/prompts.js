// Prompt templates. Keep terse — Hermes handles these; Claude only on escalation.

export const EXTRACT_SCHEMA_HINT = `Return JSON exactly in this shape:
{"plans":[{"name":"","price":0,"currency":"GBP","period":"month|year|usage","unit":"per seat|flat|per GB|...","features":["..."],"notes":""}]}
Use null for unknown price ("contact sales" plans). No other keys.`;

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
