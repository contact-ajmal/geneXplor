import { Suspense, lazy, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import GlowBadge from '../../components/ui/GlowBadge';

const VariantImpactSimulator = lazy(() => import('../../components/viz/VariantImpactSimulator'));

export default function SimulatorTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { variants, allele_frequencies, protein } = data;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const clinvarVariants = variants?.variants || [];

  if (clinvarVariants.length === 0) {
    return (
      <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Impact Simulator
        </p>
        <p className="text-text-muted text-sm font-body">No variants available for simulation</p>
      </div>
    );
  }

  if (!selectedVariantId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
              Select a variant to simulate
            </h2>
          </div>
          <p className="text-text-muted text-xs font-body mb-4">
            Choose a variant below to visualize its impact through the DNA → RNA → Protein → Function pipeline
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[500px] overflow-y-auto">
            {clinvarVariants.slice(0, 30).map((v) => (
              <button
                key={v.variant_id}
                onClick={() => setSelectedVariantId(v.variant_id)}
                className="text-left rounded-lg bg-ocean-50 border border-ocean-100
                  hover:border-ocean-200 hover:bg-ocean-50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-primary/70">
                    ID: {v.variant_id}
                  </span>
                  <GlowBadge
                    color={
                      v.clinical_significance.toLowerCase().includes('pathogenic') ? 'magenta'
                      : v.clinical_significance.toLowerCase().includes('benign') ? 'green'
                      : 'amber'
                    }
                  >
                    {v.clinical_significance}
                  </GlowBadge>
                </div>
                <p className="text-xs font-mono text-text-heading truncate" title={v.title}>
                  {v.title}
                </p>
                <p className="text-[10px] font-body text-text-muted mt-0.5">
                  {v.variant_type} &middot; {v.condition}
                </p>
              </button>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mb-4">
        <button
          onClick={() => setSelectedVariantId(null)}
          className="text-xs font-body text-text-muted hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
        >
          ← Choose different variant
        </button>
      </div>
      <Suspense fallback={
        <div className="rounded-2xl border border-ocean-100 p-5 bg-white">
          <div className="h-5 w-56 rounded skeleton-shimmer mb-4" />
          <div className="h-[400px] rounded skeleton-shimmer" />
        </div>
      }>
        <VariantImpactSimulator
          variantId={selectedVariantId}
          clinvarVariants={clinvarVariants}
          gnomadVariants={allele_frequencies?.variants || []}
          protein={protein}
          diseases={variants?.diseases}
        />
      </Suspense>
    </motion.div>
  );
}
