import logging

logger = logging.getLogger(__name__)


async def fetch_pubmed_articles(symbol: str) -> dict:
    logger.info("PubMed service called for %s — full implementation in Phase 2", symbol)
    return {}
