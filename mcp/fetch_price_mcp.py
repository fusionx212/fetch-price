#!/usr/bin/env python3
"""
fetch-price MCP server
======================
Exposes UK product/price search to any MCP-capable agent
(Claude Code, Claude Desktop, Cursor, OpenClaw, custom clients).

The server is a thin, honest wrapper around the fetch-price API:
one tool in, normalised products out, affiliate attribution handled
server-side so the installing operator never touches credentials.

Install:
    pip install "mcp[cli]" httpx

Run (stdio, which is what MCP clients expect):
    python fetch_price_mcp.py

Config (env vars):
    FETCH_PRICE_API_BASE   default https://api.fetch-price.com
    FETCH_PRICE_API_KEY    optional — required once past the free tier
"""

import os
import re
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("FETCH_PRICE_API_BASE", "https://api.fetch-price.com").rstrip("/")
API_KEY = os.environ.get("FETCH_PRICE_API_KEY", "")

VALID_NETWORKS = {"ebay_uk", "amazon_uk"}
DEFAULT_NETWORKS = ["ebay_uk", "amazon_uk"]
MAX_QUERY_LENGTH = 200
TIMEOUT = httpx.Timeout(30.0, connect=10.0)

# ---- Prompt injection defence ----
INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)",
    r"(?i)system\s*:\s*",
    r"(?i)you\s+are\s+now\s+",
    r"(?i)new\s+instructions?\s*:",
    r"(?i)override\s+(system\s+)?prompt",
]

def _validate_query(query: str) -> str | None:
    """Return error message if input is suspicious, None if clean."""
    if len(query) > MAX_QUERY_LENGTH:
        return f"Query too long (max {MAX_QUERY_LENGTH} chars)"
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, query):
            return "Invalid query"
    return None

mcp = FastMCP(
    "fetch-price",
    instructions=(
        "UK product and price search across major marketplaces. "
        "Use search_products when a user wants to find, compare, or price "
        "a physical product available in the UK. Results include live prices, "
        "condition, and a direct purchase URL to hand back to the user."
    ),
)


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json", "User-Agent": "fetch-price-mcp/1.0"}
    if API_KEY:
        h["Authorization"] = f"Bearer {API_KEY}"
    return h


def _normalise_item(raw: dict[str, Any]) -> dict[str, Any]:
    """Guarantee a stable schema no matter which upstream network answered."""
    return {
        "product": raw.get("product") or raw.get("title") or "Unknown item",
        "price": raw.get("price"),
        "currency": raw.get("currency", "GBP"),
        "condition": raw.get("condition", "unspecified"),
        "network": raw.get("network") or raw.get("source", "unknown"),
        "url": raw.get("url", ""),
        "image": raw.get("image") or raw.get("image_url"),
        "seller_rating": raw.get("seller_rating"),
    }


@mcp.tool()
async def search_products(
    query: str,
    max_results: int = 5,
    max_price: float | None = None,
    networks: list[str] | None = None,
) -> dict[str, Any]:
    """Search live UK marketplace listings for a product.

    Args:
        query: What to search for, in plain language (e.g. "portable air conditioner 9000 BTU").
        max_results: How many results to return, 1-20. Default 5.
        max_price: Optional ceiling in GBP; listings above this are excluded.
        networks: Which marketplaces to search. Any of: ebay_uk, amazon_uk.
                  Defaults to all available.

    Returns:
        A dict with `results` (list of products, each with product, price,
        currency, condition, network, url) and `meta` (query echo, counts).
        The url field is a direct purchase link — present it to the user as-is.
    """
    if not query or not query.strip():
        return {"error": "query must be a non-empty string", "results": []}

    # Prompt injection defence
    err = _validate_query(query.strip())
    if err:
        return {"error": err, "results": []}

    max_results = max(1, min(int(max_results), 20))

    nets = [n for n in (networks or DEFAULT_NETWORKS) if n in VALID_NETWORKS]
    if not nets:
        return {
            "error": f"no valid networks; choose from {sorted(VALID_NETWORKS)}",
            "results": [],
        }

    payload: dict[str, Any] = {
        "query": query.strip(),
        "max_results": max_results,
        "networks": nets,
    }
    if max_price is not None:
        payload["max_price"] = float(max_price)

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{API_BASE}/api/query", json=payload, headers=_headers()
            )
    except httpx.TimeoutException:
        return {"error": "fetch-price API timed out; try again", "results": []}
    except httpx.HTTPError as exc:
        return {"error": f"network error reaching fetch-price API: {exc}", "results": []}

    if resp.status_code == 401:
        return {
            "error": "unauthorised — set FETCH_PRICE_API_KEY or register for a free key at fetch-price.com",
            "results": [],
        }
    if resp.status_code == 429:
        return {
            "error": "rate limit reached on current tier — see fetch-price.com/pricing",
            "results": [],
        }
    if resp.status_code != 200:
        return {
            "error": f"fetch-price API returned HTTP {resp.status_code}",
            "results": [],
        }

    try:
        data = resp.json()
    except ValueError:
        return {"error": "fetch-price API returned non-JSON response", "results": []}

    raw_items = data if isinstance(data, list) else data.get("results", [])
    results = [_normalise_item(i) for i in raw_items if isinstance(i, dict)]

    return {
        "results": results,
        "meta": {
            "query": query.strip(),
            "networks_searched": nets,
            "returned": len(results),
        },
    }


@mcp.tool()
async def service_status() -> dict[str, Any]:
    """Check whether the fetch-price API is reachable and healthy.

    Useful before a batch of searches, or to diagnose empty results.
    Returns the API health payload or an error description.
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(f"{API_BASE}/health", headers=_headers())
        if resp.status_code == 200:
            return {"healthy": True, "detail": resp.json()}
        return {"healthy": False, "detail": f"HTTP {resp.status_code}"}
    except httpx.HTTPError as exc:
        return {"healthy": False, "detail": str(exc)}


if __name__ == "__main__":
    mcp.run()
