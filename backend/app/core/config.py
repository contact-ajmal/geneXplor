from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "extra": "ignore"}

    # Database
    database_url: str = "postgresql+asyncpg://genexplor:genexplor_secret@postgres:5432/genexplor"

    # Redis
    redis_url: str = "redis://redis:6379/0"
    redis_cache_ttl: int = 86400

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # External APIs
    ensembl_base_url: str = "https://rest.ensembl.org"
    clinvar_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    uniprot_base_url: str = "https://rest.uniprot.org"
    gnomad_api_url: str = "https://gnomad.broadinstitute.org/api"
    pubmed_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    ncbi_api_key: str = ""


settings = Settings()
