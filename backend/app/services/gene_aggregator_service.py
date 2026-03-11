import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.gene import GeneCache
from app.schemas.gene_schema import EnsemblGeneData, GeneResponse
from app.services.ensembl_service import fetch_ensembl_gene
from app.utils.cache_utils import cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "gene:"


async def get_gene_data(symbol: str, session: AsyncSession) -> GeneResponse:
    cache_key = f"{CACHE_KEY_PREFIX}{symbol.upper()}"

    # 1. Check Redis cache
    redis_client = await get_redis()
    cached = await cache_get(redis_client, cache_key)
    if cached is not None:
        logger.info("Cache hit for %s", symbol)
        return GeneResponse(
            gene_symbol=symbol.upper(),
            ensembl=EnsemblGeneData(**cached["ensembl"]),
            source="cache",
            cached_at=cached.get("cached_at"),
        )

    # 2. Check PostgreSQL cache
    stmt = select(GeneCache).where(GeneCache.gene_symbol == symbol.upper())
    result = await session.execute(stmt)
    db_row = result.scalar_one_or_none()

    if db_row is not None:
        logger.info("Database hit for %s", symbol)
        data = db_row.json_data
        # Re-populate Redis cache from DB
        await cache_set(redis_client, cache_key, data)
        return GeneResponse(
            gene_symbol=symbol.upper(),
            ensembl=EnsemblGeneData(**data["ensembl"]),
            source="cache",
            cached_at=db_row.updated_at.isoformat() if db_row.updated_at else None,
        )

    # 3. Fetch from Ensembl API
    logger.info("Fetching fresh data for %s from Ensembl", symbol)
    ensembl_data = await fetch_ensembl_gene(symbol)

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "ensembl": ensembl_data,
        "cached_at": now,
    }

    # 4. Store in Redis
    await cache_set(redis_client, cache_key, payload)

    # 5. Store in PostgreSQL
    gene_cache = GeneCache(
        gene_symbol=symbol.upper(),
        json_data=payload,
    )
    session.add(gene_cache)
    await session.commit()

    return GeneResponse(
        gene_symbol=symbol.upper(),
        ensembl=EnsemblGeneData(**ensembl_data),
        source="api",
        cached_at=now,
    )
