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
    ac: int = 0
    an: int = 0


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


# --- Reconciliation ---

class ReconciliationConflict(BaseModel):
    variant_id: str
    hgvs: str = ""
    conflict_type: str
    severity: str  # HIGH, MEDIUM, LOW
    clinvar_significance: str = ""
    clinvar_review_status: str = ""
    clinvar_last_evaluated: str = ""
    gnomad_af: float = 0.0
    gnomad_population_afs: dict[str, float] = {}
    explanation: str = ""
    recommendation: str = ""
    external_links: dict[str, str] = {}


class ReconciliationSummary(BaseModel):
    total_variants_reconciled: int = 0
    conflicts_found: int = 0
    by_severity: dict[str, int] = {}
    by_type: dict[str, int] = {}
    reconciliation_score: float = 100.0
    variants_in_both_databases: int = 0
    variants_clinvar_only: int = 0
    variants_gnomad_only: int = 0


class ReconciliationData(BaseModel):
    conflicts: list[ReconciliationConflict] = []
    summary: ReconciliationSummary = ReconciliationSummary()


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
    reconciliation: ReconciliationData | None = None
    metadata: ResponseMetadata


# --- AI Summary ---

class GeneSummaryResponse(BaseModel):
    summary: str
    generated_at: str
    source: str = "template"


# --- Research Pulse ---

class YearlyPublication(BaseModel):
    year: int
    count: int


class ResearchPulseResponse(BaseModel):
    gene_symbol: str
    yearly_publications: list[YearlyPublication] = []
    last_12_months: int = 0
    prior_12_months: int = 0
    trend_ratio: float = 1.0
    trend_direction: str = "stable"
    peak_year: int = 0
    total_all_time: int = 0


class TrendingGeneEntry(BaseModel):
    gene_symbol: str
    trend_ratio: float = 1.0
    last_12_months: int = 0
    prior_12_months: int = 0
    trend_direction: str = "stable"
    total_all_time: int = 0
    peak_year: int = 0
    category: str = ""
    yearly_publications: list[YearlyPublication] = []


class MostResearchedEntry(BaseModel):
    gene_symbol: str
    total_all_time: int = 0
    last_12_months: int = 0
    trend_direction: str = "stable"
    category: str = ""


class TrendingGenesResponse(BaseModel):
    trending: list[TrendingGeneEntry] = []
    most_researched: list[MostResearchedEntry] = []
    categories: dict[str, str] = {}
    generated_at: str = ""


# --- Health ---

class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    version: str


# --- Clinical Report ---


class ReportGeneSummary(BaseModel):
    gene_symbol: str
    gene_name: str = ""
    aliases: list[str] = []
    chromosome: str = ""
    cytogenetic_band: str = ""
    coordinates: str = ""
    ensembl_id: str = ""
    omim_link: str = ""
    function_summary: str = ""
    inheritance_patterns: list[str] = []


class ReportVariantEntry(BaseModel):
    variant_id: str
    hgvs_genomic: str = ""
    hgvs_coding: str = ""
    hgvs_protein: str = ""
    variant_type: str = ""
    consequence: str = ""
    clinical_significance: str = ""
    review_status: str = ""
    review_stars: int = 0
    allele_frequency: float | None = None
    conditions: list[str] = []


class ReportVariantSummary(BaseModel):
    variants: list[ReportVariantEntry] = []
    total_pathogenic: int = 0
    total_likely_pathogenic: int = 0
    total_vus: int = 0
    total_benign: int = 0
    total_likely_benign: int = 0


class ReportDiseaseBlock(BaseModel):
    disease_name: str
    inheritance_pattern: str = ""
    pathogenic_variant_count: int = 0
    key_variants: list[str] = []


class ReportPopulationFreqEntry(BaseModel):
    variant_id: str
    hgvs: str = ""
    populations: dict[str, float] = {}
    max_population: str = ""
    max_af: float = 0.0
    min_population: str = ""
    min_af: float = 0.0


class ReportProteinImpact(BaseModel):
    domains: list[ProteinDomain] = []
    domain_variant_counts: dict[str, int] = {}
    hotspot_regions: list[str] = []


class ReportResearchContext(BaseModel):
    total_publications_5yr: int = 0
    trend_direction: str = "stable"
    key_references: list[PubMedArticle] = []


class ReportMethodology(BaseModel):
    data_sources: dict[str, str] = {}
    genome_build: str = "GRCh38"
    access_date: str = ""
    filtering_criteria: list[str] = []
    limitations: list[str] = []


class ReportClinicalMetrics(BaseModel):
    pathogenic_variant_burden: float = 0.0
    vus_to_pathogenic_ratio: float = 0.0
    actionability_score: str = "Unknown"
    total_variants_analyzed: int = 0


class ClinicalReportResponse(BaseModel):
    gene_symbol: str
    generated_at: str
    report_sections: dict[str, bool] = {}
    variant_filter: str = "all"
    gene_summary: ReportGeneSummary | None = None
    variant_summary: ReportVariantSummary | None = None
    disease_associations: list[ReportDiseaseBlock] = []
    population_frequencies: list[ReportPopulationFreqEntry] = []
    protein_impact: ReportProteinImpact | None = None
    research_context: ReportResearchContext | None = None
    methodology: ReportMethodology | None = None
    clinical_metrics: ReportClinicalMetrics | None = None
    disclaimer: str = ""
