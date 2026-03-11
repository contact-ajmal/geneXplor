import logging

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)

CACHE_KEY = "uniprot:{symbol}"


async def fetch_uniprot_protein(symbol: str) -> dict | None:
    cache_key = CACHE_KEY.format(symbol=symbol.upper())
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("UniProt cache hit for %s", symbol)
        return cached

    url = f"{settings.uniprot_base_url}/uniprotkb/search"
    params = {
        "query": f"gene_exact:{symbol} AND organism_id:9606",
        "fields": "accession,protein_name,length,ft_domain,cc_function,gene_names",
        "format": "json",
        "size": "5",
    }
    logger.info("Fetching UniProt data for %s", symbol)

    try:
        data = await fetch_json(url, params=params)
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("UniProt API error for %s: %s", symbol, exc)
        return None

    results = data.get("results", [])
    if not results:
        logger.warning("No UniProt results for %s", symbol)
        return None

    # Take the first reviewed (Swiss-Prot) entry, or first result
    entry = results[0]
    for r in results:
        if r.get("entryType") == "UniProtKB reviewed (Swiss-Prot)":
            entry = r
            break

    # Parse protein name
    protein_name = ""
    protein_desc = entry.get("proteinDescription", {})
    rec_name = protein_desc.get("recommendedName")
    if rec_name:
        full_name = rec_name.get("fullName", {})
        protein_name = full_name.get("value", "")
    if not protein_name:
        sub_names = protein_desc.get("submissionNames", [])
        if sub_names:
            protein_name = sub_names[0].get("fullName", {}).get("value", "")

    # Parse function description
    function_description = ""
    comments = entry.get("comments", [])
    for comment in comments:
        if comment.get("commentType") == "FUNCTION":
            texts = comment.get("texts", [])
            if texts:
                function_description = texts[0].get("value", "")
                break

    # Parse domains
    domains = []
    features = entry.get("features", [])
    for feat in features:
        if feat.get("type") == "Domain":
            loc = feat.get("location", {})
            start_pos = loc.get("start", {}).get("value", 0)
            end_pos = loc.get("end", {}).get("value", 0)
            desc = feat.get("description", "")
            domains.append({
                "name": desc,
                "start": start_pos,
                "end": end_pos,
                "description": desc,
            })

    # Parse gene names
    gene_names = []
    for gene_entry in entry.get("genes", []):
        name = gene_entry.get("geneName", {}).get("value")
        if name:
            gene_names.append(name)
        for syn in gene_entry.get("synonyms", []):
            val = syn.get("value")
            if val:
                gene_names.append(val)

    result = {
        "uniprot_id": entry.get("primaryAccession", ""),
        "protein_name": protein_name,
        "protein_length": entry.get("sequence", {}).get("length", 0),
        "function_description": function_description,
        "domains": domains,
        "gene_names": gene_names,
    }

    await cache_set(redis_client, cache_key, result)
    logger.info("UniProt data cached for %s", symbol)
    return result
