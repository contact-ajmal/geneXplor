import { Suspense, lazy, useCallback, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import ProteinInfoCard from '../../components/gene/ProteinInfoCard';
import ProteinVariantMap from '../../components/gene/ProteinVariantMap';
import VariantDetailModal from '../../components/gene/VariantDetailModal';

const ProteinStructureViewer = lazy(() => import('../../components/viz/ProteinStructureViewer'));

export default function ProteinTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { protein, structure, variants, allele_frequencies } = data;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const handleVariantClick = useCallback((variantId: string) => {
    setSelectedVariantId(variantId);
  }, []);

  return (
    <div className="space-y-4">
      {/* Two-panel: 3D viewer + Protein info */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 3D Structure (60%) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3"
        >
          {structure ? (
            <Suspense fallback={
              <div className="rounded-2xl border border-ocean-100 p-5 bg-white">
                <div className="h-5 w-48 rounded skeleton-shimmer mb-4" />
                <div className="h-[350px] md:h-[450px] lg:h-[600px] rounded skeleton-shimmer" />
              </div>
            }>
              <ProteinStructureViewer
                structure={structure}
                geneSymbol={symbol}
                onVariantClick={handleVariantClick}
                delay={0}
              />
            </Suspense>
          ) : (
            <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center h-full flex items-center justify-center">
              <div>
                <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
                  3D Structure
                </p>
                <p className="text-text-muted text-sm font-body">No AlphaFold structure available</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Protein Details (40%) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-2"
        >
          {protein ? (
            <ProteinInfoCard protein={protein} delay={0} />
          ) : (
            <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center">
              <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
                Protein Information
              </p>
              <p className="text-text-muted text-sm font-body">No protein data available</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Full-width domain bar */}
      {protein && (variants || allele_frequencies) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ProteinVariantMap
            protein={protein}
            clinvarVariants={variants?.variants || []}
            gnomadVariants={allele_frequencies?.variants || []}
            delay={0}
            onVariantClick={handleVariantClick}
          />
        </motion.div>
      )}

      {/* Variant Detail Modal */}
      <VariantDetailModal
        variantId={selectedVariantId}
        clinvarVariants={variants?.variants || []}
        gnomadVariants={allele_frequencies?.variants || []}
        protein={protein}
        diseases={variants?.diseases || []}
        initialTab="details"
        onClose={() => setSelectedVariantId(null)}
      />
    </div>
  );
}
