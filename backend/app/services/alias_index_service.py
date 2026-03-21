"""
Gene alias index from HGNC Complete Set.
Maps all aliases, previous symbols, Ensembl IDs, and Entrez IDs to canonical symbols.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import redis.asyncio as aioredis

from app.utils.http_client import fetch_json
from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

HGNC_URL = "https://ftp.ebi.ac.uk/pub/databases/genenames/hgnc/json/hgnc_complete_set.json"
REDIS_KEY = "search:alias_index"
REDIS_TTL = 7 * 24 * 3600


class AliasIndex:
    def __init__(self) -> None:
        self.loaded = False
        self.alias_to_symbol: dict[str, str] = {}
        self.ensembl_to_symbol: dict[str, str] = {}
        self.entrez_to_symbol: dict[str, str] = {}
        self.count = 0

    def build(self, data: dict[str, Any]) -> None:
        self.alias_to_symbol.clear()
        self.ensembl_to_symbol.clear()
        self.entrez_to_symbol.clear()

        for raw in data:
            symbol = raw.get("s", "")
            if not symbol:
                continue
            symbol_upper = symbol.upper()

            for alias in raw.get("a", []):
                if alias:
                    self.alias_to_symbol[alias.upper()] = symbol_upper
                    self.alias_to_symbol[alias.lower()] = symbol_upper

            for prev in raw.get("p", []):
                if prev:
                    self.alias_to_symbol[prev.upper()] = symbol_upper
                    self.alias_to_symbol[prev.lower()] = symbol_upper

            ens_id = raw.get("e", "")
            if ens_id:
                self.ensembl_to_symbol[ens_id] = symbol_upper

            entrez = raw.get("n", "")
            if entrez:
                self.entrez_to_symbol[str(entrez)] = symbol_upper

        self.count = len(self.alias_to_symbol)
        self.loaded = True

    def resolve(self, query: str) -> str | None:
        """Resolve an alias, prev symbol, Ensembl ID, or Entrez ID to canonical symbol."""
        q = query.strip()
        # Ensembl ID
        if q.startswith("ENSG"):
            return self.ensembl_to_symbol.get(q)
        # Entrez ID (pure number)
        if q.isdigit():
            return self.entrez_to_symbol.get(q)
        # Alias / previous symbol
        return self.alias_to_symbol.get(q.upper()) or self.alias_to_symbol.get(q.lower())


_alias_index = AliasIndex()


def get_alias_index() -> AliasIndex:
    return _alias_index


async def load_alias_index(redis_client: aioredis.Redis) -> None:
    global _alias_index
    t0 = time.time()

    cached = await cache_get(redis_client, REDIS_KEY)
    if cached:
        _alias_index.build(cached)
        logger.info(
            "Alias index loaded from Redis: %d aliases (%.1fs)",
            _alias_index.count, time.time() - t0,
        )
        return

    logger.info("Downloading alias index from HGNC...")
    try:
        data = await _download_hgnc()
        if data:
            _alias_index.build(data)
            await cache_set(redis_client, REDIS_KEY, data, REDIS_TTL)
            logger.info(
                "Alias index downloaded & cached: %d aliases (%.1fs)",
                _alias_index.count, time.time() - t0,
            )
        else:
            logger.error("Failed to load alias index")
    except Exception as e:
        logger.error("Alias index download failed: %s", e)


async def _download_hgnc() -> list[dict[str, Any]]:
    """Download HGNC complete set and extract alias data."""
    try:
        from app.utils.http_client import get_http_client
        client = get_http_client()
        resp = await client.get(HGNC_URL, timeout=120.0)
        resp.raise_for_status()
        raw = resp.json()

        docs = raw.get("response", {}).get("docs", [])
        result: list[dict[str, Any]] = []
        for doc in docs:
            symbol = doc.get("symbol", "")
            if not symbol:
                continue
            entry: dict[str, Any] = {"s": symbol}
            aliases = doc.get("alias_symbol", [])
            prev = doc.get("prev_symbol", [])
            if aliases:
                entry["a"] = aliases
            if prev:
                entry["p"] = prev
            ens = doc.get("ensembl_gene_id", "")
            if ens:
                entry["e"] = ens
            entrez = doc.get("entrez_id", "")
            if entrez:
                entry["n"] = str(entrez)
            result.append(entry)
        return result
    except Exception as e:
        logger.error("HGNC download failed: %s", e)
        return []
