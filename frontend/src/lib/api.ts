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
}

export interface DiseaseAssociation {
  disease_name: string;
  variant_count: number;
  associated_variants: string[];
}

export interface ClinVarData {
  variants: ClinVarVariant[];
  diseases: DiseaseAssociation[];
}

export interface PopulationFrequency {
  population: string;
  af: number;
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

export default api;
