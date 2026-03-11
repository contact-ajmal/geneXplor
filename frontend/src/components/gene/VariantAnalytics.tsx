import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import type { ClinVarVariant, GnomADVariant } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import CountUp from '../ui/CountUp';

interface VariantAnalyticsProps {
  clinvarVariants: ClinVarVariant[];
  gnomadVariants: GnomADVariant[];
  delay?: number;
  onSignificanceClick?: (sig: string) => void;
}

// ── Color mapping ──
const SIG_COLORS: Record<string, string> = {
  'Pathogenic': '#ff3366',
  'Likely pathogenic': '#ffaa00',
  'Uncertain significance': '#94a3b8',
  'Likely benign': '#00d4ff',
  'Benign': '#00ff88',
  'Other': '#64748b',
};

function normalizeSig(sig: string): string {
  const lower = sig.toLowerCase();
  if (lower.includes('pathogenic') && !lower.includes('likely')) return 'Pathogenic';
  if (lower.includes('likely pathogenic') || lower.includes('likely_pathogenic')) return 'Likely pathogenic';
  if (lower.includes('benign') && !lower.includes('likely')) return 'Benign';
  if (lower.includes('likely benign') || lower.includes('likely_benign')) return 'Likely benign';
  if (lower.includes('uncertain') || lower.includes('vus')) return 'Uncertain significance';
  return 'Other';
}

function formatConsequence(consequence: string): string {
  return consequence
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Glass Tooltip ──
function GlassTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg bg-[rgba(20,27,45,0.9)] backdrop-blur-xl border border-cyan/20 shadow-lg">
      {label && <p className="text-text-secondary text-xs font-body mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="text-text-primary text-xs font-mono" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function VariantAnalytics({ clinvarVariants, gnomadVariants, delay = 0, onSignificanceClick }: VariantAnalyticsProps) {
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);

  // ── Donut data: ClinVar significance distribution ──
  const donutData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of clinvarVariants) {
      const sig = normalizeSig(v.clinical_significance);
      counts[sig] = (counts[sig] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: SIG_COLORS[name] || '#64748b' }))
      .sort((a, b) => b.value - a.value);
  }, [clinvarVariants]);

  // ── Allele frequency histogram ──
  const afHistogramData = useMemo(() => {
    const bins = [
      { label: '<0.0001', min: 0, max: 0.0001 },
      { label: '0.0001-0.001', min: 0.0001, max: 0.001 },
      { label: '0.001-0.01', min: 0.001, max: 0.01 },
      { label: '0.01-0.1', min: 0.01, max: 0.1 },
      { label: '>0.1', min: 0.1, max: 1 },
    ];
    return bins.map(bin => {
      const count = gnomadVariants.filter(v =>
        v.allele_frequency > bin.min && v.allele_frequency <= bin.max
      ).length;
      return { name: bin.label, count };
    });
  }, [gnomadVariants]);

  // ── Consequence type bar chart: horizontal bars stacked by significance ──
  const consequenceData = useMemo(() => {
    const consequenceMap: Record<string, Record<string, number>> = {};

    // Build consequence -> significance counts from gnomAD variants cross-referenced with ClinVar
    const clinvarMap = new Map<string, string>();
    for (const cv of clinvarVariants) {
      clinvarMap.set(cv.variant_id, normalizeSig(cv.clinical_significance));
    }

    for (const gv of gnomadVariants) {
      const consequence = formatConsequence(gv.consequence || 'Unknown');
      if (!consequenceMap[consequence]) consequenceMap[consequence] = {};
      const sig = clinvarMap.get(gv.variant_id) || 'Other';
      consequenceMap[consequence][sig] = (consequenceMap[consequence][sig] || 0) + 1;
    }

    // If no gnomAD variants, use ClinVar variant types
    if (gnomadVariants.length === 0) {
      for (const cv of clinvarVariants) {
        const consequence = formatConsequence(cv.variant_type || 'Unknown');
        if (!consequenceMap[consequence]) consequenceMap[consequence] = {};
        const sig = normalizeSig(cv.clinical_significance);
        consequenceMap[consequence][sig] = (consequenceMap[consequence][sig] || 0) + 1;
      }
    }

    return Object.entries(consequenceMap)
      .map(([name, sigs]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '...' : name,
        fullName: name,
        ...sigs,
        total: Object.values(sigs).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [clinvarVariants, gnomadVariants]);

  const sigKeys = Object.keys(SIG_COLORS);
  const totalVariants = clinvarVariants.length;

  return (
    <GlassCard delay={delay}>
      <div className="mb-5">
        <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
          Variant Analytics
        </h2>
        <p className="text-text-muted text-xs font-body mt-1">
          Distribution analysis of {totalVariants.toLocaleString()} variants
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Donut Chart: Clinical Significance Distribution ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.1 }}
          className="flex flex-col items-center"
        >
          <h3 className="text-xs font-heading font-semibold text-text-secondary uppercase tracking-wider mb-3 self-start">
            Clinical Significance
          </h3>
          <div className="relative w-full" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, i) => setActiveDonutIndex(i)}
                  onMouseLeave={() => setActiveDonutIndex(null)}
                  onClick={(_, i) => {
                    const sig = donutData[i]?.name;
                    if (sig && onSignificanceClick) onSignificanceClick(sig);
                  }}
                  style={{ cursor: onSignificanceClick ? 'pointer' : 'default' }}
                >
                  {donutData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      opacity={activeDonutIndex === null || activeDonutIndex === i ? 1 : 0.3}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <RechartsTooltip content={<GlassTooltipContent />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="block text-2xl font-heading font-bold text-text-primary">
                  <CountUp end={totalVariants} formatter={n => Math.round(n).toLocaleString()} />
                </span>
                <span className="text-text-muted text-[10px] font-body">total</span>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {donutData.map(entry => (
              <button
                key={entry.name}
                onClick={() => onSignificanceClick?.(entry.name)}
                className="flex items-center gap-1.5 text-[10px] font-body text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name} ({entry.value})
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Allele Frequency Spectrum ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.15 }}
        >
          <h3 className="text-xs font-heading font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Allele Frequency Spectrum
          </h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={afHistogramData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
                  tickLine={false}
                  angle={-20}
                  textAnchor="end"
                  height={45}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
                  tickLine={false}
                />
                <RechartsTooltip content={<GlassTooltipContent />} />
                <Bar dataKey="count" name="Variants" fill="#00d4ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-text-muted text-[10px] font-body mt-1 text-center">
            gnomAD allele frequency bins
          </p>
        </motion.div>

        {/* ── Consequence Type Stacked Bar Chart ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.2 }}
        >
          <h3 className="text-xs font-heading font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Consequence Types
          </h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={consequenceData}
                layout="vertical"
                margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
                  tickLine={false}
                />
                <RechartsTooltip content={<GlassTooltipContent />} />
                {sigKeys.map(sig => (
                  <Bar
                    key={sig}
                    dataKey={sig}
                    stackId="consequence"
                    fill={SIG_COLORS[sig]}
                    name={sig}
                    radius={0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-text-muted text-[10px] font-body mt-1 text-center">
            Stacked by clinical significance
          </p>
        </motion.div>
      </div>
    </GlassCard>
  );
}
