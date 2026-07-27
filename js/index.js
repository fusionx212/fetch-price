const DEFAULT_BASE = "https://api.fetch-price.com";

class FetchPrice {
  // Keyless works on the free tier (50 lookups/month); a key raises limits and enables BYOK
  constructor(apiKey = process.env.FETCH_PRICE_API_KEY, baseUrl = DEFAULT_BASE) {
    this.apiKey = apiKey || null;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  #headers() {
    const h = { "Content-Type": "application/json" };
    if (this.apiKey) h["X-API-Key"] = this.apiKey;
    return h;
  }

  async search(query, { max_results = 5, networks, currency = "GBP", min_price, max_price } = {}) {
    const body = { query, max_results, currency };
    // Only send networks when the caller picked some — an empty array is rejected as
    // "no valid networks"; omitting it lets the API search everything available.
    if (networks && networks.length) body.networks = networks;
    if (min_price != null) body.min_price = min_price;
    if (max_price != null) body.max_price = max_price;
    const r = await fetch(`${this.baseUrl}/api/query`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async compare(product, networks) {
    const d = await this.search(product, { max_results: 10, networks });
    const byNetwork = {};
    let cheapest = null;
    for (const p of d.results || []) {
      // result_type "search_link" carries price 0 — it's a tracked fallback, not a real listing
      if (p.result_type === "search_link" || !p.price) continue;
      if (!byNetwork[p.network] || p.price < byNetwork[p.network].price) byNetwork[p.network] = p;
      if (!cheapest || p.price < cheapest.price) cheapest = p;
    }
    return { product, cheapest, byNetwork };
  }

  async stats() {
    const r = await fetch(`${this.baseUrl}/api/stats`, { headers: this.#headers() });
    return r.json();
  }

  async health() {
    const r = await fetch(`${this.baseUrl}/health`, { headers: this.#headers() });
    return r.json();
  }
}

export { FetchPrice };
export default FetchPrice;
