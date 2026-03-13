import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { fetchResearchPulse } from '../../lib/api';
import type { ResearchPulseResponse } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';
import CountUp from '../ui/CountUp';

interface ResearchPulseCardProps {
  geneSymbol: string;
  delay?: number;
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'rising') return <TrendingUp className="w-4 h-4" />;
  if (direction === 'declining') return <TrendingDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
}

function Sparkline({ data, trend, width = 120, height = 40 }: {
  data: { year: number; count: number }[];
  trend: string;
  width?: number;
  height?: number;
}) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width;
    const y = height - (d.count / maxCount) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const color = trend === 'rising' ? '#00ff88' : trend === 'declining' ? '#ff3366' : '#ffaa00';

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.8}
      />
      {/* Highlight last point */}
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) / Math.max(data.length - 1, 1) * width}
          cy={height - (data[data.length - 1].count / maxCount) * (height - 4) - 2}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

export default function ResearchPulseCard({ geneSymbol, delay = 0 }: ResearchPulseCardProps) {
  const { data: pulse, isLoading } = useQuery<ResearchPulseResponse>({
    queryKey: ['research-pulse', geneSymbol],
    queryFn: () => fetchResearchPulse(geneSymbol),
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const changePercent = useMemo(() => {
    if (!pulse || pulse.prior_12_months === 0) return null;
    return Math.round(((pulse.last_12_months - pulse.prior_12_months) / pulse.prior_12_months) * 100);
  }, [pulse]);

  const last10Years = useMemo(() => {
    if (!pulse) return [];
    return pulse.yearly_publications.slice(-10);
  }, [pulse]);

  if (isLoading) {
    return (
      <GlassCard delay={delay}>
        <div className="h-5 w-36 rounded skeleton-shimmer mb-4" />
        <div className="h-24 rounded skeleton-shimmer" />
      </GlassCard>
    );
  }

  if (!pulse) return null;

  const trendColor = pulse.trend_direction === 'rising' ? 'green'
    : pulse.trend_direction === 'declining' ? 'magenta' : 'amber';

  return (
    <GlassCard delay={delay}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan" />
            <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
              Research Pulse
            </h2>
          </div>
          <p className="text-text-muted text-xs font-body mt-1">
            Publication frequency analysis for {geneSymbol}
          </p>
        </div>
        <GlowBadge color={trendColor} pulse={pulse.trend_direction === 'rising'}>
          <TrendIcon direction={pulse.trend_direction} />
          {pulse.trend_direction.charAt(0).toUpperCase() + pulse.trend_direction.slice(1)}
        </GlowBadge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-xl bg-space-700/30 border border-space-600/20">
          <CountUp
            end={pulse.last_12_months}
            className="text-xl font-mono font-bold text-cyan"
            formatter={(n) => Math.round(n).toLocaleString()}
          />
          <p className="text-text-muted text-[10px] font-body mt-0.5">Last 12 months</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-space-700/30 border border-space-600/20">
          <CountUp
            end={pulse.prior_12_months}
            className="text-xl font-mono font-bold text-text-secondary"
            formatter={(n) => Math.round(n).toLocaleString()}
          />
          <p className="text-text-muted text-[10px] font-body mt-0.5">Prior 12 months</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-space-700/30 border border-space-600/20">
          {changePercent !== null ? (
            <span className={`text-xl font-mono font-bold ${changePercent >= 0 ? 'text-helix-green' : 'text-magenta'}`}>
              {changePercent >= 0 ? '+' : ''}{changePercent}%
            </span>
          ) : (
            <span className="text-xl font-mono font-bold text-text-muted">—</span>
          )}
          <p className="text-text-muted text-[10px] font-body mt-0.5">Change</p>
        </div>
      </div>

      {/* Publication timeline bars */}
      {last10Years.length > 0 && (
        <div className="mb-4">
          <p className="text-text-muted text-[10px] font-body mb-2">Publication timeline (last 10 years)</p>
          <div className="flex items-end gap-1 h-20">
            {last10Years.map((d, i) => {
              const maxCount = Math.max(...last10Years.map(y => y.count), 1);
              const heightPercent = (d.count / maxCount) * 100;
              const isLast = i === last10Years.length - 1;
              return (
                <div
                  key={d.year}
                  className="flex-1 flex flex-col items-center group"
                  title={`${d.year}: ${d.count.toLocaleString()} papers`}
                >
                  <motion.div
                    className={`w-full rounded-t transition-colors ${
                      isLast ? 'bg-cyan' : 'bg-cyan/40 group-hover:bg-cyan/60'
                    }`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPercent, 2)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                  />
                  <span className="text-[8px] font-mono text-text-muted mt-1">
                    {String(d.year).slice(-2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Peak year callout */}
      <p className="text-text-muted text-xs font-body">
        Peak year: <span className="font-mono text-text-secondary">{pulse.peak_year}</span>
        {' '}· Total: <span className="font-mono text-text-secondary">{pulse.total_all_time.toLocaleString()}</span> papers
      </p>
    </GlassCard>
  );
}

// Exported sparkline for use in header and other places
export { Sparkline };
