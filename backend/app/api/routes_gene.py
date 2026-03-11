import re

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.redis import get_redis
from app.schemas.gene_schema import GeneDashboardResponse, HealthResponse
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


@router.get("/gene/{symbol}", response_model=GeneDashboardResponse)
async def get_gene(
    symbol: str,
    session: AsyncSession = Depends(get_session),
) -> GeneDashboardResponse:
    symbol_upper = symbol.upper().strip()

    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)

    return await get_gene_dashboard(symbol_upper, session)
