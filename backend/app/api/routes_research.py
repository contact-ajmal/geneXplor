import re

from fastapi import APIRouter

from app.schemas.gene_schema import ResearchPulseResponse, TrendingGenesResponse
from app.services.research_pulse_service import fetch_research_pulse, fetch_trending_genes
from app.utils.exceptions import InvalidGeneSymbolError

router = APIRouter(prefix="/research", tags=["research"])

GENE_SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9\-]{0,19}$")


@router.get("/pulse/{symbol}", response_model=ResearchPulseResponse)
async def get_research_pulse(symbol: str) -> ResearchPulseResponse:
    symbol_upper = symbol.upper().strip()
    if not GENE_SYMBOL_PATTERN.match(symbol_upper):
        raise InvalidGeneSymbolError(symbol)

    result = await fetch_research_pulse(symbol_upper)
    if result is None:
        raise InvalidGeneSymbolError(f"Could not fetch research data for {symbol}")

    return ResearchPulseResponse(**result)


@router.get("/trending", response_model=TrendingGenesResponse)
async def get_trending_genes() -> TrendingGenesResponse:
    result = await fetch_trending_genes()
    return TrendingGenesResponse(**result)
