import { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Dna, MapPin, ChevronRight, AlertCircle,
  Loader2, Lightbulb,
} from 'lucide-react';
import { fetchSearch } from '../lib/api';
import type { SearchResponse, SearchResultItem } from '../lib/api';
import GlassCard from '../components/ui/GlassCard';
import GlowBadge from '../components/ui/GlowBadge';
import SmartSearch from '../components/SmartSearch';

const BIOTYPE_COLORS: Record<string, string> = {
  protein_coding: 'cyan',
  lncRNA: 'amber',
  miRNA: 'magenta',
  pseudogene: 'text-text-muted',
};

function ResultCard({ result, index }: { result: SearchResultItem; index: number }) {
  const navigate = useNavigate();
  const biotypeColor = BIOTYPE_COLORS[result.biotype] ?? 'cyan';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <button
        onClick={() => navigate(`/gene/${result.gene_symbol}`)}
        className="w-full text-left bg-transparent border-none cursor-pointer p-0"
      >
        <GlassCard hover>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center shrink-0 mt-0.5">
              <Dna className="w-5 h-5 text-cyan" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-mono font-bold text-cyan">{result.gene_symbol}</h3>
                {result.biotype && (
                  <GlowBadge color={biotypeColor as 'cyan' | 'amber' | 'magenta' | 'green'}>
                    {result.biotype.replace(/_/g, ' ')}
                  </GlowBadge>
                )}
                {result.score >= 40 && (
                  <span className="text-[10px] font-mono text-helix-green/60">
                    Best match
                  </span>
                )}
              </div>

              {result.gene_name && (
                <p className="text-sm font-body text-text-secondary mb-1.5 truncate">
                  {result.gene_name}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-text-muted">
                {result.chromosome && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Chr {result.chromosome}{result.band ? ` (${result.band})` : ''}
                  </span>
                )}
                {result.ensembl_id && (
                  <span className="text-text-muted/50">{result.ensembl_id}</span>
                )}
              </div>

              {result.match_reasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {result.match_reasons.map((reason, i) => (
                    <span
                      key={`${reason.reason_type}-${i}`}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-space-700/50 text-text-muted/70 border border-space-600/30"
                    >
                      {reason.detail}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-text-muted/30 shrink-0 mt-2" />
          </div>
        </GlassCard>
      </button>
    </motion.div>
  );
}

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<SearchResponse>({
    queryKey: ['search', query],
    queryFn: () => fetchSearch(query, 30),
    enabled: query.length > 0,
    staleTime: 60_000,
  });

  // If there's exactly one result with a very high score, redirect to gene page
  useEffect(() => {
    if (data && data.results.length === 1 && data.results[0].score >= 40) {
      navigate(`/gene/${data.results[0].gene_symbol}`, { replace: true });
    }
  }, [data, navigate]);

  const parsedTypes = data?.parsed_query?.terms?.map(t => t.type) ?? [];
  const didYouMean = data?.did_you_mean;

  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-16">
      <div className="mb-8">
        <SmartSearch variant="navbar" className="max-w-2xl" />
      </div>

      {query && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <h1 className="text-xl font-heading font-bold text-text-primary mb-1">
            Search results for &quot;{query}&quot;
          </h1>
          {data && (
            <p className="text-sm font-body text-text-muted">
              {data.total_results} result{data.total_results !== 1 ? 's' : ''} found
              {data.search_time_ms > 0 && (
                <span className="ml-2 text-text-muted/40">({data.search_time_ms}ms)</span>
              )}
              {parsedTypes.length > 0 && (
                <span className="ml-2 text-text-muted/50">
                  ({[...new Set(parsedTypes)].join(', ')})
                </span>
              )}
            </p>
          )}
        </motion.div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-cyan animate-spin mx-auto mb-3" />
            <p className="text-sm font-body text-text-muted">Searching across all databases...</p>
          </div>
        </div>
      )}

      {error && (
        <GlassCard>
          <div className="flex items-center gap-3 text-magenta">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-body">{(error as Error).message}</p>
          </div>
        </GlassCard>
      )}

      {/* Did you mean */}
      {didYouMean && data && data.results.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <GlassCard>
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-body text-text-secondary mb-2">Did you mean:</p>
                <button
                  onClick={() => navigate(`/search?q=${encodeURIComponent(didYouMean)}`)}
                  className="px-3 py-1.5 rounded-lg text-sm font-mono text-cyan bg-cyan/10 border border-cyan/20
                    hover:bg-cyan/20 transition-colors cursor-pointer"
                >
                  {didYouMean}
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Did you mean alongside results */}
      {didYouMean && data && data.results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-center gap-2 text-xs font-body text-text-muted/60"
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber/50" />
          <span>Also try:</span>
          <Link
            to={`/search?q=${encodeURIComponent(didYouMean)}`}
            className="font-mono text-cyan/60 hover:text-cyan transition-colors"
          >
            {didYouMean}
          </Link>
        </motion.div>
      )}

      {/* Results list */}
      {data && data.results.length > 0 && (
        <div className="space-y-3">
          {data.results.map((result, i) => (
            <ResultCard key={result.gene_symbol} result={result} index={i} />
          ))}
        </div>
      )}

      {/* No results */}
      {data && data.results.length === 0 && !didYouMean && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <Search className="w-12 h-12 text-text-muted/20 mx-auto mb-4" />
          <h2 className="text-lg font-heading font-semibold text-text-primary mb-2">
            No results found
          </h2>
          <p className="text-sm font-body text-text-muted mb-6 max-w-md mx-auto">
            Try searching with a different gene symbol, disease name, chromosomal location, or variant ID.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['TP53', 'breast cancer', 'chr17:7668402-7687550', 'rs28934578'].map((example) => (
              <button
                key={example}
                onClick={() => navigate(`/search?q=${encodeURIComponent(example)}`)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-text-muted bg-space-700/50
                  border border-space-600/30 hover:border-cyan/30 hover:text-cyan
                  transition-colors cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
