import { Suspense, lazy } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';

const PopulationMap = lazy(() => import('../../components/viz/PopulationMap'));

export default function PopulationTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { allele_frequencies, variants } = data;

  if (!allele_frequencies || allele_frequencies.variants.length === 0) {
    return (
      <div className="rounded-2xl border border-space-600/20 p-6 bg-space-800/20 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Population Map
        </p>
        <p className="text-text-muted text-sm font-body">No allele frequency data available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Suspense fallback={
        <div className="rounded-2xl border border-cyan/[0.05] p-5 bg-[rgba(20,27,45,0.5)] backdrop-blur-xl">
          <div className="h-5 w-56 rounded skeleton-shimmer mb-4" />
          <div className="h-[400px] rounded skeleton-shimmer" />
        </div>
      }>
        <PopulationMap
          gnomadVariants={allele_frequencies.variants}
          clinvarVariants={variants?.variants || []}
          geneSymbol={symbol}
          delay={0}
        />
      </Suspense>
    </motion.div>
  );
}
