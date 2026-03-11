import logging

import httpx

from app.core.config import settings
from app.utils.exceptions import ExternalAPIError, GeneNotFoundError
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)


async def fetch_ensembl_gene(symbol: str) -> dict:
    url = f"{settings.ensembl_base_url}/lookup/symbol/homo_sapiens/{symbol}"
    params = {"expand": "1", "content-type": "application/json"}

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

    transcripts = data.get("Transcript", [])
    description_raw = data.get("description", "")
    description = description_raw.split(" [")[0] if description_raw else ""

    return {
        "gene_symbol": data.get("display_name", symbol),
        "gene_name": data.get("display_name", symbol),
        "description": description,
        "ensembl_id": data.get("id", ""),
        "chromosome": data.get("seq_region_name", ""),
        "start": data.get("start", 0),
        "end": data.get("end", 0),
        "strand": data.get("strand", 0),
        "biotype": data.get("biotype", ""),
        "transcript_count": len(transcripts),
    }
