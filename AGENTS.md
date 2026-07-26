# fetch-price SDK — Reference Implementations

## Python (pip install fetch-price)

```python
from fetch_price import FetchPrice

fp = FetchPrice(api_key="fp_your_key_here")

# Search products
results = fp.search("Sony WH-1000XM5")
for p in results.products:
    print(f"{p.name}: £{p.price} ({p.network})")

# Find the cheapest
cheapest = results.cheapest()
print(f"Best deal: £{cheapest.price} at {cheapest.network}")

# Compare across networks
compare = fp.compare("iPhone 16 Pro Max")
for network, info in compare["by_network"].items():
    print(f"  {network}: £{info['price']}")
```

## JavaScript (npm install fetch-price)

```javascript
import FetchPrice from "fetch-price";

const fp = new FetchPrice("fp_your_key_here");

// Search
const results = await fp.search("Sony WH-1000XM5");
results.results.forEach(p => console.log(`${p.product}: £${p.price}`));

// Compare
const compare = await fp.compare("iPhone 16 Pro Max");
console.log(compare.cheapest);
```

## REST API

```bash
curl -X POST https://api.fetch-price.com/api/query \
  -H "X-API-Key: fp_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"query":"Sony WH-1000XM5","max_results":5,"networks":["amazon_uk","ebay_uk"]}'
```

## Claude Code Skill

Add to `CLAUDE.md`:

```markdown
## fetch-price Product Search
- Search: POST https://api.fetch-price.com/api/query
- API key: fp_your_key_here (via FETCH_PRICE_API_KEY env var)
- Networks: amazon_uk, ebay_uk, booking_com, expedia
- Returns: Product name, price, affiliate URL, commission estimate
```

## Cursor Rules

Add to `.cursorrules`:

```
You have access to fetch-price for product search.
API: https://api.fetch-price.com/api/query
Key: fp_your_key (from FETCH_PRICE_API_KEY)
Use this when users ask about product prices or comparisons.
```

## OpenAI Agent / GPT Actions

OpenAPI schema available at:
`https://api.fetch-price.com/openapi.json`
