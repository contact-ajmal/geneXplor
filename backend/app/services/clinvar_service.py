import asyncio
import logging

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)

CACHE_KEY = "clinvar:{symbol}"


async def fetch_clinvar_variants(symbol: str) -> dict | None:
    cache_key = CACHE_KEY.format(symbol=symbol.upper())
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("ClinVar cache hit for %s", symbol)
        return cached

    logger.info("Fetching ClinVar data for %s", symbol)

    # Build NCBI params with optional API key
    base_params: dict = {}
    if settings.ncbi_api_key:
        base_params["api_key"] = settings.ncbi_api_key

    # Step 1: Search for variant IDs
    search_url = f"{settings.clinvar_base_url}/esearch.fcgi"
    search_params = {
        **base_params,
        "db": "clinvar",
        "term": f"{symbol}[gene]",
        "retmax": "50",
        "retmode": "json",
    }

    try:
        search_data = await fetch_json(search_url, params=search_params)
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("ClinVar search error for %s: %s", symbol, exc)
        return None

    id_list = search_data.get("esearchresult", {}).get("idlist", [])
    if not id_list:
        logger.info("No ClinVar variants found for %s", symbol)
        result: dict = {"variants": [], "diseases": []}
        await cache_set(redis_client, cache_key, result)
        return result

    # Respect NCBI rate limits between calls
    await asyncio.sleep(0.5 if not settings.ncbi_api_key else 0.1)

    # Step 2: Fetch variant summaries
    summary_url = f"{settings.clinvar_base_url}/esummary.fcgi"
    summary_params = {
        **base_params,
        "db": "clinvar",
        "id": ",".join(id_list),
        "retmode": "json",
    }

    try:
        summary_data = await fetch_json(summary_url, params=summary_params)
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("ClinVar summary error for %s: %s", symbol, exc)
        return None

    doc_sums = summary_data.get("result", {})
    uid_list = doc_sums.get("uids", [])

    variants = []
    disease_map: dict[str, list[str]] = {}

    for uid in uid_list:
        entry = doc_sums.get(uid, {})
        if not entry or not isinstance(entry, dict):
            continue

        title = entry.get("title", "")

        # Clinical significance — ClinVar v2 uses germline_classification
        germline = entry.get("germline_classification", {})
        if isinstance(germline, dict):
            clinical_significance = germline.get("description", "")
            review_status = germline.get("review_status", "")
        else:
            clinical_significance = ""
            review_status = ""

        # Fallback: check oncogenicity_classification
        if not clinical_significance:
            onco = entry.get("oncogenicity_classification", {})
            if isinstance(onco, dict):
                clinical_significance = onco.get("description", "")
                review_status = review_status or onco.get("review_status", "")

        # Variant type
        variant_type = entry.get("obj_type", "")

        # Conditions / diseases from germline_classification.trait_set
        conditions = []
        trait_set = germline.get("trait_set", []) if isinstance(germline, dict) else []
        if isinstance(trait_set, list):
            for trait in trait_set:
                if isinstance(trait, dict):
                    trait_name = trait.get("trait_name", "")
                    if trait_name:
                        conditions.append(trait_name)

        condition_str = "; ".join(conditions) if conditions else ""

        variants.append({
            "variant_id": uid,
            "title": title,
            "clinical_significance": clinical_significance,
            "condition": condition_str,
            "review_status": review_status,
            "variant_type": variant_type,
        })

        # Accumulate disease associations
        for disease_name in conditions:
            if disease_name not in disease_map:
                disease_map[disease_name] = []
            disease_map[disease_name].append(uid)

    # Build disease list
    diseases = [
        {
            "disease_name": name,
            "variant_count": len(variant_ids),
            "associated_variants": variant_ids,
        }
        for name, variant_ids in disease_map.items()
    ]

    result = {"variants": variants, "diseases": diseases}
    await cache_set(redis_client, cache_key, result)
    logger.info("ClinVar data cached for %s (%d variants, %d diseases)", symbol, len(variants), len(diseases))
    return result
