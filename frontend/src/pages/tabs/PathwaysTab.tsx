import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import BiologicalPathways from '../../components/gene/BiologicalPathways';

export default function PathwaysTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { pathways } = data;

  if (!pathways || pathways.pathways.length === 0) {
    return (
      <div className="rounded-2xl border border-space-600/20 p-6 bg-space-800/20 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Biological Pathways
        </p>
        <p className="text-text-muted text-sm font-body">
          No pathway information available for {symbol}. Pathway data is sourced from Reactome and KEGG.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <BiologicalPathways
        pathways={pathways}
        geneSymbol={symbol}
        delay={0}
      />
    </motion.div>
  );
}
