import asyncio
import logging
from datetime import datetime

import httpx

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.cache_utils import cache_get, cache_set
from app.utils.http_client import fetch_json

logger = logging.getLogger(__name__)

PULSE_CACHE_KEY = "research_pulse:{symbol}"
TRENDING_CACHE_KEY = "trending_genes"
PULSE_TTL = 604800  # 7 days
TRENDING_TTL = 604800  # 7 days

CURRENT_YEAR = datetime.now().year

# ~100 important genes with category mapping
GENE_CATALOG: dict[str, str] = {
    # Oncogenes
    "TP53": "tumor_suppressor", "BRCA1": "tumor_suppressor", "BRCA2": "tumor_suppressor",
    "EGFR": "oncogene", "BRAF": "oncogene", "KRAS": "oncogene", "PIK3CA": "oncogene",
    "PTEN": "tumor_suppressor", "APC": "tumor_suppressor", "MYC": "oncogene",
    "RB1": "tumor_suppressor", "ATM": "tumor_suppressor", "ERBB2": "oncogene",
    "ALK": "oncogene", "MET": "oncogene", "NRAS": "oncogene", "RET": "oncogene",
    "JAK2": "oncogene", "ABL1": "oncogene", "VHL": "tumor_suppressor",
    "CDH1": "tumor_suppressor", "MLH1": "tumor_suppressor", "MSH2": "tumor_suppressor",
    "PALB2": "tumor_suppressor", "CHEK2": "tumor_suppressor", "RAD51C": "tumor_suppressor",
    "MUTYH": "tumor_suppressor", "STK11": "tumor_suppressor", "NF1": "tumor_suppressor",
    "NF2": "tumor_suppressor", "WT1": "tumor_suppressor", "IDH1": "oncogene",
    "IDH2": "oncogene", "FGFR2": "oncogene", "FLT3": "oncogene", "KIT": "oncogene",
    "PDGFRA": "oncogene", "NPM1": "oncogene", "DNMT3A": "oncogene",
    # Cardiac
    "MYBPC3": "cardiac", "MYH7": "cardiac", "KCNQ1": "cardiac", "LMNA": "cardiac",
    "SCN5A": "cardiac", "TNNT2": "cardiac", "TTN": "cardiac", "RYR2": "cardiac",
    "LDLR": "cardiac", "PCSK9": "cardiac", "APOB": "cardiac",
    # Neurological
    "HTT": "neurological", "APP": "neurological", "APOE": "neurological",
    "SCN1A": "neurological", "FMR1": "neurological", "DMD": "neurological",
    "PSEN1": "neurological", "PSEN2": "neurological", "MAPT": "neurological",
    "GRN": "neurological", "C9orf72": "neurological", "SNCA": "neurological",
    "PARK2": "neurological", "LRRK2": "neurological", "SOD1": "neurological",
    "TARDBP": "neurological", "FUS": "neurological",
    # Metabolic
    "CFTR": "metabolic", "HBB": "metabolic", "HBA1": "metabolic",
    "GBA": "metabolic", "GAA": "metabolic", "HEXA": "metabolic",
    "PKD1": "metabolic", "PKD2": "metabolic", "FGFR3": "metabolic",
    "SMN1": "metabolic", "TSC1": "metabolic", "TSC2": "metabolic",
    "G6PD": "metabolic", "PAH": "metabolic",
    # Immune
    "HLA-A": "immune", "HLA-B": "immune", "CTLA4": "immune",
    "PD1": "immune", "CD274": "immune", "IL6": "immune",
    "TNF": "immune", "FOXP3": "immune", "JAK1": "immune",
    "STAT3": "immune", "BTK": "immune", "AIRE": "immune",
    "IFNG": "immune", "IL2": "immune",
}

GENE_CATEGORIES: dict[str, str] = {
    "oncogene": "Oncogenes",
    "tumor_suppressor": "Tumor Suppressors",
    "cardiac": "Cardiac",
    "neurological": "Neurological",
    "metabolic": "Metabolic",
    "immune": "Immune",
}


async def _fetch_pubmed_count_for_year(
    symbol: str, year: int, base_params: dict
) -> int:
    """Query PubMed for publication count for a gene in a specific year."""
    search_url = f"{settings.pubmed_base_url}/esearch.fcgi"
    params = {
        **base_params,
        "db": "pubmed",
        "term": f"{symbol}[gene] AND human[organism]",
        "mindate": f"{year}/01/01",
        "maxdate": f"{year}/12/31",
        "rettype": "count",
        "retmode": "json",
    }
    try:
        data = await fetch_json(search_url, params=params)
        return int(data.get("esearchresult", {}).get("count", 0))
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout, Exception) as exc:
        logger.warning("PubMed count error for %s/%d: %s", symbol, year, exc)
        return 0


async def fetch_research_pulse(symbol: str) -> dict | None:
    """Get publication frequency data for a gene over the last 20 years."""
    symbol = symbol.upper()
    cache_key = PULSE_CACHE_KEY.format(symbol=symbol)
    redis_client = await get_redis()

    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("Research pulse cache hit for %s", symbol)
        return cached

    logger.info("Computing research pulse for %s", symbol)

    base_params: dict = {}
    if settings.ncbi_api_key:
        base_params["api_key"] = settings.ncbi_api_key

    start_year = CURRENT_YEAR - 19  # 20 years of data
    years = list(range(start_year, CURRENT_YEAR + 1))

    # Batch queries in groups to respect rate limits
    # NCBI allows 3 req/sec without key, 10/sec with key
    batch_size = 8 if settings.ncbi_api_key else 3
    delay = 0.15 if settings.ncbi_api_key else 0.4

    yearly_data: list[dict] = []
    for i in range(0, len(years), batch_size):
        batch = years[i : i + batch_size]
        tasks = [_fetch_pubmed_count_for_year(symbol, y, base_params) for y in batch]
        counts = await asyncio.gather(*tasks)
        for year, count in zip(batch, counts):
            yearly_data.append({"year": year, "count": count})
        if i + batch_size < len(years):
            await asyncio.sleep(delay)

    # Compute metrics
    total_all_time = sum(d["count"] for d in yearly_data)

    # Last 12 months: approximate using current year + partial prior year
    last_year_count = next((d["count"] for d in yearly_data if d["year"] == CURRENT_YEAR), 0)
    prior_year_count = next((d["count"] for d in yearly_data if d["year"] == CURRENT_YEAR - 1), 0)

    # More accurate: use current year as proxy for "last 12 months"
    # and prior year as "prior 12 months"
    last_12 = last_year_count + (prior_year_count // 3)  # ~partial current + partial prior
    prior_12 = prior_year_count

    if prior_12 > 0:
        trend_ratio = round(last_12 / prior_12, 3)
    elif last_12 > 0:
        trend_ratio = 2.0  # New research
    else:
        trend_ratio = 1.0

    if trend_ratio > 1.2:
        trend_direction = "rising"
    elif trend_ratio < 0.8:
        trend_direction = "declining"
    else:
        trend_direction = "stable"

    peak_entry = max(yearly_data, key=lambda d: d["count"]) if yearly_data else {"year": 0, "count": 0}

    result = {
        "gene_symbol": symbol,
        "yearly_publications": yearly_data,
        "last_12_months": last_12,
        "prior_12_months": prior_12,
        "trend_ratio": trend_ratio,
        "trend_direction": trend_direction,
        "peak_year": peak_entry["year"],
        "total_all_time": total_all_time,
    }

    await cache_set(redis_client, cache_key, result, ttl=PULSE_TTL)
    logger.info("Research pulse cached for %s (total=%d, trend=%s)", symbol, total_all_time, trend_direction)
    return result


async def fetch_trending_genes() -> dict:
    """Compute trending genes list from the gene catalog."""
    redis_client = await get_redis()

    cached = await cache_get(redis_client, TRENDING_CACHE_KEY)
    if cached is not None:
        logger.info("Trending genes cache hit")
        return cached

    logger.info("Computing trending genes list...")

    # Fetch pulse data for all catalog genes
    # Process in smaller batches to avoid overwhelming NCBI
    symbols = list(GENE_CATALOG.keys())
    pulse_data: list[dict] = []

    for i in range(0, len(symbols), 5):
        batch = symbols[i : i + 5]
        tasks = [fetch_research_pulse(sym) for sym in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for sym, result in zip(batch, results):
            if isinstance(result, dict) and result:
                result["category"] = GENE_CATALOG.get(sym, "other")
                pulse_data.append(result)
            elif isinstance(result, Exception):
                logger.warning("Failed to get pulse for %s: %s", sym, result)
        # Small delay between batches
        if i + 5 < len(symbols):
            await asyncio.sleep(0.3)

    # Sort for trending (by trend_ratio descending)
    trending = sorted(
        [
            {
                "gene_symbol": d["gene_symbol"],
                "trend_ratio": d["trend_ratio"],
                "last_12_months": d["last_12_months"],
                "prior_12_months": d["prior_12_months"],
                "trend_direction": d["trend_direction"],
                "total_all_time": d["total_all_time"],
                "peak_year": d["peak_year"],
                "category": d.get("category", "other"),
                "yearly_publications": d.get("yearly_publications", [])[-10:],  # last 10 years for sparkline
            }
            for d in pulse_data
            if d["last_12_months"] > 0  # Only genes with recent activity
        ],
        key=lambda x: x["trend_ratio"],
        reverse=True,
    )

    # Sort for most researched (by total_all_time descending)
    most_researched = sorted(
        [
            {
                "gene_symbol": d["gene_symbol"],
                "total_all_time": d["total_all_time"],
                "last_12_months": d["last_12_months"],
                "trend_direction": d["trend_direction"],
                "category": d.get("category", "other"),
            }
            for d in pulse_data
        ],
        key=lambda x: x["total_all_time"],
        reverse=True,
    )

    result = {
        "trending": trending,
        "most_researched": most_researched,
        "categories": GENE_CATEGORIES,
        "generated_at": datetime.utcnow().isoformat(),
    }

    await cache_set(redis_client, TRENDING_CACHE_KEY, result, ttl=TRENDING_TTL)
    logger.info("Trending genes cached (%d genes processed)", len(pulse_data))
    return result
