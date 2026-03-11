import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.gene import GeneCache
from app.schemas.gene_schema import (
    ClinVarData,
    DataSourceStatus,
    EnsemblGeneData,
    GeneDashboardResponse,
    GnomADData,
    PathwayData,
    PubMedData,
    ResponseMetadata,
    UniProtData,
)
from app.services.clinvar_service import fetch_clinvar_variants
from app.services.ensembl_service import fetch_ensembl_gene
from app.services.gnomad_service import fetch_gnomad_variants
from app.services.pathway_service import fetch_pathways
from app.services.pubmed_service import fetch_pubmed_articles
from app.services.uniprot_service import fetch_uniprot_protein
from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

DASHBOARD_CACHE_KEY = "dashboard:{symbol}"


async def get_gene_dashboard(symbol: str, session: AsyncSession) -> GeneDashboardResponse:
    symbol = symbol.upper()
    cache_key = DASHBOARD_CACHE_KEY.format(symbol=symbol)

    # 1. Check Redis cache for full dashboard
    redis_client = await get_redis()
    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("Dashboard cache hit for %s", symbol)
        return _build_response_from_payload(symbol, cached, is_cached=True)

    # 2. Check PostgreSQL cache
    stmt = select(GeneCache).where(GeneCache.gene_symbol == symbol)
    result = await session.execute(stmt)
    db_row = result.scalar_one_or_none()

    if db_row is not None:
        logger.info("Dashboard DB cache hit for %s", symbol)
        payload = db_row.json_data
        await cache_set(redis_client, cache_key, payload)
        return _build_response_from_payload(symbol, payload, is_cached=True)

    # 3. Fetch from all APIs concurrently
    logger.info("Fetching fresh dashboard data for %s", symbol)

    results = await asyncio.gather(
        fetch_ensembl_gene(symbol),
        fetch_uniprot_protein(symbol),
        fetch_clinvar_variants(symbol),
        fetch_gnomad_variants(symbol),
        fetch_pubmed_articles(symbol),
        fetch_pathways(symbol),
        return_exceptions=True,
    )

    ensembl_result, uniprot_result, clinvar_result, gnomad_result, pubmed_result, pathway_result = results

    # Handle individual failures — log exceptions, set to None
    if isinstance(ensembl_result, Exception):
        logger.error("Ensembl failed for %s: %s", symbol, ensembl_result)
        raise ensembl_result  # Ensembl is required — re-raise
    if isinstance(uniprot_result, Exception):
        logger.error("UniProt failed for %s: %s", symbol, uniprot_result)
        uniprot_result = None
    if isinstance(clinvar_result, Exception):
        logger.error("ClinVar failed for %s: %s", symbol, clinvar_result)
        clinvar_result = None
    if isinstance(gnomad_result, Exception):
        logger.error("gnomAD failed for %s: %s", symbol, gnomad_result)
        gnomad_result = None
    if isinstance(pubmed_result, Exception):
        logger.error("PubMed failed for %s: %s", symbol, pubmed_result)
        pubmed_result = None
    if isinstance(pathway_result, Exception):
        logger.error("Pathways failed for %s: %s", symbol, pathway_result)
        pathway_result = None

    now = datetime.now(timezone.utc).isoformat()

    payload = {
        "ensembl": ensembl_result,
        "uniprot": uniprot_result,
        "clinvar": clinvar_result,
        "gnomad": gnomad_result,
        "pubmed": pubmed_result,
        "pathways": pathway_result,
        "fetched_at": now,
    }

    # 4. Cache in Redis
    await cache_set(redis_client, cache_key, payload)

    # 5. Store / update in PostgreSQL
    existing = await session.execute(
        select(GeneCache).where(GeneCache.gene_symbol == symbol)
    )
    existing_row = existing.scalar_one_or_none()
    if existing_row:
        existing_row.json_data = payload
    else:
        session.add(GeneCache(gene_symbol=symbol, json_data=payload))
    await session.commit()

    return _build_response_from_payload(symbol, payload, is_cached=False)


def _build_response_from_payload(
    symbol: str, payload: dict, is_cached: bool
) -> GeneDashboardResponse:
    ensembl_data = payload.get("ensembl")
    uniprot_data = payload.get("uniprot")
    clinvar_data = payload.get("clinvar")
    gnomad_data = payload.get("gnomad")
    pubmed_data = payload.get("pubmed")
    pathway_data = payload.get("pathways")
    fetched_at = payload.get("fetched_at", datetime.now(timezone.utc).isoformat())

    return GeneDashboardResponse(
        gene_symbol=symbol,
        gene=EnsemblGeneData(**ensembl_data) if ensembl_data else None,
        protein=UniProtData(**uniprot_data) if uniprot_data else None,
        variants=ClinVarData(**clinvar_data) if clinvar_data else None,
        allele_frequencies=GnomADData(**gnomad_data) if gnomad_data else None,
        publications=PubMedData(**pubmed_data) if pubmed_data else None,
        pathways=PathwayData(**pathway_data) if pathway_data else None,
        metadata=ResponseMetadata(
            fetched_at=fetched_at,
            cached=is_cached,
            data_sources=DataSourceStatus(
                ensembl=ensembl_data is not None,
                uniprot=uniprot_data is not None,
                clinvar=clinvar_data is not None,
                gnomad=gnomad_data is not None,
                pubmed=pubmed_data is not None,
                pathways=pathway_data is not None,
            ),
        ),
    )
