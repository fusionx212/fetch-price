# fetch-price Agentic Kit

Four pieces that turn the CLAW prototype into something other people's agents
can actually find, install, and route money through. Deploy in this order.

## 0. Verify before you trust (verify.sh)

Run `bash verify.sh` from a machine **outside your network** (phone hotspot
works). It tests every claim in the Hermes status report — homepage, API
health, a real product query, affiliate tags in returned URLs, agent-card,
llms.txt, sitemap, JSON-LD, the GitHub repo, and whether `pip install
fetch-price` / `npm install fetch-price` actually resolve.

Anything it marks FAIL is a ✅ that isn't real yet. Fix those first; nothing
downstream matters until the API answers from the public internet **and the
returned URLs carry your affiliate tracking** — that line is your revenue.

## 1. The product agents install (mcp_server/)

`fetch_price_mcp.py` is the MCP server operators add to their agents.

```bash
pip install "mcp[cli]" httpx
python mcp_server/fetch_price_mcp.py   # runs on stdio
```

Claude Code (operator's machine):

```bash
claude mcp add fetch-price -- python /path/to/fetch_price_mcp.py
```

Claude Desktop / Cursor (claude_desktop_config.json / mcp.json):

```json
{
  "mcpServers": {
    "fetch-price": {
      "command": "python",
      "args": ["/path/to/fetch_price_mcp.py"],
      "env": { "FETCH_PRICE_API_KEY": "their_key_or_empty_for_free_tier" }
    }
  }
}
```

Tools exposed: `search_products` (query, max_results, max_price, networks)
and `service_status`. The server normalises whatever the API returns into a
stable schema, so upstream changes on CLAW don't break installed agents.

Note: current MCP client docs are worth checking when you publish — commands
drift. See https://docs.claude.com/en/docs/claude-code/overview for Claude
Code's current MCP syntax.

## 2. The discovery layer (discovery/)

- `agent-card.json` → serve at `https://fetch-price.com/.well-known/agent-card.json`
  (A2A convention; keep a copy at the root too).
- `llms.txt` → serve at `https://fetch-price.com/llms.txt`.

Both are written to be routing-friendly: concrete example queries, explicit
"when to use / when not", GBP and UK signals throughout. Registries and LLM
crawlers match on those phrases.

## 3. The registry listing (SKILL.md)

This is the marketing asset. Its description block is deliberately stuffed
with the *user phrasings* that should route to you ("under £100", "cheapest",
"in stock", "is this a good deal") because registry search and LLM tool
selection both key on description text. Publish it to ClawHub and mirror it
in the GitHub repo root so skills.sh auto-indexes it.

## Sequencing reality check

1. verify.sh passes on API + affiliate-tag lines
2. MCP server tested end-to-end from an outside machine against the live API
3. Discovery files deployed, re-run verify.sh — all green
4. THEN publish SKILL.md to registries and ship the PyPI/npm packages
   (never before — a listing that 404s or a `pip install` that fails burns
   trust with exactly the operators you need first)

One honest caveat: the Hermes doc claims PyPI and npm packages exist. If
verify.sh says they don't, publishing them is a real task (PyPI account,
build, twine upload) — say the word and that's the next thing to build.
