/**
 * Map industry asset categories → curated whole-stock / surplus seller links.
 * Config: config/stock-sellers.json (copied beside this module on sync).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached = null;

export function loadStockSellersConfig() {
  if (cached) return cached;
  const candidates = [
    join(__dirname, "stock-sellers.json"),
    join(__dirname, "../../../config/stock-sellers.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      cached = JSON.parse(readFileSync(path, "utf8"));
      return cached;
    }
  }
  cached = { version: 0, sellers: [] };
  return cached;
}

/** Map asset_category / interest → seller tags (identity + aliases). */
const TAG_ALIASES = {
  "van-fleet": ["van-fleet", "vehicle-stock"],
  "vehicle-stock": ["vehicle-stock", "van-fleet"],
  "hgv-vehicles": ["hgv-vehicles", "van-fleet", "trailers"],
  trailers: ["trailers", "hgv-vehicles"],
  excavators: ["excavators", "plant"],
  "scaffold-towers": ["scaffold-towers", "plant", "scaffold-access"],
  "scaffold-access": ["scaffold-access", "scaffold-towers", "plant"],
  "cement-mixers": ["cement-mixers", "plant"],
  "power-tools": ["power-tools", "tools"],
  "van-tools": ["van-tools", "tools", "power-tools"],
  tools: ["tools", "power-tools"],
  "boiler-stock": ["boiler-stock", "parts-stock"],
  "pipe-threaders": ["pipe-threaders", "tools", "van-tools"],
  "copper-stock": ["copper-stock", "parts-stock"],
  "test-equipment": ["test-equipment", "tools", "IT"],
  "cable-drums": ["cable-drums", "parts-stock"],
  "ev-charge-units": ["ev-charge-units", "IT", "parts-stock"],
  "pallet-trucks": ["pallet-trucks", "warehouse-racking", "plant"],
  "warehouse-racking": ["warehouse-racking", "pallet-trucks"],
  "fuel-cards": ["fuel-cards"],
  "workshop-lifts": ["workshop-lifts", "plant", "tools"],
  "diagnostic-tools": ["diagnostic-tools", "test-equipment", "tools"],
  "parts-stock": ["parts-stock"],
  "tyre-equipment": ["tyre-equipment", "tools", "workshop-lifts"],
  plant: ["plant", "excavators", "tools"],
  catering: ["catering"],
  IT: ["IT", "test-equipment"],
};

export function expandTags(assetCategories = []) {
  const out = new Set();
  for (const raw of assetCategories) {
    const key = String(raw || "").trim();
    if (!key) continue;
    out.add(key);
    for (const t of TAG_ALIASES[key] || []) out.add(t);
  }
  return [...out];
}

/**
 * Pick 2–3 sellers whose tags overlap asset categories.
 * @param {string[]} assetCategories
 * @param {{ limit?: number, excludeIds?: string[] }} [opts]
 */
export function suggestStockSellers(assetCategories = [], opts = {}) {
  const limit = opts.limit ?? 3;
  const exclude = new Set(opts.excludeIds || []);
  const wanted = new Set(expandTags(assetCategories));
  const { sellers } = loadStockSellersConfig();

  const scored = (sellers || [])
    .filter((s) => s?.url && !exclude.has(s.id))
    .map((s) => {
      const tags = s.tags || [];
      const overlap = tags.filter((t) => wanted.has(t));
      return { seller: s, score: overlap.length, overlap };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.seller.name.localeCompare(b.seller.name));

  if (scored.length >= limit) {
    return scored.slice(0, limit).map((r) => mapSeller(r.seller, r.overlap));
  }

  // Thin match: pad with general industrial portals so packs never feel empty
  const general = (sellers || []).filter(
    (s) =>
      !exclude.has(s.id) &&
      !scored.some((r) => r.seller.id === s.id) &&
      (s.tags || []).some((t) => ["plant", "tools", "parts-stock", "van-fleet"].includes(t))
  );
  const padded = [
    ...scored.map((r) => r.seller),
    ...general,
  ].slice(0, limit);

  return padded.map((s) => {
    const overlap = (s.tags || []).filter((t) => wanted.has(t));
    return mapSeller(s, overlap);
  });
}

function mapSeller(s, overlap = []) {
  const out = {
    id: s.id,
    name: s.name,
    url: s.url,
    blurb: s.blurb,
    matched_tags: (overlap || []).slice(0, 4),
  };
  if (s.calendar_url) out.calendar_url = s.calendar_url;
  if (s.next_sale_note) out.next_sale_note = s.next_sale_note;
  return out;
}

/**
 * Optional eBay Browse query for job-lot / pallet / liquidation + keyword.
 * Soft-fail: returns null if EBAY_APP_ID missing or request fails.
 */
export async function optionalEbayJobLotHint(assetKeyword) {
  const appId = process.env.EBAY_APP_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!appId || !secret) return null;

  const q = ["job lot", "pallet", "liquidation", assetKeyword].filter(Boolean).join(" ");
  try {
    const basic = Buffer.from(`${appId}:${secret}`).toString("base64");
    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json();
    const params = new URLSearchParams({
      q,
      limit: "3",
      filter: "buyingOptions:{FIXED_PRICE|AUCTION},deliveryCountry:GB",
    });
    const browse = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        },
      }
    );
    if (!browse.ok) return null;
    const data = await browse.json();
    const items = (data.itemSummaries || []).slice(0, 3).map((it) => ({
      title: it.title,
      url: it.itemWebUrl,
      price: it.price?.value ? `£${it.price.value}` : null,
    }));
    if (!items.length) return null;
    return { query: q, items };
  } catch {
    return null;
  }
}
