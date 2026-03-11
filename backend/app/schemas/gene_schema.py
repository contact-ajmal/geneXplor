from datetime import datetime

from pydantic import BaseModel


class EnsemblGeneData(BaseModel):
    gene_symbol: str
    gene_name: str
    description: str
    ensembl_id: str
    chromosome: str
    start: int
    end: int
    strand: int
    biotype: str
    transcript_count: int


class GeneResponse(BaseModel):
    model_config = {"from_attributes": True}

    gene_symbol: str
    ensembl: EnsemblGeneData
    source: str  # "cache" or "api"
    cached_at: datetime | None = None


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    version: str
