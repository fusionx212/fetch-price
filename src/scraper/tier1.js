// Tier 1: plain HTTP + cheerio. Cost ≈ £0. Handles ~80% of vendors.
import * as cheerio from 'cheerio';

const UA = 'FetchPriceBot/1.0 (+https://fetch-price.com/bot) price-history watchdog';

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return await res.text();
}

/** Try schema.org JSON-LD Offer/PriceSpecification first — cleanest source. */
function extractJsonLd($) {
  const plans = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const offers = node.offers ? (Array.isArray(node.offers) ? node.offers : [node.offers]) : [];
        for (const o of offers) {
          if (o.price != null) {
            plans.push({
              name: o.name || node.name || 'Plan',
              price: Number(o.price),
              currency: o.priceCurrency || 'GBP',
              period: 'month',
              unit: null,
              features: [],
              notes: 'jsonld'
            });
          }
        }
      }
    } catch { /* malformed ld+json — ignore */ }
  });
  return plans;
}

/** Selector-based extraction using vendor.selectors (self-healed by Tier 3). */
function extractWithSelectors($, sel) {
  const plans = [];
  $(sel.plan_container).each((_, el) => {
    const $el = $(el);
    const priceText = $el.find(sel.price).first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    plans.push({
      name: $el.find(sel.plan_name).first().text().trim() || 'Plan',
      price: Number.isFinite(price) ? price : null,
      currency: /\$/.test(priceText) ? 'USD' : /€/.test(priceText) ? 'EUR' : 'GBP',
      period: /yr|year|annual/i.test($el.find(sel.period).text()) ? 'year' : 'month',
      unit: null,
      features: $el.find(sel.features).map((_, f) => $(f).text().trim()).get().slice(0, 25),
      notes: 'selectors'
    });
  });
  return plans;
}

export async function tier1(vendor) {
  const html = await fetchHtml(vendor.pricing_url);
  const $ = cheerio.load(html);

  let plans = extractJsonLd($);
  if (!plans.length && vendor.selectors?.plan_container) {
    plans = extractWithSelectors($, vendor.selectors);
  }
  if (!plans.length) throw new Error('tier1: no plans extracted');

  return { extracted: { plans }, html, tier: 1 };
}
