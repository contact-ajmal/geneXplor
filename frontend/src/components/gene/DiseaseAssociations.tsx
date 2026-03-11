import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { DiseaseAssociation } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';

interface DiseaseAssociationsProps {
  diseases: DiseaseAssociation[];
  geneSymbol: string;
  onDiseaseClick?: (diseaseName: string) => void;
  delay?: number;
}

export default function DiseaseAssociations({ diseases, geneSymbol, onDiseaseClick, delay = 0 }: DiseaseAssociationsProps) {
  const [showAll, setShowAll] = useState(false);
  const displayCount = 10;
  const visibleDiseases = showAll ? diseases : diseases.slice(0, displayCount);
  const hasMore = diseases.length > displayCount;

  return (
    <GlassCard delay={delay}>
      <div className="mb-4">
        <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
          Associated Conditions
        </h2>
        <p className="text-text-muted text-xs font-body mt-1">
          Clinical conditions linked to {geneSymbol} variants in ClinVar
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {visibleDiseases.map((disease, i) => (
            <motion.div
              key={disease.disease_name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03 }}
            >
              <GlowBadge
                color="magenta"
                onClick={onDiseaseClick ? () => onDiseaseClick(disease.disease_name) : undefined}
                className="text-xs hover:scale-105 hover:-translate-y-0.5 transition-transform"
              >
                {disease.disease_name.length > 40
                  ? disease.disease_name.slice(0, 40) + '…'
                  : disease.disease_name}
                <span className="ml-1.5 opacity-60 font-mono text-[10px]">
                  ({disease.variant_count})
                </span>
              </GlowBadge>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 mt-4 text-text-muted hover:text-cyan text-xs font-body transition-colors cursor-pointer"
        >
          {showAll ? 'Show less' : `Show all ${diseases.length} conditions`}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </GlassCard>
  );
}
