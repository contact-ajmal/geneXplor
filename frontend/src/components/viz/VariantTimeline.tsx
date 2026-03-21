import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Clock,
  Award,
  Activity,
} from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';
import type { TimelineData, NotableVariant } from '../../lib/api';

interface VariantTimelineProps {
  timeline: TimelineData;
  geneSymbol: string;
  onVariantClick?: (variantId: string) => void;
  delay?: number;
}

const SIG_COLORS: Record<string, string> = {
  pathogenic: '#D64045',
  likely_pathogenic: '#E07A3A',
  vus: '#D4A843',
  likely_benign: '#5294C4',
  benign: '#2B9F78',
  other: '#7B8794',
};

const SIG_LABELS: Record<string, string> = {
  pathogenic: 'Pathogenic',
  likely_pathogenic: 'Likely Pathogenic',
  vus: 'VUS',
  likely_benign: 'Likely Benign',
  benign: 'Benign',
  other: 'Other',
};

type TimeRange = 'all' | '10y' | '5y' | '2y';

function formatMonth(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

function formatMonthShort(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  return `${months[parseInt(month, 10) - 1]}'${year.slice(2)}`;
}

export default function VariantTimeline({
  timeline,
  geneSymbol,
  onVariantClick,
  delay = 0,
}: VariantTimelineProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const filteredBuckets = useMemo(() => {
    if (timeRange === 'all') return timeline.buckets;

    const now = new Date();
    const years = timeRange === '10y' ? 10 : timeRange === '5y' ? 5 : 2;
    const cutoff = new Date(now.getFullYear() - years, now.getMonth(), 1);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;

    return timeline.buckets.filter((b) => b.date >= cutoffStr);
  }, [timeline.buckets, timeRange]);

  // Build chart data: flatten by_significance into separate fields
  const chartData = useMemo(() => {
    return filteredBuckets.map((b) => ({
      date: b.date,
      label: formatMonthShort(b.date),
      pathogenic: b.by_significance.pathogenic || 0,
      likely_pathogenic: b.by_significance.likely_pathogenic || 0,
      vus: b.by_significance.vus || 0,
      likely_benign: b.by_significance.likely_benign || 0,
      benign: b.by_significance.benign || 0,
      other: b.by_significance.other || 0,
      total_new: b.total_new_variants,
      cumulative: b.cumulative_variants,
    }));
  }, [filteredBuckets]);

  // Collect all notable variants for bottom row
  const notableVariants = useMemo(() => {
    const all: (NotableVariant & { date: string })[] = [];
    for (const b of timeline.buckets) {
      for (const n of b.notable_variants) {
        all.push({ ...n, date: b.date });
      }
    }
    // Deduplicate by variant_id, keep first
    const seen = new Set<string>();
    return all.filter((v) => {
      if (seen.has(v.variant_id)) return false;
      seen.add(v.variant_id);
      return true;
    });
  }, [timeline.buckets]);

  // Find which significance keys actually appear
  const activeSigKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const b of filteredBuckets) {
      for (const [k, v] of Object.entries(b.by_significance)) {
        if (v > 0) keys.add(k);
      }
    }
    // Return in display order
    return ['pathogenic', 'likely_pathogenic', 'vus', 'likely_benign', 'benign', 'other'].filter(
      (k) => keys.has(k),
    );
  }, [filteredBuckets]);

  // Milestone reference lines
  const milestones = useMemo(() => {
    const m: { date: string; label: string }[] = [];
    m.push({ date: timeline.first_submission_date, label: 'First variant' });
    m.push({ date: timeline.peak_month, label: 'Peak month' });

    // Cumulative milestones
    const thresholds = [100, 500, 1000];
    for (const thresh of thresholds) {
      const bucket = timeline.buckets.find((b) => b.cumulative_variants >= thresh);
      if (bucket) {
        // Don't duplicate existing milestones
        if (!m.some((x) => x.date === bucket.date)) {
          m.push({ date: bucket.date, label: `${thresh} variants` });
        }
      }
    }
    return m;
  }, [timeline]);

  const handleVariantClick = useCallback(
    (variantId: string) => {
      onVariantClick?.(variantId);
    },
    [onVariantClick],
  );

  // Simplified view if too few data points
  if (filteredBuckets.length < 5) {
    return (
      <GlassCard delay={delay}>
        <h2 className="text-sm font-heading font-semibold text-text-heading mb-4 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Variant Discovery Timeline
        </h2>
        <div className="text-center py-6">
          <Clock className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-secondary text-sm font-body mb-2">
            Limited submission history available for{' '}
            <span className="font-mono text-primary">{geneSymbol}</span>
          </p>
          <p className="text-text-muted text-xs font-body">
            {timeline.total_submissions} variant{timeline.total_submissions !== 1 ? 's' : ''} submitted
            {timeline.date_range_start && ` since ${formatMonth(timeline.date_range_start)}`}
          </p>
        </div>
        <StatsRow timeline={timeline} />
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={delay}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Variant Discovery Timeline
          </h2>
          <p className="text-text-muted text-xs font-body mt-0.5">
            History of variant reporting in ClinVar for{' '}
            <span className="font-mono text-primary">{geneSymbol}</span>
          </p>
        </div>

        {/* Momentum badge */}
        <MomentumBadge trend={timeline.submission_rate_trend} recent={timeline.recent_12mo_count} />
      </div>

      {/* Time range controls */}
      <div className="flex items-center gap-1 mb-4 mt-2">
        {(['all', '10y', '5y', '2y'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1 rounded-lg text-xs font-body border transition-all ${
              timeRange === range
                ? 'bg-primary-light border-primary/30 text-primary'
                : 'bg-ocean-50 border-ocean-100 text-text-muted hover:border-ocean-100'
            }`}
          >
            {range === 'all' ? 'All Time' : `Last ${range.replace('y', 'yr')}`}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[320px] md:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9E2EC" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#7B8794', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#D9E2EC' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#7B8794', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'New variants',
                angle: -90,
                position: 'insideLeft',
                fill: '#7B8794',
                fontSize: 10,
                fontFamily: 'Plus Jakarta Sans',
                offset: 15,
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#1B4965', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'Cumulative',
                angle: 90,
                position: 'insideRight',
                fill: '#1B4965',
                fontSize: 10,
                fontFamily: 'Plus Jakarta Sans',
                offset: 15,
              }}
            />

            <Tooltip content={<GlassTooltip />} />

            {/* Milestone reference lines */}
            {milestones
              .filter((m) => chartData.some((d) => d.date === m.date))
              .map((m) => (
                <ReferenceLine
                  key={m.date}
                  x={formatMonthShort(m.date)}
                  yAxisId="left"
                  stroke="rgba(27,73,101,0.25)"
                  strokeDasharray="4 4"
                  label={{
                    value: m.label,
                    position: 'top',
                    fill: '#7B8794',
                    fontSize: 9,
                    fontFamily: 'Plus Jakarta Sans',
                  }}
                />
              ))}

            {/* Stacked bars by significance */}
            {activeSigKeys.map((key) => (
              <Bar
                key={key}
                yAxisId="left"
                dataKey={key}
                stackId="significance"
                fill={SIG_COLORS[key]}
                radius={key === activeSigKeys[activeSigKeys.length - 1] ? [2, 2, 0, 0] : undefined}
                animationBegin={200}
                animationDuration={800}
              />
            ))}

            {/* Cumulative line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative"
              stroke="#1B4965"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#1B4965', stroke: '#FFFFFF', strokeWidth: 2 }}
              animationBegin={600}
              animationDuration={1000}
            />

            {/* Brush for custom range */}
            {chartData.length > 20 && (
              <Brush
                dataKey="label"
                height={20}
                stroke="rgba(27,73,101,0.3)"
                fill="#F0F4F8"
                travellerWidth={8}
                tickFormatter={() => ''}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 mb-4 justify-center">
        {activeSigKeys.map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-text-secondary font-body">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block"
              style={{ backgroundColor: SIG_COLORS[key] }}
            />
            {SIG_LABELS[key]}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-body">
          <span className="w-4 h-[2px] bg-primary inline-block rounded" />
          Cumulative
        </div>
      </div>

      {/* Stats row */}
      <StatsRow timeline={timeline} />

      {/* Notable variants row */}
      {notableVariants.length > 0 && (
        <div className="mt-4">
          <p className="text-text-muted text-xs font-body mb-2 uppercase tracking-wider">
            Notable Variants
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {notableVariants.slice(0, 8).map((v) => (
              <button
                key={v.variant_id}
                onClick={() => handleVariantClick(v.variant_id)}
                className="shrink-0 rounded-lg bg-ocean-50 border border-ocean-100 px-3 py-2 text-left hover:border-primary/30 transition-all min-w-[180px]"
              >
                <p className="text-text-heading text-xs font-mono truncate max-w-[160px]">
                  {v.title || v.variant_id}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <GlowBadge
                    color={
                      v.significance.toLowerCase().includes('pathogenic')
                        ? 'magenta'
                        : v.significance.toLowerCase().includes('benign')
                          ? 'green'
                          : 'amber'
                    }
                  >
                    {v.significance || 'Unknown'}
                  </GlowBadge>
                </div>
                <p className="text-text-muted text-[10px] font-body mt-1">
                  {formatMonth(v.date)}
                  {v.submitter && ` \u00b7 ${v.submitter.slice(0, 30)}`}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function MomentumBadge({ trend, recent }: { trend: string; recent: number }) {
  const config = {
    accelerating: {
      color: 'green' as const,
      icon: TrendingUp,
      label: 'Accelerating',
    },
    stable: { color: 'amber' as const, icon: Minus, label: 'Stable' },
    decelerating: {
      color: 'magenta' as const,
      icon: TrendingDown,
      label: 'Decelerating',
    },
  };

  const c = config[trend as keyof typeof config] || config.stable;
  const Icon = c.icon;

  return (
    <div className="flex items-center gap-2">
      <GlowBadge color={c.color}>
        <span className="flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {c.label}
        </span>
      </GlowBadge>
      <span className="text-text-muted text-[10px] font-body">
        {recent} new in last 12mo
      </span>
    </div>
  );
}

function StatsRow({ timeline }: { timeline: TimelineData }) {
  const stats = [
    {
      label: 'Total Submissions',
      value: timeline.total_submissions.toLocaleString(),
      icon: Activity,
    },
    {
      label: 'Unique Submitters',
      value: timeline.unique_submitters.toLocaleString(),
      icon: Users,
    },
    {
      label: 'Date Range',
      value:
        timeline.date_range_start && timeline.date_range_end
          ? `${timeline.date_range_start.split('-')[0]} — ${timeline.date_range_end.split('-')[0]}`
          : '—',
      icon: Clock,
    },
    {
      label: 'Most Active',
      value: timeline.most_active_submitter
        ? timeline.most_active_submitter.length > 25
          ? timeline.most_active_submitter.slice(0, 25) + '...'
          : timeline.most_active_submitter
        : '—',
      icon: Award,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl bg-ocean-50 border border-ocean-100 p-3 text-center"
        >
          <s.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1 opacity-60" />
          <p className="text-text-muted text-[10px] font-body mb-0.5">{s.label}</p>
          <p className="text-text-heading text-xs font-mono truncate" title={s.value}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  // Find the total new and cumulative from payload
  const totalNew = payload.reduce((sum: number, entry: any) => {
    if (entry.dataKey !== 'cumulative') return sum + (entry.value || 0);
    return sum;
  }, 0);
  const cumulativeEntry = payload.find((p: any) => p.dataKey === 'cumulative');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg bg-white border border-[#D9E2EC] shadow-lg px-3 py-2 text-xs"
    >
      <p className="font-mono text-primary font-semibold mb-1">{label}</p>
      <p className="text-text-secondary mb-1">
        New: <span className="font-mono text-text-heading">{totalNew}</span>
      </p>
      {payload
        .filter((p: any) => p.dataKey !== 'cumulative' && p.value > 0)
        .map((p: any) => (
          <p key={p.dataKey} className="text-text-muted flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm inline-block"
              style={{ backgroundColor: p.color }}
            />
            {SIG_LABELS[p.dataKey] || p.dataKey}: <span className="font-mono">{p.value}</span>
          </p>
        ))}
      {cumulativeEntry && (
        <p className="text-primary mt-1 border-t border-[#D9E2EC] pt-1">
          Cumulative: <span className="font-mono">{cumulativeEntry.value}</span>
        </p>
      )}
    </motion.div>
  );
}
