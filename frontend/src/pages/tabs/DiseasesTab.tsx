import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import DiseaseAssociations from '../../components/gene/DiseaseAssociations';
import GlassCard from '../../components/ui/GlassCard';
import GlowBadge from '../../components/ui/GlowBadge';

export default function DiseasesTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const { variants } = data;
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);

  const diseases = variants?.diseases || [];

  if (diseases.length === 0) {
    return (
      <div className="rounded-2xl border border-ocean-100 p-6 bg-ocean-50 text-center">
        <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
          Disease Associations
        </p>
        <p className="text-text-muted text-sm font-body">No disease associations found for this gene</p>
      </div>
    );
  }

  // Find variants for selected disease using the disease's associated_variants list
  const selectedDiseaseData = selectedDisease
    ? diseases.find(d => d.disease_name === selectedDisease)
    : null;
  const associatedIds = new Set(selectedDiseaseData?.associated_variants || []);
  const selectedDiseaseVariants = selectedDisease
    ? (variants?.variants.filter(v => associatedIds.has(v.variant_id)) || [])
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Disease List (40%) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-2"
      >
        <DiseaseAssociations
          diseases={diseases}
          geneSymbol={symbol}
          onDiseaseClick={(name) => setSelectedDisease(name)}
          delay={0}
        />
      </motion.div>

      {/* Variant Breakdown for selected disease (60%) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="lg:col-span-3"
      >
        <GlassCard>
          <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-4">
            {selectedDisease ? (
              <>Variants for: <span className="text-text-heading normal-case">{selectedDisease}</span></>
            ) : (
              'Select a disease to view its variants'
            )}
          </p>

          {selectedDisease && selectedDiseaseVariants.length > 0 ? (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {selectedDiseaseVariants.map((v) => (
                <div
                  key={v.variant_id}
                  className="rounded-lg bg-ocean-50 border border-ocean-100 p-3"
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
                    {v.variant_type} &middot; {v.review_status}
                  </p>
                </div>
              ))}
            </div>
          ) : selectedDisease ? (
            <p className="text-text-muted text-sm font-body">No specific variants linked to this condition</p>
          ) : (
            <p className="text-text-muted text-sm font-body">
              Click on a disease from the left panel to see its associated variants
            </p>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
