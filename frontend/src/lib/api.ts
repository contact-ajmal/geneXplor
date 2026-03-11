import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail || error.message || 'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  },
);

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
}

export interface GeneResponse {
  gene_symbol: string;
  ensembl: EnsemblGeneData;
  source: string;
  cached_at: string | null;
}

export interface HealthResponse {
  status: string;
  database: string;
  redis: string;
  version: string;
}

export const fetchGene = async (symbol: string): Promise<GeneResponse> => {
  const { data } = await api.get<GeneResponse>(`/gene/${symbol}`);
  return data;
};

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
};

export default api;
