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
    date_created: str = ""
    date_last_evaluated: str = ""
    submitter_name: str = ""
    submission_count: int = 0


class DiseaseAssociation(BaseModel):
    disease_name: str
    variant_count: int
    associated_variants: list[str] = []


class NotableVariant(BaseModel):
    variant_id: str
    title: str = ""
    significance: str = ""
    submitter: str = ""


class TimelineBucket(BaseModel):
    date: str  # YYYY-MM
    total_new_variants: int = 0
    by_significance: dict[str, int] = {}
    cumulative_variants: int = 0
    notable_variants: list[NotableVariant] = []


class TimelineData(BaseModel):
    buckets: list[TimelineBucket] = []
    first_submission_date: str = ""
    peak_month: str = ""
    peak_month_count: int = 0
    submission_rate_trend: str = "stable"  # accelerating / stable / decelerating
    recent_12mo_count: int = 0
    total_submissions: int = 0
    unique_submitters: int = 0
    most_active_submitter: str = ""
    date_range_start: str = ""
    date_range_end: str = ""


class ClinVarData(BaseModel):
    variants: list[ClinVarVariant] = []
    diseases: list[DiseaseAssociation] = []
    timeline: TimelineData | None = None


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


# --- Structure ---

class VariantResidue(BaseModel):
    residue_number: int
    amino_acid_change: str = ""
    clinical_significance: str = ""
    allele_frequency: float | None = None
    variant_id: str = ""


class StructureData(BaseModel):
    structure_available: bool = False
    source: str = ""
    structure_url: str = ""
    uniprot_id: str = ""
    mean_confidence: float = 0.0
    model_version: str = ""
    alphafold_url: str = ""
    variant_residues: list[VariantResidue] = []


# --- Interactions ---

class InteractionEdge(BaseModel):
    gene_a: str
    gene_b: str
    combined_score: float = 0.0
    experimental_score: float = 0.0
    database_score: float = 0.0
    textmining_score: float = 0.0
    coexpression_score: float = 0.0


class InteractionNode(BaseModel):
    gene_symbol: str
    is_center: bool = False
    interaction_count: int = 0


class EnrichmentTerm(BaseModel):
    term: str
    description: str = ""
    p_value: float = 1.0
    category: str = ""  # BP, MF, CC


class InteractionData(BaseModel):
    center_gene: str
    interactions: list[InteractionEdge] = []
    nodes: list[InteractionNode] = []
    enrichment: list[EnrichmentTerm] = []


# --- Aggregated Dashboard Response ---

class DataSourceStatus(BaseModel):
    ensembl: bool = False
    uniprot: bool = False
    clinvar: bool = False
    gnomad: bool = False
    pubmed: bool = False
    pathways: bool = False
    structure: bool = False
    interactions: bool = False


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
    structure: StructureData | None = None
    interactions: InteractionData | None = None
    metadata: ResponseMetadata


# --- AI Summary ---

class GeneSummaryResponse(BaseModel):
    summary: str
    generated_at: str
    source: str = "template"


# --- Health ---

class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    version: str
