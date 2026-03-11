import logging

logger = logging.getLogger(__name__)


async def fetch_uniprot_protein(symbol: str) -> dict:
    logger.info("UniProt service called for %s — full implementation in Phase 2", symbol)
    return {}
