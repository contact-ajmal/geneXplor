import { useState, lazy, Suspense, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, Dna, Search, GitCompare, ArrowRight } from 'lucide-react';
import { fetchGene } from '../lib/api';
import type { GeneDashboardResponse } from '../lib/api';
import ScrollReveal from '../components/ui/ScrollReveal';
import GeneHeader from '../components/gene/GeneHeader';
import AiGeneSummary from '../components/gene/AiGeneSummary';
import GeneOverviewCard from '../components/gene/GeneOverviewCard';
import ProteinInfoCard from '../components/gene/ProteinInfoCard';
import ProteinVariantMap from '../components/gene/ProteinVariantMap';
import VariantTable from '../components/gene/VariantTable';
import VariantDetailModal from '../components/gene/VariantDetailModal';
import ExportToolbar from '../components/gene/ExportToolbar';
import DiseaseAssociations from '../components/gene/DiseaseAssociations';
import ResearchPublications from '../components/gene/ResearchPublications';
import BiologicalPathways from '../components/gene/BiologicalPathways';
import DataSourcesFooter from '../components/gene/DataSourcesFooter';
import ToastContainer from '../components/ui/Toast';
import type { ToastMessage } from '../components/ui/Toast';
import AnimatedButton from '../components/ui/AnimatedButton';
import LoadingPage from './LoadingPage';

const VariantAnalytics = lazy(() => import('../components/gene/VariantAnalytics'));
const ProteinStructureViewer = lazy(() => import('../components/viz/ProteinStructureViewer'));
const InteractionNetwork = lazy(() => import('../components/viz/InteractionNetwork'));
const VariantTimeline = lazy(() => import('../components/viz/VariantTimeline'));
const PopulationMap = lazy(() => import('../components/viz/PopulationMap'));

export default function GeneDashboardPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const upperSymbol = symbol?.toUpperCase() || '';
  const [diseaseFilter, setDiseaseFilter] = useState<string | undefined>(undefined);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [filteredVariantIds, setFilteredVariantIds] = useState<string[] | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const handleVariantClick = useCallback((variantId: string) => {
    setSelectedVariantId(variantId);
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = String(++toastIdRef.current);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleFilteredIdsChange = useCallback((ids: string[]) => {
    setFilteredVariantIds(ids);
  }, []);

  const { data, isLoading, error, refetch } = useQuery<GeneDashboardResponse, Error>({
    queryKey: ['gene', upperSymbol],
    queryFn: () => fetchGene(upperSymbol),
    enabled: upperSymbol.length > 0,
  });

  const handleSignificanceFilter = useCallback((sig: string) => {
    setDiseaseFilter(sig);
  }, []);

  // ── Loading State: Full-screen loading page ──
  if (isLoading) {
    return <LoadingPage symbol={upperSymbol} />;
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

  const { gene, protein, variants, allele_frequencies, publications, pathways, structure, interactions, metadata } = data;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
      {/* Page Header */}
      <GeneHeader gene={gene} metadata={metadata} />

      {/* Export Toolbar */}
      <ExportToolbar
        gene={gene}
        clinvarVariants={variants?.variants || []}
        gnomadVariants={allele_frequencies?.variants || []}
        protein={protein}
        metadata={metadata}
        filteredVariantIds={filteredVariantIds}
        onToast={showToast}
      />

      {/* Section 0: AI Gene Summary */}
      <div className="space-y-6">
        <ScrollReveal>
          <div id="export-ai-summary">
            <AiGeneSummary geneSymbol={gene.gene_symbol} delay={0} />
          </div>
        </ScrollReveal>

        {/* Section 1: Gene Overview */}
        <ScrollReveal delay={0.05}>
          <div id="export-gene-overview">
            <GeneOverviewCard gene={gene} delay={0} />
          </div>
        </ScrollReveal>

        {/* Section 2: Protein Information */}
        <ScrollReveal delay={0.05}>
          <div id="export-protein-info">
            {protein ? (
              <ProteinInfoCard protein={protein} delay={0} />
            ) : (
              <UnavailableSection
                title="Protein Information"
                message="No protein information available for this gene"
              />
            )}
          </div>
        </ScrollReveal>

        {/* Section 2.5: 3D Protein Structure */}
        {structure && (
          <ScrollReveal delay={0.08}>
            <div id="export-protein-structure">
              <Suspense fallback={
                <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
                  <div className="h-5 w-48 rounded skeleton-shimmer mb-4" />
                  <div className="h-[350px] md:h-[450px] lg:h-[600px] rounded skeleton-shimmer" />
                </div>
              }>
                <ProteinStructureViewer
                  structure={structure}
                  geneSymbol={gene.gene_symbol}
                  onVariantClick={handleVariantClick}
                  delay={0}
                />
              </Suspense>
            </div>
          </ScrollReveal>
        )}

        {/* Section 3: Protein Variant Map (Hero) */}
        {protein && (variants || allele_frequencies) ? (
          <ScrollReveal delay={0.1}>
            <div id="export-variant-map">
              <ProteinVariantMap
                protein={protein}
                clinvarVariants={variants?.variants || []}
                gnomadVariants={allele_frequencies?.variants || []}
                delay={0}
                onVariantClick={handleVariantClick}
              />
            </div>
          </ScrollReveal>
        ) : null}

        {/* Section 4: Variant Table */}
        <ScrollReveal delay={0.15}>
          <div id="export-variant-table">
            {variants && variants.variants.length > 0 ? (
              <VariantTable
                clinvarVariants={variants.variants}
                gnomadVariants={allele_frequencies?.variants || []}
                delay={0}
                significanceFilter={diseaseFilter}
                onVariantClick={handleVariantClick}
                onFilteredIdsChange={handleFilteredIdsChange}
              />
            ) : (
              <UnavailableSection
                title="Variant Table"
                message="No clinical variants found for this gene"
              />
            )}
          </div>
        </ScrollReveal>

        {/* Section 4.5: Variant Analytics */}
        {variants && variants.variants.length > 0 && (
          <ScrollReveal delay={0.2}>
            <div id="export-variant-analytics">
              <Suspense fallback={
                <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
                  <div className="h-5 w-48 rounded skeleton-shimmer mb-4" />
                  <div className="h-48 rounded skeleton-shimmer" />
                </div>
              }>
                <VariantAnalytics
                  clinvarVariants={variants.variants}
                  gnomadVariants={allele_frequencies?.variants || []}
                  delay={0}
                  onSignificanceClick={handleSignificanceFilter}
                />
              </Suspense>
            </div>
          </ScrollReveal>
        )}

        {/* Section 4.6: Population Frequency Map */}
        {allele_frequencies && allele_frequencies.variants.length > 0 && (
          <ScrollReveal delay={0.21}>
            <div id="export-population-map">
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
                    <div className="h-5 w-56 rounded skeleton-shimmer mb-4" />
                    <div className="h-[400px] rounded skeleton-shimmer" />
                  </div>
                }
              >
                <PopulationMap
                  gnomadVariants={allele_frequencies.variants}
                  clinvarVariants={variants?.variants || []}
                  geneSymbol={gene.gene_symbol}
                  delay={0}
                />
              </Suspense>
            </div>
          </ScrollReveal>
        )}

        {/* Section 4.7: Variant Discovery Timeline */}
        {variants && variants.timeline && variants.timeline.buckets.length > 0 && (
          <ScrollReveal delay={0.22}>
            <div id="export-variant-timeline">
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
                    <div className="h-5 w-56 rounded skeleton-shimmer mb-4" />
                    <div className="h-[380px] rounded skeleton-shimmer" />
                  </div>
                }
              >
                <VariantTimeline
                  timeline={variants.timeline}
                  geneSymbol={gene.gene_symbol}
                  onVariantClick={handleVariantClick}
                  delay={0}
                />
              </Suspense>
            </div>
          </ScrollReveal>
        )}

        {/* Section 5: Disease Associations */}
        {variants && variants.diseases.length > 0 ? (
          <ScrollReveal delay={0.25}>
            <div id="export-disease-associations">
              <DiseaseAssociations
                diseases={variants.diseases}
                geneSymbol={gene.gene_symbol}
                onDiseaseClick={(name) => setDiseaseFilter(name)}
                delay={0}
              />
            </div>
          </ScrollReveal>
        ) : null}

        {/* Section 6: Research Publications */}
        <ScrollReveal delay={0.3}>
          <div id="export-publications">
            {publications && publications.articles.length > 0 ? (
              <ResearchPublications
                articles={publications.articles}
                totalResults={publications.total_results}
                delay={0}
              />
            ) : (
              <UnavailableSection
                title="Recent Publications"
                message="No publications found for this gene"
              />
            )}
          </div>
        </ScrollReveal>

        {/* Section 7: Biological Pathways */}
        <ScrollReveal delay={0.35}>
          {pathways && pathways.pathways.length > 0 ? (
            <div id="export-pathways">
              <BiologicalPathways
                pathways={pathways}
                geneSymbol={gene.gene_symbol}
                delay={0}
              />
            </div>
          ) : (
            <UnavailableSection
              title="Biological Pathways"
              message={`No pathway information available for ${gene.gene_symbol}. Pathway data is sourced from Reactome and KEGG.`}
            />
          )}
        </ScrollReveal>

        {/* Section 7.5: Gene Interaction Network */}
        {interactions && interactions.interactions.length > 0 && (
          <ScrollReveal delay={0.38}>
            <div id="export-interaction-network">
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
                    <div className="h-5 w-56 rounded skeleton-shimmer mb-4" />
                    <div className="h-[500px] rounded skeleton-shimmer" />
                  </div>
                }
              >
                <InteractionNetwork
                  interactions={interactions}
                  geneSymbol={gene.gene_symbol}
                  delay={0}
                />
              </Suspense>
            </div>
          </ScrollReveal>
        )}

        {/* Gene Comparison CTA */}
        <ScrollReveal delay={0.4}>
          <CompareWithSection symbol={upperSymbol} onNavigate={navigate} />
        </ScrollReveal>
      </div>

      {/* Section 7: Data Sources Footer */}
      <ScrollReveal delay={0.4}>
        <DataSourcesFooter metadata={metadata} delay={0} />
      </ScrollReveal>

      {/* Variant Detail Modal */}
      <VariantDetailModal
        variantId={selectedVariantId}
        clinvarVariants={variants?.variants || []}
        gnomadVariants={allele_frequencies?.variants || []}
        protein={protein}
        onClose={() => setSelectedVariantId(null)}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function CompareWithSection({
  symbol,
  onNavigate,
}: {
  symbol: string;
  onNavigate: (path: string) => void;
}) {
  const [compareGene, setCompareGene] = useState('');

  const handleCompare = () => {
    const other = compareGene.trim().toUpperCase();
    if (other && other !== symbol) {
      onNavigate(`/compare/${symbol}/${other}`);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan/[0.08] p-6 glass-bg backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <GitCompare className="w-6 h-6 text-cyan" />
          <div>
            <p className="text-sm font-heading font-semibold text-text-primary">
              Compare <span className="font-mono text-cyan">{symbol}</span> with another gene
            </p>
            <p className="text-text-muted text-xs font-body">Side-by-side comparison</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-sm w-full">
          <input
            type="text"
            value={compareGene}
            onChange={(e) => setCompareGene(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
            placeholder="e.g. BRCA1"
            className="flex-1 px-3 py-2 rounded-lg text-sm font-mono
              bg-space-800/60 border border-space-600/60 text-text-primary
              placeholder:text-text-muted/50
              focus:outline-none focus:border-cyan/30 focus:ring-1 focus:ring-cyan/20
              transition-all"
          />
          <AnimatedButton
            variant="primary"
            onClick={handleCompare}
            disabled={!compareGene.trim() || compareGene.trim().toUpperCase() === symbol}
          >
            <span className="flex items-center gap-1.5">
              Compare
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
}

function UnavailableSection({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-space-600/20 p-6 bg-space-800/20 text-center">
      <h2 className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
        {title}
      </h2>
      <p className="text-text-muted text-sm font-body">{message}</p>
    </div>
  );
}
