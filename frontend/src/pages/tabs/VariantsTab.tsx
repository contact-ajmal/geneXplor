import { useState, useCallback, Suspense, lazy } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import VariantTable from '../../components/gene/VariantTable';
import VariantDetailModal from '../../components/gene/VariantDetailModal';

const VariantAnalytics = lazy(() => import('../../components/gene/VariantAnalytics'));

export default function VariantsTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { variants, allele_frequencies, protein, reconciliation } = data;
  const [diseaseFilter, setDiseaseFilter] = useState<string | undefined>(undefined);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [openOnImpactTab, setOpenOnImpactTab] = useState(false);
  const [filteredVariantIds, setFilteredVariantIds] = useState<string[] | null>(null);

  const handleVariantClick = useCallback((variantId: string) => {
    setOpenOnImpactTab(false);
    setSelectedVariantId(variantId);
  }, []);

  const handleSimulateClick = useCallback((variantId: string) => {
    setOpenOnImpactTab(true);
    setSelectedVariantId(variantId);
  }, []);

  const handleSignificanceFilter = useCallback((sig: string) => {
    setDiseaseFilter(sig);
  }, []);

  const handleFilteredIdsChange = useCallback((ids: string[]) => {
    setFilteredVariantIds(ids);
  }, []);

  if (!variants || variants.variants.length === 0) {
    return (
      <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Variant Explorer
        </p>
        <p className="text-text-muted text-sm font-body">No clinical variants found for this gene</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table (left) + Analytics (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Variant Table (65%) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-3"
        >
          <VariantTable
            clinvarVariants={variants.variants}
            gnomadVariants={allele_frequencies?.variants || []}
            conflicts={reconciliation?.conflicts || []}
            delay={0}
            significanceFilter={diseaseFilter}
            onVariantClick={handleVariantClick}
            onSimulateClick={handleSimulateClick}
            onFilteredIdsChange={handleFilteredIdsChange}
          />
        </motion.div>

        {/* Variant Analytics sidebar (35%) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="xl:col-span-2"
        >
          <Suspense fallback={
            <div className="rounded-2xl border border-ocean-100 p-5 bg-white">
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
        </motion.div>
      </div>

      {/* Variant Detail Modal */}
      <VariantDetailModal
        variantId={selectedVariantId}
        clinvarVariants={variants.variants}
        gnomadVariants={allele_frequencies?.variants || []}
        protein={protein}
        diseases={variants.diseases || []}
        initialTab={openOnImpactTab ? 'impact' : 'details'}
        onClose={() => { setSelectedVariantId(null); setOpenOnImpactTab(false); }}
      />
    </div>
  );
}
