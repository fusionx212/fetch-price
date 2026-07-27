# fetch-price

Live UK marketplace product search for AI agents and humans. One call returns real items with
real prices, normalised JSON, and affiliate-tracked buy links. eBay UK is live via the official
Browse API; Amazon UK is rolling out.

```bash
npm install fetch-price
```

```js
import FetchPrice from "fetch-price";

const fp = new FetchPrice();            // keyless free tier: 50 lookups/month
const r = await fp.search("portable air conditioner", { max_results: 3, max_price: 300 });
for (const p of r.results) {
  console.log(`${p.product}: £${p.price} (${p.network}) -> ${p.url}`);
}
```

With an API key (higher limits, BYOK affiliate routing):

```js
const fp = new FetchPrice("fp_...");    // or set FETCH_PRICE_API_KEY
```

Every result carries a `result_type`: `"item"` is a real listing, `"search_link"` is a tracked
marketplace search fallback with `price: 0` (served for networks not yet live, or if the upstream
API is briefly unavailable). `compare()` ignores fallbacks.

- Docs: https://fetch-price.com/docs
- Get a key: https://fetch-price.com/docs#get-key
- Agent card (A2A): https://fetch-price.com/.well-known/agent-card.json
- MCP server + Python SDK: https://github.com/fusionx212/fetch-price

MIT licence.
