import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, Dna } from 'lucide-react';
import { fetchGene } from '../lib/api';
import type { GeneDashboardResponse } from '../lib/api';
import GlassCard from '../components/ui/GlassCard';
import GlowBadge from '../components/ui/GlowBadge';
import SkeletonLoader from '../components/ui/SkeletonLoader';

export default function GeneDashboardPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const upperSymbol = symbol?.toUpperCase() || '';

  const { data, isLoading, error } = useQuery<GeneDashboardResponse, Error>({
    queryKey: ['gene', upperSymbol],
    queryFn: () => fetchGene(upperSymbol),
    enabled: upperSymbol.length > 0,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="relative w-12 h-12 mx-auto mb-4">
            <Dna
              className="w-12 h-12 text-cyan"
              style={{ animation: 'spin-slow 2s linear infinite' }}
            />
          </div>
          <p className="text-text-secondary font-mono text-sm">
            Decoding {upperSymbol}...
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
            <SkeletonLoader variant="card" lines={4} />
            <SkeletonLoader variant="card" lines={3} />
            <SkeletonLoader variant="card" lines={5} />
            <SkeletonLoader variant="card" lines={3} />
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-magenta/10 border border-magenta/30 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-magenta flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-magenta text-sm font-body font-semibold mb-1">
              Gene not found
            </p>
            <p className="text-magenta/80 text-sm font-body">{error.message}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!data || !data.gene) return null;

  const gene = data.gene;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
      {/* Gene Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            <span className="font-mono text-cyan">{gene.gene_symbol}</span>
          </h1>
          <GlowBadge color={data.metadata.cached ? 'green' : 'cyan'}>
            {data.metadata.cached ? 'Cached' : 'Live'}
          </GlowBadge>
          <GlowBadge color="muted">{gene.biotype}</GlowBadge>
        </div>
        <p className="text-text-secondary font-body text-lg">{gene.description}</p>
      </motion.div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <GlassCard delay={0.05}>
          <h3 className="text-xs text-text-muted uppercase tracking-wider font-body mb-3">
            Genomic Location
          </h3>
          <div className="space-y-2">
            <InfoRow label="Ensembl ID" value={gene.ensembl_id} />
            <InfoRow
              label="Coordinates"
              value={`Chr${gene.chromosome}:${gene.start.toLocaleString()}-${gene.end.toLocaleString()}`}
            />
            <InfoRow label="Strand" value={gene.strand === 1 ? 'Forward (+)' : 'Reverse (-)'} />
            <InfoRow
              label="Length"
              value={`${((gene.end - gene.start) / 1000).toFixed(1)} kb`}
            />
            <InfoRow label="Transcripts" value={gene.transcript_count.toString()} />
          </div>
        </GlassCard>

        {data.protein && (
          <GlassCard delay={0.1}>
            <h3 className="text-xs text-text-muted uppercase tracking-wider font-body mb-3">
              Protein
            </h3>
            <div className="space-y-2">
              <InfoRow label="UniProt" value={data.protein.uniprot_id} />
              <InfoRow label="Name" value={data.protein.protein_name} />
              <InfoRow label="Length" value={`${data.protein.protein_length} aa`} />
              <InfoRow label="Domains" value={data.protein.domains.length.toString()} />
            </div>
            {data.protein.function_description && (
              <p className="text-text-secondary text-xs mt-3 leading-relaxed line-clamp-3">
                {data.protein.function_description}
              </p>
            )}
          </GlassCard>
        )}

        {data.variants && (
          <GlassCard delay={0.15}>
            <h3 className="text-xs text-text-muted uppercase tracking-wider font-body mb-3">
              Clinical Variants
            </h3>
            <div className="space-y-2">
              <InfoRow label="ClinVar Variants" value={data.variants.variants.length.toString()} />
              <InfoRow label="Diseases" value={data.variants.diseases.length.toString()} />
              {data.allele_frequencies && (
                <InfoRow
                  label="gnomAD Variants"
                  value={data.allele_frequencies.total_variants.toLocaleString()}
                />
              )}
            </div>
            {data.variants.diseases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.variants.diseases.slice(0, 3).map((d) => (
                  <GlowBadge key={d.disease_name} color="magenta">
                    {d.disease_name.length > 25
                      ? d.disease_name.slice(0, 25) + '...'
                      : d.disease_name}
                  </GlowBadge>
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>

      {/* Publications */}
      {data.publications && data.publications.articles.length > 0 && (
        <GlassCard delay={0.2} className="mb-8">
          <h3 className="text-xs text-text-muted uppercase tracking-wider font-body mb-4">
            Recent Publications ({data.publications.total_results.toLocaleString()} total)
          </h3>
          <div className="space-y-3">
            {data.publications.articles.slice(0, 5).map((article) => (
              <a
                key={article.pmid}
                href={article.pubmed_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-space-800/50 border border-space-600/30
                           hover:border-cyan/20 hover:bg-space-700/40 transition-all group"
              >
                <p className="text-text-primary text-sm font-body leading-snug group-hover:text-cyan transition-colors">
                  {article.title}
                </p>
                <p className="text-text-muted text-xs mt-1 font-mono">
                  {article.authors} &middot; {article.journal} ({article.year})
                </p>
              </a>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Data Sources Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-4 text-text-muted text-xs font-mono"
      >
        {Object.entries(data.metadata.data_sources).map(([source, ok]) => (
          <span key={source} className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-helix-green' : 'bg-magenta'}`}
            />
            {source}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-text-muted text-xs font-body">{label}</span>
      <span className="text-text-primary text-sm font-mono truncate max-w-[60%] text-right" title={value}>
        {value}
      </span>
    </div>
  );
}
