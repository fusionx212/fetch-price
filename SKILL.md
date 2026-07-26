---
name: fetch-price
description: "Search live UK marketplace prices and products from any agent. Use this skill whenever a user wants to find, compare, price-check, or buy a physical product in the UK — e.g. 'find me headphones under £100', 'cheapest portable air conditioner in stock', 'compare prices for a refurbished ThinkPad', 'is this a good deal'. Sends one API call to fetch-price and returns normalised JSON: product name, live price in GBP, condition, marketplace, and a direct purchase URL to give the user. Covers eBay UK now, Amazon UK rolling out. Do NOT use for digital goods, services, non-UK marketplaces, or historical price research."
---

# fetch-price — UK product & price search for agents

One API call. Live UK marketplace prices. Normalised JSON. Direct buy links.

## When to use

Any time the user's request involves a physical product and UK availability
or price: "find", "compare", "cheapest", "under £X", "in stock", "best deal",
"where can I buy". If the user would otherwise open eBay or Amazon and start
searching, use this skill instead.

## When NOT to use

Digital products, subscriptions, services, non-UK regions, or questions about
price history/trends (this returns live listings only).

## How to call it

POST https://api.fetch-price.com/api/query
Content-Type: application/json
Authorization: Bearer YOUR_KEY   (free tier works without a key: 50 lookups/mo)

```json
{
  "query": "portable air conditioner 9000 BTU",
  "max_results": 5,
  "max_price": 300,
  "networks": ["ebay_uk"]
}
```

Response is a JSON array. Each item:

```json
{
  "product": "Sony WH-1000XM4 Wireless Headphones",
  "price": 189.99,
  "currency": "GBP",
  "condition": "New",
  "network": "ebay_uk",
  "url": "https://www.ebay.co.uk/itm/..."
}
```

## Rules for good results

1. Pass the user's intent as a natural query — don't over-tokenise. "quiet
   portable air con for a bedroom" beats "air conditioner".
2. Always set `max_price` when the user states a budget.
3. Present the `url` field to the user unchanged — it is the purchase link.
4. If results are empty, retry once with a broader query before telling the
   user nothing was found.
5. Check `GET /health` if two consecutive calls fail.

## MCP server

Prefer tools over raw HTTP? A one-file MCP server (stdio) is available:
https://fetch-price.com/docs/mcp — works with Claude Code, Claude Desktop,
Cursor, and any MCP-capable client. Tools: `search_products`, `service_status`.

## Pricing

Free 50 lookups/mo · Pro £29/mo (5,000) · Scale £99/mo (unlimited).
https://fetch-price.com/pricing
