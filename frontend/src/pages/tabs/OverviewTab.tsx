import { useOutletContext, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Microscope, Target, BookOpen, Route, AlertTriangle, Network,
  ArrowRight, TrendingUp,
} from 'lucide-react';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import GlowBadge from '../../components/ui/GlowBadge';
import CountUp from '../../components/ui/CountUp';
import GeneOverviewCard from '../../components/gene/GeneOverviewCard';
import ProteinInfoCard from '../../components/gene/ProteinInfoCard';
import { Sparkline } from '../../components/gene/ResearchPulseCard';

export default function OverviewTab() {
  const { data, symbol } = useOutletContext<DashboardOutletContext>();
  const navigate = useNavigate();
  const { gene, protein, variants, publications, pathways, interactions, reconciliation } = data;

  const variantCount = variants?.variants.length || 0;
  const diseaseCount = variants?.diseases.length || 0;
  const pubCount = publications?.total_results || 0;
  const pathwayCount = pathways?.pathways.length || 0;
  const interactionCount = interactions?.interactions?.length || 0;
  const conflictCount = reconciliation?.summary?.conflicts_found || 0;

  // Variant significance breakdown
  const sigBreakdown = variants?.variants.reduce((acc, v) => {
    const sig = v.clinical_significance.toLowerCase();
    if (sig.includes('pathogenic') && !sig.includes('likely')) acc.pathogenic++;
    else if (sig.includes('likely pathogenic')) acc.likelyPath++;
    else if (sig.includes('benign') && !sig.includes('likely')) acc.benign++;
    else if (sig.includes('likely benign')) acc.likelyBenign++;
    else acc.vus++;
    return acc;
  }, { pathogenic: 0, likelyPath: 0, benign: 0, likelyBenign: 0, vus: 0 });

  return (
    <div className="space-y-4">
      {/* Top row: Gene Overview + Protein Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <GeneOverviewCard gene={gene} delay={0} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {protein ? (
            <ProteinInfoCard protein={protein} delay={0} />
          ) : (
            <GlassCard>
              <p className="text-sm font-heading font-semibold text-text-muted uppercase tracking-wider mb-2">
                Protein Information
              </p>
              <p className="text-text-muted text-sm font-body">No protein data available</p>
            </GlassCard>
          )}
        </motion.div>
      </div>

      {/* Summary cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Variants Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard hover className="h-full">
            <div className="flex items-center gap-2 mb-3">
              <Microscope className="w-4 h-4 text-primary" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Variants
              </span>
            </div>
            <p className="text-3xl font-mono font-bold text-text-heading mb-2">
              <CountUp end={variantCount} duration={800} />
            </p>
            {sigBreakdown && variantCount > 0 && (
              <div className="space-y-1 mb-3">
                {sigBreakdown.pathogenic > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-danger" />
                    <span className="text-text-muted font-body">Pathogenic: {sigBreakdown.pathogenic}</span>
                  </div>
                )}
                {sigBreakdown.vus > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-text-muted font-body">VUS: {sigBreakdown.vus}</span>
                  </div>
                )}
                {sigBreakdown.benign > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-text-muted font-body">Benign: {sigBreakdown.benign}</span>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => navigate(`/gene/${symbol}/variants`)}
              className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary transition-colors cursor-pointer bg-transparent border-none mt-auto"
            >
              Explore Variants <ArrowRight className="w-3 h-3" />
            </button>
          </GlassCard>
        </motion.div>

        {/* Diseases Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <GlassCard hover className="h-full">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-danger" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Diseases
              </span>
            </div>
            <p className="text-3xl font-mono font-bold text-text-heading mb-2">
              <CountUp end={diseaseCount} duration={800} />
            </p>
            {variants?.diseases && variants.diseases.length > 0 && (
              <div className="space-y-1 mb-3">
                {variants.diseases.slice(0, 3).map(d => (
                  <p key={d.disease_name} className="text-[11px] font-body text-text-muted truncate">
                    {d.disease_name}
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={() => navigate(`/gene/${symbol}/diseases`)}
              className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary transition-colors cursor-pointer bg-transparent border-none mt-auto"
            >
              View All Diseases <ArrowRight className="w-3 h-3" />
            </button>
          </GlassCard>
        </motion.div>

        {/* Research Pulse */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard hover className="h-full">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-success" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Research
              </span>
            </div>
            <p className="text-3xl font-mono font-bold text-text-heading mb-2">
              <CountUp end={pubCount} duration={800} />
            </p>
            <p className="text-[11px] font-body text-text-muted mb-3">publications found</p>
            <button
              onClick={() => navigate(`/gene/${symbol}/publications`)}
              className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary transition-colors cursor-pointer bg-transparent border-none mt-auto"
            >
              View Publications <ArrowRight className="w-3 h-3" />
            </button>
          </GlassCard>
        </motion.div>

        {/* Pathways Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <GlassCard hover className="h-full">
            <div className="flex items-center gap-2 mb-3">
              <Route className="w-4 h-4 text-warning" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Pathways
              </span>
            </div>
            <p className="text-3xl font-mono font-bold text-text-heading mb-2">
              <CountUp end={pathwayCount} duration={800} />
            </p>
            {pathways?.pathways && pathways.pathways.length > 0 && (
              <div className="space-y-1 mb-3">
                {pathways.pathways.slice(0, 2).map(p => (
                  <p key={p.pathway_id} className="text-[11px] font-body text-text-muted truncate">
                    {p.name}
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={() => navigate(`/gene/${symbol}/pathways`)}
              className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary transition-colors cursor-pointer bg-transparent border-none mt-auto"
            >
              View Pathways <ArrowRight className="w-3 h-3" />
            </button>
          </GlassCard>
        </motion.div>
      </div>

      {/* Bottom row: Reconciliation + Interactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard hover className="h-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Reconciliation Score
              </span>
            </div>
            {reconciliation?.summary ? (
              <>
                <div className="flex items-center gap-4 mb-2">
                  {/* Mini score ring */}
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(100,116,139,0.2)"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={reconciliation.summary.concordance_score >= 0.8 ? '#2B9F78' : reconciliation.summary.concordance_score >= 0.5 ? '#D4A843' : '#D64045'}
                        strokeWidth="3"
                        strokeDasharray={`${reconciliation.summary.concordance_score * 100}, 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-mono font-bold text-text-heading">
                      {Math.round(reconciliation.summary.concordance_score * 100)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-mono text-text-heading">
                      {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] font-body text-text-muted">
                      between ClinVar & gnomAD
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/gene/${symbol}/reconciliation`)}
                  className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
                >
                  View Details <ArrowRight className="w-3 h-3" />
                </button>
              </>
            ) : (
              <p className="text-text-muted text-sm font-body">No reconciliation data</p>
            )}
          </GlassCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <GlassCard hover className="h-full">
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-4 h-4 text-primary" />
              <span className="text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                Interactions
              </span>
            </div>
            <p className="text-3xl font-mono font-bold text-text-heading mb-2">
              <CountUp end={interactionCount} duration={800} />
            </p>
            <p className="text-[11px] font-body text-text-muted mb-3">
              protein-protein interactions
            </p>
            <button
              onClick={() => navigate(`/gene/${symbol}/interactions`)}
              className="flex items-center gap-1 text-xs font-body text-primary hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
            >
              View Network <ArrowRight className="w-3 h-3" />
            </button>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}
