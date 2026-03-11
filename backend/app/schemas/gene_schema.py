from datetime import datetime

from pydantic import BaseModel


# --- Ensembl ---

class TranscriptData(BaseModel):
    id: str
    display_name: str
    biotype: str
    length: int


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
    transcripts: list[TranscriptData] = []


# --- UniProt ---

class ProteinDomain(BaseModel):
    name: str
    start: int
    end: int
    description: str = ""


class UniProtData(BaseModel):
    uniprot_id: str
    protein_name: str
    protein_length: int
    function_description: str = ""
    domains: list[ProteinDomain] = []
    gene_names: list[str] = []


# --- ClinVar ---

class ClinVarVariant(BaseModel):
    variant_id: str
    title: str
    clinical_significance: str = ""
    condition: str = ""
    review_status: str = ""
    variant_type: str = ""


class DiseaseAssociation(BaseModel):
    disease_name: str
    variant_count: int
    associated_variants: list[str] = []


class ClinVarData(BaseModel):
    variants: list[ClinVarVariant] = []
    diseases: list[DiseaseAssociation] = []


# --- gnomAD ---

class PopulationFrequency(BaseModel):
    population: str
    af: float


class GnomADVariant(BaseModel):
    variant_id: str
    position: int
    consequence: str = ""
    hgvsc: str = ""
    hgvsp: str = ""
    allele_frequency: float = 0.0
    allele_count: int = 0
    allele_number: int = 0
    population_frequencies: list[PopulationFrequency] = []


class GnomADData(BaseModel):
    variants: list[GnomADVariant] = []
    total_variants: int = 0


# --- PubMed ---

class PubMedArticle(BaseModel):
    pmid: str
    title: str
    authors: str
    journal: str
    year: str
    pubmed_link: str
    abstract_snippet: str = ""


class PubMedData(BaseModel):
    articles: list[PubMedArticle] = []
    total_results: int = 0


# --- Pathways ---

class PathwayEntry(BaseModel):
    id: str
    name: str
    source: str = ""
    category: str = ""
    description: str = ""
    url: str = ""
    gene_count: int = 0
    sub_events: list[str] = []


class PathwayData(BaseModel):
    pathways: list[PathwayEntry] = []
    total_pathways: int = 0


# --- Aggregated Dashboard Response ---

class DataSourceStatus(BaseModel):
    ensembl: bool = False
    uniprot: bool = False
    clinvar: bool = False
    gnomad: bool = False
    pubmed: bool = False
    pathways: bool = False


class ResponseMetadata(BaseModel):
    fetched_at: str
    cached: bool
    data_sources: DataSourceStatus


class GeneDashboardResponse(BaseModel):
    model_config = {"from_attributes": True}

    gene_symbol: str
    gene: EnsemblGeneData | None = None
    protein: UniProtData | None = None
    variants: ClinVarData | None = None
    allele_frequencies: GnomADData | None = None
    publications: PubMedData | None = None
    pathways: PathwayData | None = None
    metadata: ResponseMetadata


# --- Health ---

class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    version: str
