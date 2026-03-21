import { Suspense, lazy } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';

const InteractionNetwork = lazy(() => import('../../components/viz/InteractionNetwork'));

export default function InteractionsTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { interactions } = data;

  if (!interactions || !interactions.interactions || interactions.interactions.length === 0) {
    return (
      <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Interaction Network
        </p>
        <p className="text-text-muted text-sm font-body">No interaction data available for this gene</p>
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
          <div className="h-[500px] rounded skeleton-shimmer" />
        </div>
      }>
        <InteractionNetwork
          interactions={interactions}
          geneSymbol={symbol}
          delay={0}
        />
      </Suspense>
    </motion.div>
  );
}
