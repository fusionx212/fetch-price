"""fetch-price Python SDK — pip install fetch-price"""
import os, json, requests
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

DEFAULT_BASE = "https://api.fetch-price.com"

@dataclass
class Product:
    name: str; price: float; currency: str; network: str; url: str
    commission_estimate: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class QueryResult:
    products: List[Product]; query_ms: int; results_count: int
    def cheapest(self): return min(self.products, key=lambda p: p.price) if self.products else None
    def __repr__(self): return f"QueryResult({self.results_count} products, {self.query_ms}ms)"

class FetchPrice:
    def __init__(self, api_key: Optional[str] = None, base_url: str = DEFAULT_BASE):
        self.api_key = api_key or os.getenv("FETCH_PRICE_API_KEY")
        if not self.api_key: raise ValueError("Set FETCH_PRICE_API_KEY or pass api_key=")
        self.base_url = base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"X-API-Key": self.api_key, "Content-Type": "application/json"})
    
    def search(self, query: str, max_results: int = 5, networks: Optional[List[str]] = None, currency: str = "GBP", min_price: Optional[float] = None, max_price: Optional[float] = None) -> QueryResult:
        payload = {"query": query, "max_results": max_results, "networks": networks or [], "currency": currency}
        if min_price is not None: payload["min_price"] = min_price
        if max_price is not None: payload["max_price"] = max_price
        r = self._session.post(f"{self.base_url}/api/query", json=payload); r.raise_for_status()
        data = r.json()
        products = [Product(name=p["product"], price=p["price"], currency=p.get("currency", currency), network=p["network"], url=p["url"], commission_estimate=p.get("commission_estimate"), metadata={k:v for k,v in p.items() if k not in ("product","price","currency","network","url","commission_estimate")}) for p in data.get("results", [])]
        return QueryResult(products=products, query_ms=data.get("query_ms", 0), results_count=data.get("results_count", len(products)))
    
    def stats(self) -> dict:
        r = self._session.get(f"{self.base_url}/api/stats"); r.raise_for_status(); return r.json()
    
    def compare(self, product_name: str, networks: Optional[List[str]] = None) -> dict:
        result = self.search(product_name, max_results=10, networks=networks)
        by_network = {}
        for p in result.products:
            if p.network not in by_network or p.price < by_network[p.network].price: by_network[p.network] = p
        cheapest = result.cheapest()
        return {"product":product_name,"cheapest":{"network":cheapest.network,"price":cheapest.price} if cheapest else None,"by_network":{n:{"price":p.price,"url":p.url} for n,p in sorted(by_network.items())},"query_ms":result.query_ms}

def search(query: str, **kwargs) -> QueryResult: return FetchPrice().search(query, **kwargs)
def compare(product: str, **kwargs) -> dict: return FetchPrice().compare(product, **kwargs)
