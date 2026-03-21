import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, ChevronRight, Flame, BarChart3,
  BookOpen, ArrowRight,
} from 'lucide-react';
import { fetchTrendingGenes } from '../lib/api';
import type { TrendingGenesResponse, TrendingGeneEntry } from '../lib/api';
import GlassCard from '../components/ui/GlassCard';
import GlowBadge from '../components/ui/GlowBadge';
import AnimatedButton from '../components/ui/AnimatedButton';
import DecodeText from '../components/ui/DecodeText';
import ScrollReveal from '../components/ui/ScrollReveal';
import { Sparkline } from '../components/gene/ResearchPulseCard';

const CATEGORY_FILTERS = [
  { key: 'all', label: 'All Genes' },
  { key: 'oncogene', label: 'Oncogenes' },
  { key: 'tumor_suppressor', label: 'Tumor Suppressors' },
  { key: 'cardiac', label: 'Cardiac' },
  { key: 'neurological', label: 'Neurological' },
  { key: 'metabolic', label: 'Metabolic' },
  { key: 'immune', label: 'Immune' },
];

function TrendBadge({ direction, ratio }: { direction: string; ratio: number }) {
  const changePercent = Math.round((ratio - 1) * 100);
  const color = direction === 'rising' ? 'green' : direction === 'declining' ? 'magenta' : 'amber';
  const Icon = direction === 'rising' ? TrendingUp : direction === 'declining' ? TrendingDown : Minus;
  return (
    <GlowBadge color={color}>
      <Icon className="w-3 h-3" />
      {changePercent >= 0 ? '+' : ''}{changePercent}%
    </GlowBadge>
  );
}

export default function TrendingPage() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [view, setView] = useState<'table' | 'chart'>('table');

  const { data, isLoading, error } = useQuery<TrendingGenesResponse>({
    queryKey: ['trending-genes'],
    queryFn: fetchTrendingGenes,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const filteredTrending = useMemo(() => {
    if (!data) return [];
    if (categoryFilter === 'all') return data.trending;
    return data.trending.filter(g => g.category === categoryFilter);
  }, [data, categoryFilter]);

  // Gene of the Day: highest trend ratio with meaningful volume
  const geneOfDay = useMemo(() => {
    if (!data || data.trending.length === 0) return null;
    return data.trending.find(g => g.last_12_months >= 5) || data.trending[0];
  }, [data]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <div className="h-10 w-56 rounded skeleton-shimmer mb-2" />
        <div className="h-5 w-96 rounded skeleton-shimmer mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="h-14 rounded-xl skeleton-shimmer"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
        <p className="text-text-secondary font-body">Failed to load trending data. Try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-text-heading mb-2">
          <DecodeText text="Trending Genes" speed={35} className="text-primary" />
        </h1>
        <p className="text-text-secondary font-body text-lg">
          Which genes are getting the most research attention right now?
        </p>
      </motion.div>

      {/* Gene of the Day */}
      {geneOfDay && (
        <ScrollReveal>
          <GlassCard className="mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-warning" />
              <span className="text-xs font-heading font-semibold text-warning uppercase tracking-wider">
                Gene of the Day
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl font-mono font-bold text-primary">{geneOfDay.gene_symbol}</span>
                  <TrendBadge direction={geneOfDay.trend_direction} ratio={geneOfDay.trend_ratio} />
                  {geneOfDay.category && (
                    <GlowBadge color="muted" className="text-[10px]">
                      {data.categories[geneOfDay.category] || geneOfDay.category}
                    </GlowBadge>
                  )}
                </div>
                <p className="text-text-secondary text-sm font-body">
                  <span className="font-mono text-primary">{geneOfDay.last_12_months.toLocaleString()}</span> papers in the last 12 months
                  {geneOfDay.prior_12_months > 0 && (
                    <>, up from <span className="font-mono">{geneOfDay.prior_12_months.toLocaleString()}</span> the year before</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/gene/${geneOfDay.gene_symbol}`}>
                  <AnimatedButton variant="primary">
                    <span className="flex items-center gap-1.5">
                      Explore <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </AnimatedButton>
                </Link>
                <Link to={`/gene/${geneOfDay.gene_symbol}/story`}>
                  <AnimatedButton variant="secondary">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> Story
                    </span>
                  </AnimatedButton>
                </Link>
              </div>
            </div>
          </GlassCard>
        </ScrollReveal>
      )}

      {/* Category Filters */}
      <ScrollReveal delay={0.05}>
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORY_FILTERS.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-body transition-all cursor-pointer border
                ${categoryFilter === cat.key
                  ? 'bg-primary-light text-primary border-primary/25'
                  : 'bg-ocean-50 text-text-muted border-ocean-100 hover:border-ocean-200 hover:text-text-secondary'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </ScrollReveal>

      {/* Main Content: Table + Bubble Chart */}
      <div className="grid lg:grid-cols-9 gap-6">
        {/* Table (55%) */}
        <ScrollReveal delay={0.1} className="lg:col-span-5">
          <GlassCard hover={false}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
                {categoryFilter === 'all' ? 'All Trending' : data.categories[categoryFilter] || categoryFilter}
              </h2>
              <span className="text-text-muted text-xs font-body">{filteredTrending.length} genes</span>
            </div>

            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ocean-100">
                    <th className="text-left py-2 px-2 text-text-muted text-xs font-body font-semibold uppercase tracking-wider">#</th>
                    <th className="text-left py-2 px-2 text-text-muted text-xs font-body font-semibold uppercase tracking-wider">Gene</th>
                    <th className="text-right py-2 px-2 text-text-muted text-xs font-body font-semibold uppercase tracking-wider">Last 12mo</th>
                    <th className="text-center py-2 px-2 text-text-muted text-xs font-body font-semibold uppercase tracking-wider">Trend</th>
                    <th className="text-center py-2 px-2 text-text-muted text-xs font-body font-semibold uppercase tracking-wider hidden sm:table-cell">Sparkline</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrending.map((gene, i) => (
                    <motion.tr
                      key={gene.gene_symbol}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-ocean-50 hover:bg-ocean-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/gene/${gene.gene_symbol}`)}
                    >
                      <td className="py-2.5 px-2 text-text-muted text-xs font-mono">{i + 1}</td>
                      <td className="py-2.5 px-2">
                        <span className="font-mono text-primary text-sm font-semibold">{gene.gene_symbol}</span>
                        {gene.category && (
                          <span className="ml-2 text-text-muted text-[10px] font-body hidden md:inline">
                            {data.categories[gene.category] || ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-text-heading">
                        {gene.last_12_months.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <TrendBadge direction={gene.trend_direction} ratio={gene.trend_ratio} />
                      </td>
                      <td className="py-2.5 px-2 text-center hidden sm:table-cell">
                        {gene.yearly_publications.length > 0 && (
                          <Sparkline
                            data={gene.yearly_publications}
                            trend={gene.trend_direction}
                            width={80}
                            height={28}
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTrending.length === 0 && (
              <p className="text-text-muted text-sm font-body text-center py-8">
                No trending genes found in this category
              </p>
            )}
          </GlassCard>
        </ScrollReveal>

        {/* Bubble Chart (45%) */}
        <ScrollReveal delay={0.15} className="lg:col-span-4">
          <GlassCard hover={false}>
            <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider mb-4">
              Research Landscape
            </h2>
            <BubbleChart genes={filteredTrending} onGeneClick={(sym) => navigate(`/gene/${sym}`)} />
            <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-body text-text-muted">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success/60" />
                Top-right: Hot & Established
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary/60" />
                Top-left: Emerging
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning/60" />
                Bottom-right: Stable & Established
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-text-muted/40" />
                Bottom-left: Niche
              </div>
            </div>
          </GlassCard>
        </ScrollReveal>
      </div>

      {/* Generation timestamp */}
      {data.generated_at && (
        <p className="text-text-muted text-xs font-mono text-center mt-8">
          Data generated: {new Date(data.generated_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// -- Bubble Chart --

function BubbleChart({ genes, onGeneClick }: {
  genes: TrendingGeneEntry[];
  onGeneClick: (symbol: string) => void;
}) {
  const chartData = useMemo(() => {
    if (genes.length === 0) return [];
    const maxTotal = Math.max(...genes.map(g => g.total_all_time), 1);
    const maxRatio = Math.max(...genes.map(g => g.trend_ratio), 1.5);
    const maxLast12 = Math.max(...genes.map(g => g.last_12_months), 1);

    return genes.slice(0, 30).map(g => ({
      symbol: g.gene_symbol,
      // X: total publications (research maturity), normalized to 0-280
      x: Math.min((Math.log10(g.total_all_time + 1) / Math.log10(maxTotal + 1)) * 280, 280),
      // Y: trend ratio (momentum), inverted for SVG coords
      y: 220 - Math.min(((g.trend_ratio - 0.5) / (maxRatio - 0.3)) * 220, 220),
      // Size: last 12 months count
      r: Math.max(Math.sqrt(g.last_12_months / maxLast12) * 18, 4),
      direction: g.trend_direction,
      ratio: g.trend_ratio,
      total: g.total_all_time,
      last12: g.last_12_months,
    }));
  }, [genes]);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (chartData.length === 0) {
    return <div className="h-[260px] flex items-center justify-center text-text-muted text-sm">No data</div>;
  }

  return (
    <div className="relative">
      <svg viewBox="0 0 300 240" className="w-full h-auto">
        {/* Quadrant lines */}
        <line x1={150} y1={0} x2={150} y2={240} stroke="currentColor" className="text-ocean-200" strokeDasharray="4,4" />
        <line x1={0} y1={120} x2={300} y2={120} stroke="currentColor" className="text-ocean-200" strokeDasharray="4,4" />

        {/* Axis labels */}
        <text x={150} y={236} textAnchor="middle" className="fill-text-muted text-[8px] font-body">
          Total Publications →
        </text>
        <text x={4} y={120} textAnchor="start" className="fill-text-muted text-[8px] font-body" transform="rotate(-90, 8, 120)">
          Trend →
        </text>

        {/* Bubbles */}
        {chartData.map((d, i) => {
          const color = d.direction === 'rising'
            ? d.x > 150 ? '#2B9F78' : '#1B4965'  // Hot/Emerging
            : d.direction === 'declining'
              ? '#D64045'
              : '#D4A843';

          return (
            <g
              key={d.symbol}
              className="cursor-pointer"
              onClick={() => onGeneClick(d.symbol)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <circle
                cx={d.x + 10}
                cy={d.y}
                r={d.r}
                fill={color}
                opacity={hoveredIdx === i ? 0.9 : 0.5}
                stroke={hoveredIdx === i ? '#1e293b' : 'none'}
                strokeWidth={1}
                className="transition-all duration-200"
              />
              {(d.r > 8 || hoveredIdx === i) && (
                <text
                  x={d.x + 10}
                  y={d.y + 3}
                  textAnchor="middle"
                  className="fill-text-heading font-mono font-bold pointer-events-none"
                  fontSize={hoveredIdx === i ? 9 : 7}
                >
                  {d.symbol}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredIdx !== null && chartData[hoveredIdx] && (
        <div className="absolute top-2 right-2 p-2 rounded-lg bg-white border border-ocean-200 text-xs z-10 shadow-md">
          <p className="font-mono text-primary font-bold">{chartData[hoveredIdx].symbol}</p>
          <p className="text-text-muted">Total: {chartData[hoveredIdx].total.toLocaleString()}</p>
          <p className="text-text-muted">Last 12mo: {chartData[hoveredIdx].last12.toLocaleString()}</p>
          <p className="text-text-muted">Trend: {chartData[hoveredIdx].direction}</p>
        </div>
      )}
    </div>
  );
}
