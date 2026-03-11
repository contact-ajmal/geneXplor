import logging

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.exceptions import ExternalAPIError, GeneNotFoundError
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)

CACHE_KEY = "ensembl:{symbol}"


async def fetch_ensembl_gene(symbol: str) -> dict:
    cache_key = CACHE_KEY.format(symbol=symbol.upper())
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("Ensembl cache hit for %s", symbol)
        return cached

    url = f"{settings.ensembl_base_url}/lookup/symbol/homo_sapiens/{symbol}"
    params = {"expand": "1", "content-type": "application/json"}
    logger.info("Fetching Ensembl data for %s", symbol)

    try:
        data = await fetch_json(url, params=params)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 404):
            raise GeneNotFoundError(symbol)
        logger.error("Ensembl API error for %s: %s", symbol, exc)
        raise ExternalAPIError("Ensembl", str(exc))
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as exc:
        logger.error("Ensembl connection error for %s: %s", symbol, exc)
        raise ExternalAPIError("Ensembl", "Service unreachable. Please try again later.")

    raw_transcripts = data.get("Transcript", [])
    description_raw = data.get("description", "")
    description = description_raw.split(" [")[0] if description_raw else ""

    transcripts = []
    for t in raw_transcripts:
        length = 0
        start = t.get("start", 0)
        end = t.get("end", 0)
        if start and end:
            length = abs(end - start)
        transcripts.append({
            "id": t.get("id", ""),
            "display_name": t.get("display_name", ""),
            "biotype": t.get("biotype", ""),
            "length": length,
        })

    result = {
        "gene_symbol": data.get("display_name", symbol),
        "gene_name": data.get("display_name", symbol),
        "description": description,
        "ensembl_id": data.get("id", ""),
        "chromosome": data.get("seq_region_name", ""),
        "start": data.get("start", 0),
        "end": data.get("end", 0),
        "strand": data.get("strand", 0),
        "biotype": data.get("biotype", ""),
        "transcript_count": len(raw_transcripts),
        "transcripts": transcripts,
    }

    await cache_set(redis_client, cache_key, result)
    logger.info("Ensembl data cached for %s", symbol)
    return result
