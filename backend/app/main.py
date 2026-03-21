import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_gene import router as gene_router
from app.api.routes_research import router as research_router
from app.api.routes_search import router as search_router
from app.core.database import create_tables
from app.core.redis import close_redis, get_redis
from app.utils.http_client import close_http_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


async def _load_search_indexes() -> None:
    """Load all search indexes in background (non-blocking)."""
    try:
        redis_client = await get_redis()

        from app.services.gene_index_service import load_gene_index
        from app.services.alias_index_service import load_alias_index
        from app.services.disease_index_service import load_disease_index

        # Load gene index first (others may depend on it)
        await load_gene_index(redis_client)

        # Load alias + disease in parallel
        await asyncio.gather(
            load_alias_index(redis_client),
            load_disease_index(redis_client),
            return_exceptions=True,
        )

        logger.info("All search indexes loaded successfully.")
    except Exception as e:
        logger.error("Search index loading failed (search will use fallbacks): %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting GeneXplor backend...")
    await create_tables()
    logger.info("Database tables created.")
    await get_redis()
    logger.info("Redis connection established.")

    # Load search indexes in background (don't block startup)
    asyncio.create_task(_load_search_indexes())

    yield
    logger.info("Shutting down GeneXplor backend...")
    await close_http_client()
    await close_redis()


app = FastAPI(
    title="GeneXplor API",
    description="Gene knowledge platform aggregating data from Ensembl, ClinVar, gnomAD, UniProt, and PubMed.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gene_router)
app.include_router(research_router)
app.include_router(search_router)
