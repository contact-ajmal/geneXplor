import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_gene import router as gene_router
from app.core.database import create_tables
from app.core.redis import close_redis, get_redis
from app.utils.http_client import close_http_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting GeneXplor backend...")
    await create_tables()
    logger.info("Database tables created.")
    await get_redis()
    logger.info("Redis connection established.")
    yield
    logger.info("Shutting down GeneXplor backend...")
    await close_http_client()
    await close_redis()


app = FastAPI(
    title="GeneXplor API",
    description="Gene knowledge platform aggregating data from Ensembl, ClinVar, gnomAD, UniProt, and PubMed.",
    version="0.1.0",
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
