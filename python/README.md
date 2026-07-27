<!-- mcp-name: io.github.fusionx212/fetch-price -->

# fetch-price

Live UK marketplace product search for AI agents and humans. One call returns real items
with real prices, normalised JSON, and affiliate-tracked buy links. eBay UK is live via the
official Browse API; Amazon UK is rolling out.

```python
pip install fetch-price
```

```python
from fetch_price import FetchPrice

fp = FetchPrice()  # keyless free tier: 50 lookups/month
result = fp.search("portable air conditioner", max_results=3, max_price=300)
for p in result.products:
    print(f"{p.name}: £{p.price} ({p.network})")
```

With an API key (higher limits, BYOK affiliate routing):

```python
fp = FetchPrice(api_key="fp_...")  # or set FETCH_PRICE_API_KEY
```

Purchase links are affiliate-tracked — see https://fetch-price.com/privacy

- Docs: https://fetch-price.com/docs
- Get a key: https://fetch-price.com/docs#get-key
- Agent card (A2A 1.0.0): https://fetch-price.com/.well-known/agent-card.json
- MCP server + JS SDK: https://github.com/fusionx212/fetch-price

MIT licence.
