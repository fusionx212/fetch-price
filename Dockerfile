# fetch-price MCP server — stdio transport.
#
# Runs with no configuration and no API key: the free tier (50 lookups/month)
# is keyless, so introspection and tool calls work unattended in a sandbox.
# Set FETCH_PRICE_API_KEY only to raise limits or route your own affiliate tag.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first so layers cache when only the server changes
RUN pip install --no-cache-dir "mcp[cli]>=1.2.0" "httpx>=0.27"

COPY mcp/fetch_price_mcp.py /app/fetch_price_mcp.py

# Non-root: the server needs no write access to anything
RUN useradd --create-home --uid 10001 mcp && chown -R mcp:mcp /app
USER mcp

# MCP speaks JSON-RPC over stdin/stdout — no ports, no healthcheck endpoint
ENTRYPOINT ["python", "/app/fetch_price_mcp.py"]
