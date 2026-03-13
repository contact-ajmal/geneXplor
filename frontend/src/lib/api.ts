import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail || error.message || 'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  },
);

// ── Types ──

export interface TranscriptData {
  id: string;
  display_name: string;
  biotype: string;
  length: number;
}

export interface EnsemblGeneData {
  gene_symbol: string;
  gene_name: string;
  description: string;
  ensembl_id: string;
  chromosome: string;
  start: number;
  end: number;
  strand: number;
  biotype: string;
  transcript_count: number;
  transcripts: TranscriptData[];
}

export interface ProteinDomain {
  name: string;
  start: number;
  end: number;
  description: string;
}

export interface UniProtData {
  uniprot_id: string;
  protein_name: string;
  protein_length: number;
  function_description: string;
  domains: ProteinDomain[];
  gene_names: string[];
}

export interface ClinVarVariant {
  variant_id: string;
  title: string;
  clinical_significance: string;
  condition: string;
  review_status: string;
  variant_type: string;
  date_created: string;
  date_last_evaluated: string;
  submitter_name: string;
  submission_count: number;
}

export interface DiseaseAssociation {
  disease_name: string;
  variant_count: number;
  associated_variants: string[];
}

export interface NotableVariant {
  variant_id: string;
  title: string;
  significance: string;
  submitter: string;
}

export interface TimelineBucket {
  date: string;
  total_new_variants: number;
  by_significance: Record<string, number>;
  cumulative_variants: number;
  notable_variants: NotableVariant[];
}

export interface TimelineData {
  buckets: TimelineBucket[];
  first_submission_date: string;
  peak_month: string;
  peak_month_count: number;
  submission_rate_trend: string;
  recent_12mo_count: number;
  total_submissions: number;
  unique_submitters: number;
  most_active_submitter: string;
  date_range_start: string;
  date_range_end: string;
}

export interface ClinVarData {
  variants: ClinVarVariant[];
  diseases: DiseaseAssociation[];
  timeline: TimelineData | null;
}

export interface PopulationFrequency {
  population: string;
  af: number;
  ac: number;
  an: number;
}

export interface GnomADVariant {
  variant_id: string;
  position: number;
  consequence: string;
  hgvsc: string;
  hgvsp: string;
  allele_frequency: number;
  allele_count: number;
  allele_number: number;
  population_frequencies: PopulationFrequency[];
}

export interface GnomADData {
  variants: GnomADVariant[];
  total_variants: number;
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  pubmed_link: string;
  abstract_snippet: string;
}

export interface PubMedData {
  articles: PubMedArticle[];
  total_results: number;
}

export interface PathwayEntry {
  id: string;
  name: string;
  source: string;
  category: string;
  description: string;
  url: string;
  gene_count: number;
  sub_events: string[];
}

export interface PathwayData {
  pathways: PathwayEntry[];
  total_pathways: number;
}

export interface VariantResidue {
  residue_number: number;
  amino_acid_change: string;
  clinical_significance: string;
  allele_frequency: number | null;
  variant_id: string;
}

export interface StructureData {
  structure_available: boolean;
  source: string;
  structure_url: string;
  uniprot_id: string;
  mean_confidence: number;
  model_version: string;
  alphafold_url: string;
  variant_residues: VariantResidue[];
}

export interface InteractionEdge {
  gene_a: string;
  gene_b: string;
  combined_score: number;
  experimental_score: number;
  database_score: number;
  textmining_score: number;
  coexpression_score: number;
}

export interface InteractionNode {
  gene_symbol: string;
  is_center: boolean;
  interaction_count: number;
}

export interface EnrichmentTerm {
  term: string;
  description: string;
  p_value: number;
  category: string;
}

export interface InteractionData {
  center_gene: string;
  interactions: InteractionEdge[];
  nodes: InteractionNode[];
  enrichment: EnrichmentTerm[];
}

export interface DataSourceStatus {
  ensembl: boolean;
  uniprot: boolean;
  clinvar: boolean;
  gnomad: boolean;
  pubmed: boolean;
  pathways: boolean;
  structure: boolean;
  interactions: boolean;
}

export interface ResponseMetadata {
  fetched_at: string;
  cached: boolean;
  data_sources: DataSourceStatus;
}

export interface GeneDashboardResponse {
  gene_symbol: string;
  gene: EnsemblGeneData | null;
  protein: UniProtData | null;
  variants: ClinVarData | null;
  allele_frequencies: GnomADData | null;
  publications: PubMedData | null;
  pathways: PathwayData | null;
  structure: StructureData | null;
  interactions: InteractionData | null;
  metadata: ResponseMetadata;
}

export interface GeneSummaryResponse {
  summary: string;
  generated_at: string;
  source: 'ai' | 'template';
}

export interface HealthResponse {
  status: string;
  database: string;
  redis: string;
  version: string;
}

// ── Research Pulse Types ──

export interface YearlyPublication {
  year: number;
  count: number;
}

export interface ResearchPulseResponse {
  gene_symbol: string;
  yearly_publications: YearlyPublication[];
  last_12_months: number;
  prior_12_months: number;
  trend_ratio: number;
  trend_direction: 'rising' | 'stable' | 'declining';
  peak_year: number;
  total_all_time: number;
}

export interface TrendingGeneEntry {
  gene_symbol: string;
  trend_ratio: number;
  last_12_months: number;
  prior_12_months: number;
  trend_direction: 'rising' | 'stable' | 'declining';
  total_all_time: number;
  peak_year: number;
  category: string;
  yearly_publications: YearlyPublication[];
}

export interface MostResearchedEntry {
  gene_symbol: string;
  total_all_time: number;
  last_12_months: number;
  trend_direction: 'rising' | 'stable' | 'declining';
  category: string;
}

export interface TrendingGenesResponse {
  trending: TrendingGeneEntry[];
  most_researched: MostResearchedEntry[];
  categories: Record<string, string>;
  generated_at: string;
}

// ── Clinical Report Types ──

export interface ReportGeneSummary {
  gene_symbol: string;
  gene_name: string;
  aliases: string[];
  chromosome: string;
  cytogenetic_band: string;
  coordinates: string;
  ensembl_id: string;
  omim_link: string;
  function_summary: string;
  inheritance_patterns: string[];
}

export interface ReportVariantEntry {
  variant_id: string;
  hgvs_genomic: string;
  hgvs_coding: string;
  hgvs_protein: string;
  variant_type: string;
  consequence: string;
  clinical_significance: string;
  review_status: string;
  review_stars: number;
  allele_frequency: number | null;
  conditions: string[];
}

export interface ReportVariantSummary {
  variants: ReportVariantEntry[];
  total_pathogenic: number;
  total_likely_pathogenic: number;
  total_vus: number;
  total_benign: number;
  total_likely_benign: number;
}

export interface ReportDiseaseBlock {
  disease_name: string;
  inheritance_pattern: string;
  pathogenic_variant_count: number;
  key_variants: string[];
}

export interface ReportPopulationFreqEntry {
  variant_id: string;
  hgvs: string;
  populations: Record<string, number>;
  max_population: string;
  max_af: number;
  min_population: string;
  min_af: number;
}

export interface ReportProteinImpact {
  domains: ProteinDomain[];
  domain_variant_counts: Record<string, number>;
  hotspot_regions: string[];
}

export interface ReportResearchContext {
  total_publications_5yr: number;
  trend_direction: string;
  key_references: PubMedArticle[];
}

export interface ReportMethodology {
  data_sources: Record<string, string>;
  genome_build: string;
  access_date: string;
  filtering_criteria: string[];
  limitations: string[];
}

export interface ReportClinicalMetrics {
  pathogenic_variant_burden: number;
  vus_to_pathogenic_ratio: number;
  actionability_score: string;
  total_variants_analyzed: number;
}

export interface ClinicalReportResponse {
  gene_symbol: string;
  generated_at: string;
  report_sections: Record<string, boolean>;
  variant_filter: string;
  gene_summary: ReportGeneSummary | null;
  variant_summary: ReportVariantSummary | null;
  disease_associations: ReportDiseaseBlock[];
  population_frequencies: ReportPopulationFreqEntry[];
  protein_impact: ReportProteinImpact | null;
  research_context: ReportResearchContext | null;
  methodology: ReportMethodology | null;
  clinical_metrics: ReportClinicalMetrics | null;
  disclaimer: string;
}

// ── API Calls ──

export const fetchCompareGenes = async (
  symbolA: string,
  symbolB: string,
): Promise<[GeneDashboardResponse, GeneDashboardResponse]> => {
  const { data } = await api.get<GeneDashboardResponse[]>('/gene/compare', {
    params: { genes: `${symbolA},${symbolB}` },
  });
  return [data[0], data[1]];
};

export const fetchGene = async (symbol: string): Promise<GeneDashboardResponse> => {
  const { data } = await api.get<GeneDashboardResponse>(`/gene/${symbol}`);
  return data;
};

export const fetchGeneSummary = async (symbol: string): Promise<GeneSummaryResponse> => {
  const { data } = await api.get<GeneSummaryResponse>(`/gene/${symbol}/summary`);
  return data;
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
};

export const fetchResearchPulse = async (symbol: string): Promise<ResearchPulseResponse> => {
  const { data } = await api.get<ResearchPulseResponse>(`/research/pulse/${symbol}`);
  return data;
};

export const fetchTrendingGenes = async (): Promise<TrendingGenesResponse> => {
  const { data } = await api.get<TrendingGenesResponse>('/research/trending');
  return data;
};

export const fetchClinicalReport = async (
  symbol: string,
  options?: {
    variant_filter?: string;
    sections?: string[];
  },
): Promise<ClinicalReportResponse> => {
  const params: Record<string, string> = { format: 'json' };
  if (options?.variant_filter) params.variant_filter = options.variant_filter;
  if (options?.sections?.length) params.sections = options.sections.join(',');
  const { data } = await api.get<ClinicalReportResponse>(`/gene/${symbol}/report`, { params });
  return data;
};

export const downloadClinicalReportPdf = async (
  symbol: string,
  options?: {
    variant_filter?: string;
    sections?: string[];
  },
): Promise<void> => {
  const params: Record<string, string> = { format: 'pdf' };
  if (options?.variant_filter) params.variant_filter = options.variant_filter;
  if (options?.sections?.length) params.sections = options.sections.join(',');
  const { data } = await api.get(`/gene/${symbol}/report`, {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${symbol}_clinical_report.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadClinicalReportMarkdown = async (
  symbol: string,
  options?: {
    variant_filter?: string;
    sections?: string[];
  },
): Promise<string> => {
  const params: Record<string, string> = { format: 'markdown' };
  if (options?.variant_filter) params.variant_filter = options.variant_filter;
  if (options?.sections?.length) params.sections = options.sections.join(',');
  const { data } = await api.get(`/gene/${symbol}/report`, {
    params,
    responseType: 'text',
  });
  return data;
};

export default api;
