import logging

import httpx

from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json, fetch_text

logger = logging.getLogger(__name__)

CACHE_KEY = "pathways:{symbol}"

REACTOME_SEARCH_URL = "https://reactome.org/ContentService/search/query"
REACTOME_EVENTS_URL = "https://reactome.org/ContentService/data/pathway/{pathway_id}/containedEvents"
KEGG_FIND_URL = "https://rest.kegg.jp/find/genes/{query}"
KEGG_LINK_URL = "https://rest.kegg.jp/link/pathway/{gene_id}"
KEGG_GET_URL = "https://rest.kegg.jp/get/{pathway_id}"


async def fetch_pathways(symbol: str) -> dict:
    """Fetch pathway data from Reactome (primary) and KEGG (fallback)."""
    symbol = symbol.upper()
    cache_key = CACHE_KEY.format(symbol=symbol)
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("Pathways cache hit for %s", symbol)
        return cached

    logger.info("Fetching pathways for %s", symbol)

    pathways: list[dict] = []

    # ── Reactome (primary) ──
    reactome_pathways = await _fetch_reactome(symbol)
    pathways.extend(reactome_pathways)

    # ── KEGG (secondary) ──
    kegg_pathways = await _fetch_kegg(symbol)
    # Only add KEGG pathways not already covered by Reactome (by name similarity)
    reactome_names = {p["name"].lower() for p in pathways}
    for kp in kegg_pathways:
        if kp["name"].lower() not in reactome_names:
            pathways.append(kp)

    result = {
        "pathways": pathways,
        "total_pathways": len(pathways),
    }

    await cache_set(redis_client, cache_key, result)
    logger.info("Pathways cached for %s: %d pathways", symbol, len(pathways))
    return result


async def _fetch_reactome(symbol: str) -> list[dict]:
    """Fetch pathways from Reactome Search API."""
    pathways: list[dict] = []
    try:
        import re

        params = {
            "query": symbol,
            "species": "Homo sapiens",
            "types": "Pathway",
            "cluster": "true",
        }
        data = await fetch_json(REACTOME_SEARCH_URL, params=params)

        if not isinstance(data, dict):
            return []

        # Extract entries from grouped results
        entries: list[dict] = []
        for group in data.get("results", []):
            entries.extend(group.get("entries", []))

        # Strip HTML tags from names
        tag_re = re.compile(r"<[^>]+>")

        for entry in entries[:20]:  # Limit to 20 pathways
            # Filter for Homo sapiens
            species = entry.get("species", [])
            if isinstance(species, list):
                species_names = [s if isinstance(s, str) else s.get("displayName", "") for s in species]
                if species_names and not any("Homo sapiens" in s for s in species_names):
                    continue

            pathway_id = entry.get("stId", entry.get("id", ""))
            raw_name = entry.get("name", entry.get("displayName", ""))
            pathway_name = tag_re.sub("", raw_name).strip()

            if not pathway_id or not pathway_name:
                continue

            category = _reactome_schema_to_category("", pathway_name)

            # Get sub-events for this pathway
            sub_events = await _fetch_reactome_events(pathway_id)

            gene_count = len(sub_events) if sub_events else 0

            # Parse summation — may be a string with HTML
            summation = entry.get("summation", "")
            if isinstance(summation, list):
                summation = summation[0] if summation else ""
            if isinstance(summation, dict):
                summation = summation.get("text", "")
            description = tag_re.sub("", str(summation))[:300]

            diagram_url = f"https://reactome.org/PathwayBrowser/#/{pathway_id}"

            pathways.append({
                "id": pathway_id,
                "name": pathway_name,
                "source": "Reactome",
                "category": category,
                "description": description,
                "url": diagram_url,
                "gene_count": gene_count,
                "sub_events": sub_events[:10],
            })

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.info("No Reactome data for %s", symbol)
        else:
            logger.error("Reactome API error for %s: %s", symbol, exc)
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("Reactome connection error for %s: %s", symbol, exc)
    except Exception as exc:
        logger.error("Reactome unexpected error for %s: %s", symbol, exc)

    return pathways


async def _fetch_reactome_events(pathway_id: str) -> list[str]:
    """Fetch sub-events/reactions for a Reactome pathway."""
    try:
        url = REACTOME_EVENTS_URL.format(pathway_id=pathway_id)
        data = await fetch_json(url)
        if isinstance(data, list):
            return [
                e.get("displayName", e.get("name", ""))
                for e in data[:10]
                if isinstance(e, dict)
            ]
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout):
        pass
    except Exception as exc:
        logger.debug("Failed to fetch Reactome events for %s: %s", pathway_id, exc)
    return []


async def _fetch_kegg(symbol: str) -> list[dict]:
    """Fetch pathways from KEGG REST API."""
    pathways: list[dict] = []
    try:
        # Step 1: Find gene ID
        find_url = KEGG_FIND_URL.format(query=f"hsa:{symbol}")
        find_text = await fetch_text(find_url)
        if not find_text.strip():
            logger.info("No KEGG gene found for %s", symbol)
            return []

        # Parse gene ID from first line: "hsa:7157\tTP53, BCC7..."
        first_line = find_text.strip().split("\n")[0]
        gene_id = first_line.split("\t")[0].strip()
        if not gene_id:
            return []

        # Step 2: Get linked pathways
        link_url = KEGG_LINK_URL.format(gene_id=gene_id)
        link_text = await fetch_text(link_url)
        if not link_text.strip():
            return []

        # Parse pathway IDs: "hsa:7157\tpath:hsa05200\n..."
        pathway_ids: list[str] = []
        for line in link_text.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) >= 2:
                pid = parts[1].strip().replace("path:", "")
                pathway_ids.append(pid)

        # Step 3: Fetch details for each pathway (limit to 15)
        for pid in pathway_ids[:15]:
            pathway = await _fetch_kegg_pathway_detail(pid)
            if pathway:
                pathways.append(pathway)

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.info("No KEGG data for %s", symbol)
        else:
            logger.error("KEGG API error for %s: %s", symbol, exc)
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("KEGG connection error for %s: %s", symbol, exc)
    except Exception as exc:
        logger.error("KEGG unexpected error for %s: %s", symbol, exc)

    return pathways


async def _fetch_kegg_pathway_detail(pathway_id: str) -> dict | None:
    """Fetch details for a single KEGG pathway."""
    try:
        url = KEGG_GET_URL.format(pathway_id=pathway_id)
        text = await fetch_text(url)
        if not text.strip():
            return None

        name = ""
        description = ""
        category = ""
        gene_count = 0

        for line in text.split("\n"):
            if line.startswith("NAME"):
                name = line[12:].strip().rstrip(" - Homo sapiens (human)")
            elif line.startswith("DESCRIPTION"):
                description = line[12:].strip()
            elif line.startswith("CLASS"):
                category = line[12:].strip().split(";")[0].strip()
            elif line.startswith("GENE"):
                gene_count = 1
            elif gene_count > 0 and line.startswith("            "):
                gene_count += 1
            elif gene_count > 0 and not line.startswith(" "):
                pass  # End of GENE section

        if not name:
            return None

        kegg_number = pathway_id.replace("hsa", "")

        return {
            "id": pathway_id,
            "name": name,
            "source": "KEGG",
            "category": category or "Unclassified",
            "description": description[:300],
            "url": f"https://www.kegg.jp/pathway/{pathway_id}",
            "gene_count": gene_count,
            "sub_events": [],
        }

    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout):
        return None
    except Exception as exc:
        logger.debug("Failed to fetch KEGG pathway %s: %s", pathway_id, exc)
        return None


def _reactome_schema_to_category(schema_class: str, name: str) -> str:
    """Map Reactome schema class and pathway name to a human-readable category."""
    name_lower = name.lower()
    if "signal" in name_lower:
        return "Signal Transduction"
    if "cell cycle" in name_lower or "mitoti" in name_lower:
        return "Cell Cycle"
    if "apoptosis" in name_lower or "death" in name_lower or "autophagy" in name_lower:
        return "Apoptosis"
    if "dna repair" in name_lower or "dna damage" in name_lower:
        return "DNA Repair"
    if "immune" in name_lower or "interferon" in name_lower or "interleukin" in name_lower:
        return "Immune System"
    if "metabolism" in name_lower or "metabolic" in name_lower:
        return "Metabolism"
    if "transcription" in name_lower or "gene expression" in name_lower:
        return "Gene Expression"
    if "transport" in name_lower:
        return "Transport"
    if "disease" in name_lower or "cancer" in name_lower:
        return "Disease"
    return "Cellular Process"
