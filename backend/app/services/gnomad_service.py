import logging

logger = logging.getLogger(__name__)


async def fetch_gnomad_constraints(symbol: str) -> dict:
    logger.info("gnomAD service called for %s — full implementation in Phase 2", symbol)
    return {}
