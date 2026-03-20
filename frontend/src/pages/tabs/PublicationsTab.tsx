import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import ResearchPublications from '../../components/gene/ResearchPublications';
import ResearchPulseCard from '../../components/gene/ResearchPulseCard';

export default function PublicationsTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { publications } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Research Pulse (40%) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-2"
      >
        <ResearchPulseCard geneSymbol={symbol} delay={0} />
      </motion.div>

      {/* Publication List (60%) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="lg:col-span-3"
      >
        {publications && publications.articles.length > 0 ? (
          <ResearchPublications
            articles={publications.articles}
            totalResults={publications.total_results}
            delay={0}
          />
        ) : (
          <div className="rounded-2xl border border-space-600/20 p-6 bg-space-800/20 text-center">
            <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
              Recent Publications
            </p>
            <p className="text-text-muted text-sm font-body">No publications found for this gene</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
