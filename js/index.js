class FetchPrice {
  constructor(apiKey = process.env.FETCH_PRICE_API_KEY, baseUrl = "https://api.fetch-price.com") {
    if (!apiKey) throw new Error("Set FETCH_PRICE_API_KEY");
    this.apiKey = apiKey; this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async search(query, { max_results = 5, networks = [], currency = "GBP", min_price, max_price } = {}) {
    const body = { query, max_results, networks, currency };
    if (min_price != null) body.min_price = min_price;
    if (max_price != null) body.max_price = max_price;
    const r = await fetch(`${this.baseUrl}/api/query`, { method:"POST", headers:{"X-API-Key":this.apiKey,"Content-Type":"application/json"}, body:JSON.stringify(body) });
    return r.json();
  }
  async compare(product, networks) {
    const d = await this.search(product, { max_results: 10, networks });
    const byNet = {}; let cheapest = null;
    for (const p of d.results||[]) {
      if (!byNet[p.network]||p.price<byNet[p.network].price) byNet[p.network]=p;
      if (!cheapest||p.price<cheapest.price) cheapest=p;
    }
    return { product, cheapest, byNetwork: byNet, query_ms: d.query_ms };
  }
  async stats() { const r = await fetch(`${this.baseUrl}/api/stats`, { headers:{"X-API-Key":this.apiKey} }); return r.json(); }
}
export { FetchPrice }; export default FetchPrice;
