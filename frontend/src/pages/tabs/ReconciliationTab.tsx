import { Suspense, lazy, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import VariantDetailModal from '../../components/gene/VariantDetailModal';

const ReconciliationPanel = lazy(() => import('../../components/gene/ReconciliationPanel'));

export default function ReconciliationTab() {
  const { data } = useOutletContext<DashboardOutletContext>();
  const { reconciliation, variants, allele_frequencies, protein } = data;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const handleVariantClick = useCallback((variantId: string) => {
    setSelectedVariantId(variantId);
  }, []);

  if (!reconciliation?.summary || (reconciliation.summary.conflicts_found === 0 && !(variants && allele_frequencies))) {
    return (
      <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Database Reconciliation
        </p>
        <p className="text-text-muted text-sm font-body">No reconciliation data available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Suspense fallback={
        <div className="rounded-2xl border border-ocean-100 p-5 bg-white">
          <div className="h-5 w-56 rounded skeleton-shimmer mb-4" />
          <div className="h-[300px] rounded skeleton-shimmer" />
        </div>
      }>
        <ReconciliationPanel
          reconciliation={reconciliation}
          delay={0}
          onVariantClick={handleVariantClick}
        />
      </Suspense>

      <VariantDetailModal
        variantId={selectedVariantId}
        clinvarVariants={variants?.variants || []}
        gnomadVariants={allele_frequencies?.variants || []}
        protein={protein}
        diseases={variants?.diseases || []}
        initialTab="details"
        onClose={() => setSelectedVariantId(null)}
      />
    </motion.div>
  );
}
