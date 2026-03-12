import logging

import httpx

from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)

CACHE_KEY = "interactions:{symbol}"

STRING_IDS_URL = "https://string-db.org/api/json/get_string_ids"
STRING_NETWORK_URL = "https://string-db.org/api/json/network"
STRING_ENRICHMENT_URL = "https://string-db.org/api/json/enrichment"


async def fetch_interactions(symbol: str) -> dict | None:
    """Fetch protein-protein interactions from STRING DB."""
    symbol = symbol.upper()
    cache_key = CACHE_KEY.format(symbol=symbol)
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("Interactions cache hit for %s", symbol)
        return cached

    logger.info("Fetching interactions for %s from STRING DB", symbol)

    try:
        # Step 1: Get interactions via network endpoint
        interactions = await _fetch_network(symbol)
        if not interactions:
            logger.info("No interactions found for %s", symbol)
            result: dict = {
                "center_gene": symbol,
                "interactions": [],
                "nodes": [],
                "enrichment": [],
            }
            await cache_set(redis_client, cache_key, result)
            return result

        # Step 2: Build node list from interactions
        nodes = _build_nodes(symbol, interactions)

        # Step 3: Get functional enrichment
        enrichment = await _fetch_enrichment(symbol)

        result = {
            "center_gene": symbol,
            "interactions": interactions,
            "nodes": nodes,
            "enrichment": enrichment,
        }

        await cache_set(redis_client, cache_key, result)
        logger.info(
            "Interactions cached for %s: %d interactions, %d nodes",
            symbol,
            len(interactions),
            len(nodes),
        )
        return result

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.info("No STRING data for %s", symbol)
        else:
            logger.error("STRING API error for %s: %s", symbol, exc)
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("STRING connection error for %s: %s", symbol, exc)
    except Exception as exc:
        logger.error("STRING unexpected error for %s: %s", symbol, exc)

    return None


async def _fetch_network(symbol: str) -> list[dict]:
    """Fetch interaction network from STRING DB."""
    params = {
        "identifiers": symbol,
        "species": 9606,
        "required_score": 700,
        "limit": 25,
        "caller_identity": "GeneXplor",
    }

    data = await fetch_json(STRING_NETWORK_URL, params=params)
    if not isinstance(data, list):
        return []

    interactions: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for entry in data:
        gene_a = entry.get("preferredName_A", "")
        gene_b = entry.get("preferredName_B", "")
        if not gene_a or not gene_b:
            continue

        # Avoid duplicate edges
        edge_key = tuple(sorted([gene_a, gene_b]))
        if edge_key in seen:
            continue
        seen.add(edge_key)

        interactions.append({
            "gene_a": gene_a,
            "gene_b": gene_b,
            "combined_score": float(entry.get("score", 0)),
            "experimental_score": float(entry.get("ascore", 0)),
            "database_score": float(entry.get("dscore", 0)),
            "textmining_score": float(entry.get("tscore", 0)),
            "coexpression_score": float(entry.get("escore", 0)),
        })

    return interactions


def _build_nodes(center: str, interactions: list[dict]) -> list[dict]:
    """Build node list with interaction counts."""
    node_counts: dict[str, int] = {}
    for ix in interactions:
        for gene in (ix["gene_a"], ix["gene_b"]):
            node_counts[gene] = node_counts.get(gene, 0) + 1

    # Ensure center gene is present
    if center not in node_counts:
        node_counts[center] = 0

    return [
        {
            "gene_symbol": gene,
            "is_center": gene == center,
            "interaction_count": count,
        }
        for gene, count in sorted(node_counts.items(), key=lambda x: -x[1])
    ]


async def _fetch_enrichment(symbol: str) -> list[dict]:
    """Fetch functional enrichment (GO terms) from STRING DB."""
    try:
        params = {
            "identifiers": symbol,
            "species": 9606,
            "caller_identity": "GeneXplor",
        }

        data = await fetch_json(STRING_ENRICHMENT_URL, params=params)
        if not isinstance(data, list):
            return []

        enrichment: list[dict] = []
        category_map = {
            "Process": "BP",
            "Function": "MF",
            "Component": "CC",
        }

        for entry in data:
            cat = entry.get("category", "")
            # Only include GO terms
            if cat not in ("Process", "Function", "Component"):
                continue

            enrichment.append({
                "term": entry.get("term", ""),
                "description": entry.get("description", ""),
                "p_value": float(entry.get("p_value", 1.0)),
                "category": category_map.get(cat, cat),
            })

        # Sort by p-value and take top 10
        enrichment.sort(key=lambda x: x["p_value"])
        return enrichment[:10]

    except Exception as exc:
        logger.warning("Failed to fetch enrichment for %s: %s", symbol, exc)
        return []
