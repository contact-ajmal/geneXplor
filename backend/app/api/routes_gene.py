import asyncio
import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.redis import get_redis
from app.schemas.gene_schema import GeneDashboardResponse, GeneSummaryResponse, HealthResponse
from app.services.ai_summary_service import generate_gene_summary
from app.services.gene_aggregator_service import get_gene_dashboard
from app.utils.exceptions import InvalidGeneSymbolError

router = APIRouter()

GENE_SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9\-]{0,19}$")


@router.get("/health", response_model=HealthResponse)
async def health_check(session: AsyncSession = Depends(get_session)) -> HealthResponse:
    db_status = "ok"
    redis_status = "ok"

    try:
        await session.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_status = "error"

    try:
        redis_client = await get_redis()
        await redis_client.ping()
    except Exception:
        redis_status = "error"

    overall = "healthy" if db_status == "ok" and redis_status == "ok" else "degraded"

    return HealthResponse(
        status=overall,
        database=db_status,
        redis=redis_status,
        version="0.1.0",
    )


@router.get("/gene/compare", response_model=list[GeneDashboardResponse])
async def compare_genes(
    genes: str = Query(..., description="Comma-separated gene symbols (e.g. TP53,BRCA1)"),
    session: AsyncSession = Depends(get_session),
) -> list[GeneDashboardResponse]:
    symbols = [s.strip().upper() for s in genes.split(",") if s.strip()]

    if len(symbols) != 2:
        raise InvalidGeneSymbolError("Provide exactly two comma-separated gene symbols")

    for sym in symbols:
        if not GENE_SYMBOL_PATTERN.match(sym):
            raise InvalidGeneSymbolError(sym)

    results = await asyncio.gather(
        get_gene_dashboard(symbols[0], session),
        get_gene_dashboard(symbols[1], session),
    )
    return list(results)


@router.get("/gene/{symbol}", response_model=GeneDashboardResponse)
async def get_gene(
    symbol: str,
    session: AsyncSession = Depends(get_session),
) -> GeneDashboardResponse:
    symbol_upper = symbol.upper().strip()

    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)

    return await get_gene_dashboard(symbol_upper, session)


@router.get("/gene/{symbol}/summary", response_model=GeneSummaryResponse)
async def get_gene_summary(
    symbol: str,
    session: AsyncSession = Depends(get_session),
) -> GeneSummaryResponse:
    symbol_upper = symbol.upper().strip()

    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)

    # Get the full dashboard data first (uses cache)
    dashboard = await get_gene_dashboard(symbol_upper, session)
    dashboard_dict = dashboard.model_dump()

    result = await generate_gene_summary(dashboard_dict)
    return GeneSummaryResponse(**result)
