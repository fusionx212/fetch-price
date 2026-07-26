// fetch-price JavaScript SDK — one import, every affiliate network.
// npm install fetch-price

const DEFAULT_BASE = "https://api.fetch-price.com";

class FetchPrice {
  /**
   * @param {string} [apiKey] — API key from https://api.fetch-price.com/api/agents/register
   * @param {string} [baseUrl]
   */
  constructor(apiKey = process.env.FETCH_PRICE_API_KEY, baseUrl = DEFAULT_BASE) {
    if (!apiKey) throw new Error("No API key. Set FETCH_PRICE_API_KEY or pass to constructor.");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Search products across affiliate networks.
   * @param {string} query
   * @param {Object} [opts]
   * @returns {Promise<{results: Array, query_ms: number, results_count: number}>}
   */
  async search(query, { max_results = 5, networks = [], currency = "GBP", min_price, max_price } = {}) {
    const body = { query, max_results, networks, currency };
    if (min_price != null) body.min_price = min_price;
    if (max_price != null) body.max_price = max_price;

    const r = await fetch(`${this.baseUrl}/api/query`, {
      method: "POST",
      headers: { "X-API-Key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  /**
   * Compare a product across all networks.
   * @param {string} productName
   * @param {string[]} [networks]
   */
  async compare(productName, networks) {
    const data = await this.search(productName, { max_results: 10, networks });
    const byNetwork = {};
    let cheapest = null;

    for (const p of data.results || []) {
      const net = p.network;
      if (!byNetwork[net] || p.price < byNetwork[net].price) {
        byNetwork[net] = p;
      }
      if (!cheapest || p.price < cheapest.price) cheapest = p;
    }

    return { product: productName, cheapest, byNetwork, query_ms: data.query_ms };
  }

  /** Get platform stats */
  async stats() {
    const r = await fetch(`${this.baseUrl}/api/stats`, {
      headers: { "X-API-Key": this.apiKey },
    });
    return r.json();
  }
}

export { FetchPrice };
export default FetchPrice;
