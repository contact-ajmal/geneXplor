import logging

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import post_json

logger = logging.getLogger(__name__)

CACHE_KEY = "gnomad:{symbol}"

GNOMAD_QUERY = """
{
  gene(gene_symbol: "%s", reference_genome: GRCh38) {
    variants(dataset: gnomad_r4) {
      variant_id
      pos
      consequence
      hgvsc
      hgvsp
      exome {
        af
        ac
        an
        populations {
          id
          ac
          an
        }
      }
      genome {
        af
        ac
        an
      }
    }
  }
}
"""


async def fetch_gnomad_variants(symbol: str) -> dict | None:
    cache_key = CACHE_KEY.format(symbol=symbol.upper())
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("gnomAD cache hit for %s", symbol)
        return cached

    logger.info("Fetching gnomAD data for %s", symbol)

    query = GNOMAD_QUERY % symbol.upper()

    try:
        data = await post_json(
            settings.gnomad_api_url,
            json_body={"query": query},
        )
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("gnomAD API error for %s: %s", symbol, exc)
        return None

    # gnomAD returns {"data": {"gene": {"variants": [...]}}} or errors
    if "errors" in data:
        logger.warning("gnomAD returned errors for %s: %s", symbol, data["errors"])
        return None

    gene_data = (data.get("data") or {}).get("gene")
    if gene_data is None:
        logger.warning("No gnomAD gene data for %s", symbol)
        return None

    raw_variants = gene_data.get("variants", []) or []

    parsed = []
    for v in raw_variants:
        exome = v.get("exome") or {}
        genome = v.get("genome") or {}

        # Prefer exome AF, fall back to genome AF
        af = exome.get("af") or genome.get("af") or 0.0
        ac = exome.get("ac") or genome.get("ac") or 0
        an = exome.get("an") or genome.get("an") or 0

        # Population frequencies from exome data (compute AF from ac/an)
        pop_freqs = []
        for pop in (exome.get("populations") or []):
            pop_ac = pop.get("ac", 0) or 0
            pop_an = pop.get("an", 0) or 0
            pop_af = pop_ac / pop_an if pop_an > 0 else 0.0
            if pop_af > 0:
                pop_freqs.append({
                    "population": pop.get("id", ""),
                    "af": round(pop_af, 8),
                })

        parsed.append({
            "variant_id": v.get("variant_id", ""),
            "position": v.get("pos", 0),
            "consequence": v.get("consequence", ""),
            "hgvsc": v.get("hgvsc") or "",
            "hgvsp": v.get("hgvsp") or "",
            "allele_frequency": af,
            "allele_count": ac,
            "allele_number": an,
            "population_frequencies": pop_freqs,
        })

    # Sort by allele frequency descending, take top 100
    parsed.sort(key=lambda x: x["allele_frequency"], reverse=True)
    top_variants = parsed[:100]

    result = {
        "variants": top_variants,
        "total_variants": len(raw_variants),
    }

    await cache_set(redis_client, cache_key, result)
    logger.info("gnomAD data cached for %s (%d total variants, returning top %d)",
                symbol, len(raw_variants), len(top_variants))
    return result
