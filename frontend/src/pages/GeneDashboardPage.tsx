import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, Dna, Search } from 'lucide-react';
import { fetchGene } from '../lib/api';
import type { GeneDashboardResponse } from '../lib/api';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import GeneHeader from '../components/gene/GeneHeader';
import GeneOverviewCard from '../components/gene/GeneOverviewCard';
import ProteinInfoCard from '../components/gene/ProteinInfoCard';
import ProteinVariantMap from '../components/gene/ProteinVariantMap';
import VariantTable from '../components/gene/VariantTable';
import DiseaseAssociations from '../components/gene/DiseaseAssociations';
import ResearchPublications from '../components/gene/ResearchPublications';
import DataSourcesFooter from '../components/gene/DataSourcesFooter';
import AnimatedButton from '../components/ui/AnimatedButton';

export default function GeneDashboardPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const upperSymbol = symbol?.toUpperCase() || '';
  const [diseaseFilter, setDiseaseFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, error, refetch } = useQuery<GeneDashboardResponse, Error>({
    queryKey: ['gene', upperSymbol],
    queryFn: () => fetchGene(upperSymbol),
    enabled: upperSymbol.length > 0,
  });

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="relative w-14 h-14 mx-auto mb-4">
            <Dna
              className="w-14 h-14 text-cyan"
              style={{ animation: 'spin-slow 2s linear infinite' }}
            />
          </div>
          <p className="text-text-secondary font-mono text-sm mb-2">
            Decoding <span className="text-cyan">{upperSymbol}</span>...
          </p>
          <p className="text-text-muted text-xs font-body">
            Aggregating data from 5 sources
          </p>
        </motion.div>

        {/* Skeleton dashboard */}
        <div className="space-y-4 mt-8">
          {/* Header skeleton */}
          <div className="space-y-3">
            <div className="h-10 w-40 rounded skeleton-shimmer" />
            <div className="h-5 w-80 rounded skeleton-shimmer" />
            <div className="h-4 w-60 rounded skeleton-shimmer" />
          </div>

          {/* Overview card */}
          <SkeletonLoader variant="card" lines={4} />

          {/* Protein card */}
          <SkeletonLoader variant="card" lines={5} />

          {/* Variant map */}
          <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
            <div className="h-5 w-48 rounded skeleton-shimmer mb-4" />
            <div className="h-48 rounded skeleton-shimmer" />
          </div>

          {/* Variant table */}
          <SkeletonLoader variant="card" lines={6} />

          {/* Grid: diseases + publications */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonLoader variant="card" lines={4} />
            <SkeletonLoader variant="card" lines={4} />
          </div>
        </div>
      </div>
    );
  }

  // ── Error: Gene Not Found ──
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* DNA illustration */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <Dna className="w-20 h-20 text-magenta/40" />
          </div>

          <div className="p-6 rounded-2xl bg-magenta/5 border border-magenta/20 mb-6">
            <AlertCircle className="w-6 h-6 text-magenta mx-auto mb-3" />
            <h2 className="text-lg font-heading font-semibold text-text-primary mb-2">
              Gene not found
            </h2>
            <p className="text-text-secondary text-sm font-body mb-4">
              Gene &lsquo;<span className="font-mono text-cyan">{upperSymbol}</span>&rsquo; was not found.
              Try searching for <span className="font-mono text-cyan">TP53</span>,{' '}
              <span className="font-mono text-cyan">BRCA1</span>, or{' '}
              <span className="font-mono text-cyan">EGFR</span>.
            </p>
            <p className="text-text-muted text-xs font-body">{error.message}</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link to="/">
              <AnimatedButton variant="primary">
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Back to search
                </span>
              </AnimatedButton>
            </Link>
            <AnimatedButton variant="secondary" onClick={() => refetch()}>
              Retry
            </AnimatedButton>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!data || !data.gene) return null;

  const { gene, protein, variants, allele_frequencies, publications, metadata } = data;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
      {/* Page Header */}
      <GeneHeader gene={gene} metadata={metadata} />

      {/* Section 1: Gene Overview */}
      <div className="space-y-6">
        <GeneOverviewCard gene={gene} delay={0.05} />

        {/* Section 2: Protein Information */}
        {protein ? (
          <ProteinInfoCard protein={protein} delay={0.1} />
        ) : (
          <UnavailableSection
            title="Protein Information"
            message="No protein information available for this gene"
            delay={0.1}
          />
        )}

        {/* Section 3: Protein Variant Map (Hero) */}
        {protein && (variants || allele_frequencies) ? (
          <ProteinVariantMap
            protein={protein}
            clinvarVariants={variants?.variants || []}
            gnomadVariants={allele_frequencies?.variants || []}
            delay={0.15}
          />
        ) : null}

        {/* Section 4: Variant Table */}
        {variants && variants.variants.length > 0 ? (
          <VariantTable
            clinvarVariants={variants.variants}
            gnomadVariants={allele_frequencies?.variants || []}
            delay={0.2}
            significanceFilter={diseaseFilter}
          />
        ) : (
          <UnavailableSection
            title="Variant Table"
            message="No clinical variants found for this gene"
            delay={0.2}
          />
        )}

        {/* Section 5: Disease Associations */}
        {variants && variants.diseases.length > 0 ? (
          <DiseaseAssociations
            diseases={variants.diseases}
            geneSymbol={gene.gene_symbol}
            onDiseaseClick={(name) => setDiseaseFilter(name)}
            delay={0.25}
          />
        ) : null}

        {/* Section 6: Research Publications */}
        {publications && publications.articles.length > 0 ? (
          <ResearchPublications
            articles={publications.articles}
            totalResults={publications.total_results}
            delay={0.3}
          />
        ) : (
          <UnavailableSection
            title="Recent Publications"
            message="No publications found for this gene"
            delay={0.3}
          />
        )}
      </div>

      {/* Section 7: Data Sources Footer */}
      <DataSourcesFooter metadata={metadata} delay={0.35} />
    </div>
  );
}

function UnavailableSection({ title, message, delay = 0 }: { title: string; message: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-space-600/20 p-6 bg-space-800/20 text-center"
    >
      <h2 className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
        {title}
      </h2>
      <p className="text-text-muted text-sm font-body">{message}</p>
    </motion.div>
  );
}
