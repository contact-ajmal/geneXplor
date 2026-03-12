import asyncio
import logging
from collections import defaultdict

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
        result: dict = {"variants": [], "diseases": [], "timeline": None}
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
    # For timeline: collect (date_created, significance, variant_id, title, submitter)
    timeline_entries: list[dict] = []
    submitter_counts: dict[str, int] = defaultdict(int)

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

        # Timeline fields — dates and submitter info
        date_created = ""
        date_last_evaluated = ""
        submitter_name = ""
        submission_count = 0

        # supporting_submissions contains submission details
        supporting = entry.get("supporting_submissions", {})
        if isinstance(supporting, dict):
            scv_list = supporting.get("scv", [])
            if isinstance(scv_list, list):
                submission_count = len(scv_list)

        # germline_classification has last_evaluated (format: "YYYY/MM/DD HH:MM")
        if isinstance(germline, dict):
            date_last_evaluated = str(germline.get("last_evaluated", ""))

        # Use last_evaluated as the best available date for timeline
        # (esummary doesn't expose date_created directly)
        date_created = date_last_evaluated

        # Get submitter info from genes or supporting submissions
        # The accession_version gives us the VCV accession
        genes_info = entry.get("genes", [])
        if isinstance(genes_info, list) and genes_info:
            first_gene = genes_info[0] if isinstance(genes_info[0], dict) else {}
            gene_source = first_gene.get("source", "")

        # Try to extract submitter from clinical_impact or other classification
        clinical_impact = entry.get("clinical_impact_classification", {})
        if isinstance(clinical_impact, dict):
            ci_last = clinical_impact.get("last_evaluated", "")
            if ci_last and not date_created:
                date_created = ci_last

        if submitter_name:
            submitter_counts[submitter_name] += 1

        variants.append({
            "variant_id": uid,
            "title": title,
            "clinical_significance": clinical_significance,
            "condition": condition_str,
            "review_status": review_status,
            "variant_type": variant_type,
            "date_created": date_created,
            "date_last_evaluated": date_last_evaluated,
            "submitter_name": submitter_name,
            "submission_count": submission_count,
        })

        # Collect for timeline
        if date_created:
            timeline_entries.append({
                "date": date_created,
                "significance": clinical_significance,
                "variant_id": uid,
                "title": title,
                "submitter": submitter_name,
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

    # Build timeline data
    timeline = _build_timeline(timeline_entries, submitter_counts)

    result = {"variants": variants, "diseases": diseases, "timeline": timeline}
    await cache_set(redis_client, cache_key, result)
    logger.info(
        "ClinVar data cached for %s (%d variants, %d diseases, %d timeline buckets)",
        symbol,
        len(variants),
        len(diseases),
        len(timeline.get("buckets", [])) if timeline else 0,
    )
    return result


def _normalize_significance(sig: str) -> str:
    """Normalize clinical significance to a canonical bucket."""
    s = sig.lower().strip()
    if "pathogenic" in s and "likely" not in s:
        return "pathogenic"
    if "likely pathogenic" in s:
        return "likely_pathogenic"
    if "benign" in s and "likely" not in s:
        return "benign"
    if "likely benign" in s:
        return "likely_benign"
    if "uncertain" in s or "vus" in s:
        return "vus"
    return "other"


def _parse_month(date_str: str) -> str | None:
    """Extract YYYY-MM from a date string like '2021/04/01' or '2021-04-01'."""
    if not date_str:
        return None
    cleaned = date_str.replace("/", "-").strip()
    parts = cleaned.split("-")
    if len(parts) >= 2:
        try:
            year = int(parts[0])
            month = int(parts[1])
            if 1990 <= year <= 2100 and 1 <= month <= 12:
                return f"{year:04d}-{month:02d}"
        except ValueError:
            pass
    return None


def _build_timeline(
    entries: list[dict], submitter_counts: dict[str, int]
) -> dict | None:
    """Build timeline data from variant submission entries."""
    if not entries:
        return None

    # Group by month
    monthly: dict[str, list[dict]] = defaultdict(list)
    for e in entries:
        month = _parse_month(e["date"])
        if month:
            monthly[month].append(e)

    if not monthly:
        return None

    sorted_months = sorted(monthly.keys())

    # Build buckets
    buckets: list[dict] = []
    cumulative = 0

    for month in sorted_months:
        month_entries = monthly[month]
        cumulative += len(month_entries)

        # Count by significance
        by_sig: dict[str, int] = defaultdict(int)
        for e in month_entries:
            by_sig[_normalize_significance(e["significance"])] += 1

        # Notable variants (top 2 by significance priority)
        notable = sorted(
            month_entries,
            key=lambda x: (
                0 if "pathogenic" in x["significance"].lower() else
                1 if "uncertain" in x["significance"].lower() else 2
            ),
        )[:2]

        buckets.append({
            "date": month,
            "total_new_variants": len(month_entries),
            "by_significance": dict(by_sig),
            "cumulative_variants": cumulative,
            "notable_variants": [
                {
                    "variant_id": n["variant_id"],
                    "title": n["title"],
                    "significance": n["significance"],
                    "submitter": n["submitter"],
                }
                for n in notable
            ],
        })

    # Compute trend: compare last 12 months vs previous 12 months
    now_months = set()
    prev_months = set()
    if len(sorted_months) >= 2:
        last_month = sorted_months[-1]
        # Simple: last 12 entries vs preceding 12
        recent_12 = sorted_months[-12:]
        prev_12 = sorted_months[-24:-12] if len(sorted_months) > 12 else []
        recent_count = sum(len(monthly[m]) for m in recent_12)
        prev_count = sum(len(monthly[m]) for m in prev_12) if prev_12 else 0

        if prev_count == 0:
            trend = "stable"
        elif recent_count > prev_count * 1.2:
            trend = "accelerating"
        elif recent_count < prev_count * 0.8:
            trend = "decelerating"
        else:
            trend = "stable"
    else:
        trend = "stable"
        recent_count = sum(len(v) for v in monthly.values())

    # Peak month
    peak_month = max(sorted_months, key=lambda m: len(monthly[m]))

    # Most active submitter
    most_active_submitter = ""
    if submitter_counts:
        most_active_submitter = max(submitter_counts, key=submitter_counts.get)  # type: ignore[arg-type]

    # Unique submitters
    unique_submitters: set[str] = set()
    for e in entries:
        if e.get("submitter"):
            unique_submitters.add(e["submitter"])

    return {
        "buckets": buckets,
        "first_submission_date": sorted_months[0],
        "peak_month": peak_month,
        "peak_month_count": len(monthly[peak_month]),
        "submission_rate_trend": trend,
        "recent_12mo_count": recent_count if len(sorted_months) >= 2 else sum(len(v) for v in monthly.values()),
        "total_submissions": sum(len(v) for v in monthly.values()),
        "unique_submitters": len(unique_submitters),
        "most_active_submitter": most_active_submitter,
        "date_range_start": sorted_months[0],
        "date_range_end": sorted_months[-1],
    }
