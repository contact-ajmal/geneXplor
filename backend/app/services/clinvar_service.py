import logging

logger = logging.getLogger(__name__)


async def fetch_clinvar_variants(symbol: str) -> dict:
    logger.info("ClinVar service called for %s — full implementation in Phase 2", symbol)
    return {}
