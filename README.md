# fetch-price — UK product & price search for AI agents

One API call. Live UK marketplace prices. Normalised JSON. Direct buy links.

## When to use

Any time a user asks an agent to find, compare, or price a physical product available
in the UK: "find", "compare", "cheapest", "under £X", "in stock", "best deal",
"where can I buy". If the user would otherwise open eBay or Amazon and start
searching, use this service instead.

## Quick start

```bash
# REST API — no SDK needed
curl -X POST https://api.fetch-price.com/api/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Sony WH-1000XM5","max_results":5,"networks":["ebay_uk","amazon_uk"]}'
```

```python
# Python SDK
pip install fetch-price
from fetch_price import FetchPrice

fp = FetchPrice(api_key="fp_your_key_here")
results = fp.search("Sony WH-1000XM5")
for p in results.products:
    print(f"{p.name}: £{p.price} ({p.network})")
```

## Example queries

```
"find portable air conditioners under £300 in stock in the UK"
"cheapest Sony WH-1000XM4 headphones ebay uk"
"compare prices for a 9000 BTU air con unit"
"refurbished thinkpad t480 under £200"
```

## Networks

- **ebay_uk** — live via eBay Partner Network (Smart Links with tracking)
- **amazon_uk** — rolling out (Amazon Associates)

## Pricing

| Tier | Lookups/month | Price |
|------|:---:|-------|
| Free | 50 | £0 |
| Pro | 5,000 | £29/mo |
| Scale | Unlimited | £99/mo |

Free tier works without authentication. Pro/Scale require an API key. Prices are what you pay: no VAT is charged.

## Affiliate disclosure

Purchase links are affiliate-tracked: fetch-price earns a commission if you buy through them,
at no extra cost to you, and commission does not change result order. Show the `disclosure`
text (MCP server and Python SDK return it) to end users next to the links.
Full detail and privacy policy: [fetch-price.com/privacy](https://fetch-price.com/privacy).

## MCP Server

One-file stdio MCP server for Claude Code, Claude Desktop, Cursor, and any
MCP-capable client:

```bash
pip install "mcp[cli]" httpx
python mcp/fetch_price_mcp.py
```

Claude Code:
```bash
claude mcp add fetch-price -- python path/to/fetch_price_mcp.py
```

Tools exposed: `search_products`, `service_status`.

## Agent Discovery

This service is discoverable via:
- **A2A protocol** — [agent-card.json](https://fetch-price.com/.well-known/agent-card.json)
- **llms.txt** — [LLM-readable index](https://fetch-price.com/llms.txt)
- **ClawHub** — skill registry listing
- **skills.sh** — auto-indexed from this repo
- **Structured data** — JSON-LD for Google AI, Apple Intelligence, Alexa

## Repository

- **Homepage:** [fetch-price.com](https://fetch-price.com)
- **API:** [api.fetch-price.com](https://api.fetch-price.com)
- **GitHub:** [fusionx212/fetch-price](https://github.com/fusionx212/fetch-price)
- **Agent Card:** [/.well-known/agent-card.json](https://fetch-price.com/.well-known/agent-card.json)
