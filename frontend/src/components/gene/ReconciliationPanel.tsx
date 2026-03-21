import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle, ExternalLink, ChevronDown, Shield } from 'lucide-react';
import type { ReconciliationData, ReconciliationConflict } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';
import CountUp from '../ui/CountUp';

interface ReconciliationPanelProps {
  reconciliation: ReconciliationData;
  delay?: number;
  onVariantClick?: (variantId: string) => void;
}

const SEVERITY_COLORS = {
  HIGH: '#D64045',
  MEDIUM: '#D4A843',
  LOW: '#64748b',
} as const;

const CONFLICT_TYPE_LABELS: Record<string, string> = {
  pathogenic_but_common: 'Pathogenic but Common',
  benign_but_absent: 'Benign but Absent',
  vus_high_frequency: 'VUS with High Frequency',
  population_stratification: 'Population Stratification',
  conflicting_submissions: 'Conflicting Submissions',
  classification_age: 'Classification Age',
};

function getScoreColor(score: number): string {
  if (score >= 90) return '#2B9F78';
  if (score >= 70) return '#1B4965';
  if (score >= 50) return '#D4A843';
  return '#D64045';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent Concordance';
  if (score >= 70) return 'Good Concordance';
  if (score >= 50) return 'Moderate Conflicts';
  return 'Significant Discrepancies';
}

function getSeverityBadgeColor(severity: string): 'magenta' | 'amber' | 'muted' {
  if (severity === 'HIGH') return 'magenta';
  if (severity === 'MEDIUM') return 'amber';
  return 'muted';
}

function getConflictTypeBadgeColor(type: string): 'magenta' | 'amber' | 'cyan' | 'muted' {
  if (type === 'pathogenic_but_common') return 'magenta';
  if (type === 'vus_high_frequency' || type === 'population_stratification') return 'amber';
  if (type === 'conflicting_submissions') return 'cyan';
  return 'muted';
}

// Circular score indicator component
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const color = getScoreColor(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.15)"
          strokeWidth={8}
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ color }}>
          <CountUp
            end={score}
            decimals={0}
            className="text-3xl font-mono font-bold"
          />
        </span>
        <span className="text-text-muted text-[10px] font-body mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// Venn diagram SVG
function VennDiagram({
  clinvarOnly,
  gnomadOnly,
  both,
}: {
  clinvarOnly: number;
  gnomadOnly: number;
  both: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <svg width={280} height={180} viewBox="0 0 280 180">
        {/* ClinVar circle */}
        <circle cx={105} cy={90} r={70} fill="rgba(27, 73, 101, 0.1)" stroke="#1B4965" strokeWidth={1.5} />
        {/* gnomAD circle */}
        <circle cx={175} cy={90} r={70} fill="rgba(214, 64, 69, 0.1)" stroke="#D64045" strokeWidth={1.5} />

        {/* Labels */}
        <text x={65} y={90} textAnchor="middle" className="fill-primary text-lg font-mono font-bold">
          {clinvarOnly}
        </text>
        <text x={65} y={108} textAnchor="middle" className="fill-text-muted text-[10px] font-body">
          ClinVar only
        </text>

        <text x={140} y={85} textAnchor="middle" className="text-lg font-mono font-bold" style={{ fill: '#7c3aed' }}>
          {both}
        </text>
        <text x={140} y={103} textAnchor="middle" className="fill-text-muted text-[10px] font-body">
          Both
        </text>

        <text x={215} y={90} textAnchor="middle" className="fill-danger text-lg font-mono font-bold">
          {gnomadOnly}
        </text>
        <text x={215} y={108} textAnchor="middle" className="fill-text-muted text-[10px] font-body">
          gnomAD only
        </text>
      </svg>
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="text-text-muted text-[10px] font-body">ClinVar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#7c3aed' }} />
          <span className="text-text-muted text-[10px] font-body">Both</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-danger" />
          <span className="text-text-muted text-[10px] font-body">gnomAD</span>
        </div>
      </div>
    </div>
  );
}

// Individual conflict card
function ConflictCard({
  conflict,
  index,
  onVariantClick,
}: {
  conflict: ReconciliationConflict;
  index: number;
  onVariantClick?: (variantId: string) => void;
}) {
  const severityColor = SEVERITY_COLORS[conflict.severity] || SEVERITY_COLORS.LOW;
  const popEntries = Object.entries(conflict.gnomad_population_afs).filter(([, af]) => af > 0);
  const maxPopAf = popEntries.length > 0 ? Math.max(...popEntries.map(([, af]) => af)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl bg-white border border-ocean-100 overflow-hidden hover:border-ocean-200 transition-colors"
      style={{ borderLeftWidth: 3, borderLeftColor: severityColor }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono text-primary text-sm cursor-pointer hover:underline"
              onClick={() => onVariantClick?.(conflict.variant_id)}
            >
              {conflict.variant_id}
            </span>
            <GlowBadge color={getConflictTypeBadgeColor(conflict.conflict_type)} className="text-[10px]">
              {CONFLICT_TYPE_LABELS[conflict.conflict_type] || conflict.conflict_type}
            </GlowBadge>
          </div>
          <GlowBadge color={getSeverityBadgeColor(conflict.severity)} className="text-[10px] shrink-0">
            {conflict.severity}
          </GlowBadge>
        </div>

        {/* Explanation */}
        <p className="text-text-secondary text-xs font-body leading-relaxed mb-3">
          {conflict.explanation}
        </p>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* ClinVar side */}
          <div className="rounded-lg bg-ocean-50 p-3">
            <p className="text-primary text-[10px] font-body font-semibold uppercase tracking-wider mb-2">ClinVar</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Significance</span>
                <span className="text-text-heading text-xs font-mono">{conflict.clinvar_significance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Review Status</span>
                <span className="text-text-heading text-xs font-mono truncate ml-2">{conflict.clinvar_review_status || '\u2014'}</span>
              </div>
              {conflict.clinvar_last_evaluated && (
                <div className="flex justify-between">
                  <span className="text-text-muted text-xs">Last Evaluated</span>
                  <span className="text-text-heading text-xs font-mono">{conflict.clinvar_last_evaluated.slice(0, 10)}</span>
                </div>
              )}
            </div>
          </div>

          {/* gnomAD side */}
          <div className="rounded-lg bg-ocean-50 p-3">
            <p className="text-danger text-[10px] font-body font-semibold uppercase tracking-wider mb-2">gnomAD</p>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted text-xs">Allele Freq</span>
                <span className="text-text-heading text-xs font-mono">
                  {conflict.gnomad_af > 0 ? conflict.gnomad_af.toExponential(2) : '\u2014'}
                </span>
              </div>
              {/* Mini population bars */}
              {popEntries.length > 0 && (
                <div className="mt-2 space-y-1">
                  {popEntries.slice(0, 5).map(([pop, af]) => (
                    <div key={pop} className="flex items-center gap-2">
                      <span className="text-text-muted text-[10px] font-mono w-8 uppercase">{pop}</span>
                      <div className="flex-1 h-1.5 bg-ocean-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-danger/60"
                          initial={{ width: 0 }}
                          animate={{ width: `${maxPopAf > 0 ? (af / maxPopAf) * 100 : 0}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                      <span className="text-text-muted text-[10px] font-mono w-16 text-right">{af.toExponential(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg bg-warning-light border border-warning/10 p-2.5 mb-3">
          <p className="text-warning/80 text-[11px] font-body">
            <span className="font-semibold">Recommendation:</span> {conflict.recommendation}
          </p>
        </div>

        {/* External links */}
        <div className="flex items-center gap-3">
          {conflict.external_links.clinvar && (
            <a
              href={conflict.external_links.clinvar}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary/60 hover:text-primary text-[10px] font-body transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> ClinVar
            </a>
          )}
          {conflict.external_links.gnomad && (
            <a
              href={conflict.external_links.gnomad}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-danger/60 hover:text-danger text-[10px] font-body transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> gnomAD
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Recharts custom tooltip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-ocean-100 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-text-heading text-xs font-body">{data.name}</p>
      <p className="text-primary text-sm font-mono font-bold">{data.count}</p>
    </div>
  );
}

export default function ReconciliationPanel({ reconciliation, delay = 0, onVariantClick }: ReconciliationPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const summary = reconciliation.summary || { total_variants_reconciled: 0, conflicts_found: 0, by_severity: {}, by_type: {}, reconciliation_score: 100, variants_in_both_databases: 0, variants_clinvar_only: 0, variants_gnomad_only: 0 };
  const conflicts = reconciliation.conflicts || [];
  const score = summary.reconciliation_score ?? 100;
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  // Filter conflicts
  const visibleConflicts = useMemo(() => {
    let filtered = conflicts;
    if (severityFilter) {
      filtered = filtered.filter(c => c.severity === severityFilter);
    }
    if (!showAll) {
      return filtered.slice(0, 5);
    }
    return filtered;
  }, [conflicts, severityFilter, showAll]);

  // Conflict type distribution chart data
  const typeChartData = useMemo(() => {
    return Object.entries(summary.by_type).map(([type, count]) => ({
      name: CONFLICT_TYPE_LABELS[type] || type,
      count,
      type,
    }));
  }, [summary.by_type]);

  const TYPE_COLORS: Record<string, string> = {
    pathogenic_but_common: '#D64045',
    vus_high_frequency: '#D4A843',
    population_stratification: '#1B4965',
    conflicting_submissions: '#7c3aed',
    classification_age: '#64748b',
    benign_but_absent: '#94a3b8',
  };

  // No conflicts state
  if (summary.conflicts_found === 0) {
    return (
      <GlassCard delay={delay}>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-success" />
            <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
              Database Reconciliation
            </h2>
          </div>
          <p className="text-text-muted text-xs font-body mt-1">
            Cross-referencing ClinVar classifications with gnomAD population data
          </p>
        </div>

        <div className="flex flex-col items-center py-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          >
            <CheckCircle className="w-16 h-16 text-success mb-4" />
          </motion.div>
          <p className="text-success font-heading font-semibold text-lg mb-1">All Clear</p>
          <p className="text-text-secondary text-sm font-body text-center">
            All variants show consistent data across databases
          </p>
        </div>

        {/* Still show Venn */}
        <VennDiagram
          clinvarOnly={summary.variants_clinvar_only}
          gnomadOnly={summary.variants_gnomad_only}
          both={summary.variants_in_both_databases}
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={delay}>
      {/* Title */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
            Database Reconciliation
          </h2>
        </div>
        <p className="text-text-muted text-xs font-body mt-1">
          Cross-referencing ClinVar classifications with gnomAD population data
        </p>
      </div>

      {/* Score + Venn row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Score Card */}
        <div className="flex flex-col items-center">
          <ScoreRing score={score} />
          <p className="font-heading font-semibold text-sm mt-3" style={{ color: scoreColor }}>
            {scoreLabel}
          </p>
          <p className="text-text-muted text-xs font-body mt-1 text-center">
            {summary.conflicts_found} conflict{summary.conflicts_found !== 1 ? 's' : ''} across{' '}
            {summary.total_variants_reconciled} variants
          </p>
        </div>

        {/* Severity Summary Bar */}
        <div className="flex flex-col justify-center">
          <p className="text-text-muted text-[10px] font-body uppercase tracking-wider mb-2">Conflicts by Severity</p>
          {/* Stacked bar */}
          <div className="h-6 rounded-full overflow-hidden flex bg-ocean-100">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
              const count = summary.by_severity[sev] || 0;
              if (count === 0) return null;
              const pct = (count / summary.conflicts_found) * 100;
              return (
                <motion.div
                  key={sev}
                  className="h-full flex items-center justify-center cursor-pointer hover:brightness-110 transition-all"
                  style={{ backgroundColor: SEVERITY_COLORS[sev], width: `${pct}%` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                  title={`${sev}: ${count}`}
                >
                  {pct > 15 && (
                    <span className="text-[10px] font-mono font-bold text-white">{count}</span>
                  )}
                </motion.div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {(['HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
              const count = summary.by_severity[sev] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                  className={`flex items-center gap-1 text-[10px] font-body cursor-pointer transition-opacity ${
                    severityFilter && severityFilter !== sev ? 'opacity-40' : ''
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[sev] }} />
                  <span className="text-text-muted">{sev} ({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Venn Diagram */}
        <VennDiagram
          clinvarOnly={summary.variants_clinvar_only}
          gnomadOnly={summary.variants_gnomad_only}
          both={summary.variants_in_both_databases}
        />
      </div>

      {/* Conflict Type Distribution */}
      {typeChartData.length > 0 && (
        <div className="mb-6">
          <p className="text-text-muted text-[10px] font-body uppercase tracking-wider mb-3">Conflict Type Distribution</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeChartData} layout="vertical" margin={{ left: 120, right: 20, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {typeChartData.map((entry) => (
                    <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Conflict Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-text-muted text-[10px] font-body uppercase tracking-wider">
            {severityFilter ? `${severityFilter} Severity Conflicts` : 'All Conflicts'}
          </p>
          {severityFilter && (
            <button
              onClick={() => setSeverityFilter(null)}
              className="text-primary text-[10px] font-body hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {visibleConflicts.map((conflict, i) => (
            <ConflictCard
              key={`${conflict.variant_id}-${conflict.conflict_type}`}
              conflict={conflict}
              index={i}
              onVariantClick={onVariantClick}
            />
          ))}
        </AnimatePresence>

        {/* Show more/less */}
        {(severityFilter ? conflicts.filter(c => c.severity === severityFilter) : conflicts).length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 mx-auto text-primary text-xs font-body hover:underline cursor-pointer mt-2"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            {showAll
              ? 'Show fewer'
              : `Show all ${(severityFilter ? conflicts.filter(c => c.severity === severityFilter) : conflicts).length} conflicts`}
          </button>
        )}
      </div>
    </GlassCard>
  );
}
