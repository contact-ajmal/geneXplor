import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ChevronDown, ChevronUp, Network } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { PathwayData, PathwayEntry } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';
import AnimatedButton from '../ui/AnimatedButton';

interface BiologicalPathwaysProps {
  pathways: PathwayData;
  geneSymbol: string;
  delay?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Signal Transduction': '#00d4ff',
  'Cell Cycle': '#ff3366',
  'DNA Repair': '#ffaa00',
  'Immune System': '#a855f7',
  'Apoptosis': '#ff8c00',
  'Metabolism': '#00ff88',
  'Gene Expression': '#4a9eff',
  'Transport': '#e879f9',
  'Disease': '#f97316',
  'Cellular Process': '#64748b',
  'Unclassified': '#475569',
};

const FALLBACK_COLORS = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#a855f7', '#4a9eff', '#ff8c00', '#e879f9'];

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || FALLBACK_COLORS[Math.abs(hashCode(category)) % FALLBACK_COLORS.length];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export default function BiologicalPathways({ pathways, geneSymbol, delay = 0 }: BiologicalPathwaysProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedPathway, setExpandedPathway] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Category breakdown for donut chart
  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pathways.pathways) {
      const cat = p.category || 'Unclassified';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }))
      .sort((a, b) => b.value - a.value);
  }, [pathways.pathways]);

  // Filtered pathways
  const filteredPathways = useMemo(() => {
    if (!categoryFilter) return pathways.pathways;
    return pathways.pathways.filter(p => (p.category || 'Unclassified') === categoryFilter);
  }, [pathways.pathways, categoryFilter]);

  const handleCategoryClick = useCallback((category: string) => {
    setCategoryFilter(prev => prev === category ? null : category);
  }, []);

  const scrollToPathway = useCallback((pathwayId: string) => {
    const el = cardRefs.current[pathwayId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setExpandedPathway(pathwayId);
    }
  }, []);

  return (
    <GlassCard delay={delay}>
      <div className="mb-4">
        <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
          Biological Pathways
        </h2>
        <p className="text-text-muted text-xs font-body mt-1">
          Pathways and processes involving <span className="font-mono text-cyan">{geneSymbol}</span>
          {' '}&mdash; {pathways.total_pathways} pathways found
        </p>
      </div>

      {/* Top row: Donut chart + Network mini-viz */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Category donut chart */}
        {categoryData.length > 0 && (
          <div>
            <p className="text-text-muted text-xs font-body font-semibold mb-2 uppercase tracking-wider">
              Pathway Categories
            </p>
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      onClick={(entry) => handleCategoryClick(entry.name)}
                      className="cursor-pointer"
                    >
                      {categoryData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.color}
                          opacity={categoryFilter && categoryFilter !== entry.name ? 0.25 : 0.85}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-space-700/95 backdrop-blur-md border border-cyan/20 rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-text-primary text-xs font-body">{d.name}</p>
                            <p className="text-cyan text-xs font-mono">{d.value} pathways</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                {categoryData.slice(0, 8).map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => handleCategoryClick(cat.name)}
                    className={`flex items-center gap-2 text-left px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      categoryFilter === cat.name ? 'bg-cyan/10' : 'hover:bg-cyan/[0.04]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-text-secondary text-xs font-body truncate">{cat.name}</span>
                    <span className="text-text-muted text-xs font-mono ml-auto shrink-0">{cat.value}</span>
                  </button>
                ))}
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className="text-cyan text-xs font-body mt-1 text-left px-2 cursor-pointer hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pathway network mini-viz */}
        <div className="hidden md:block">
          <p className="text-text-muted text-xs font-body font-semibold mb-2 uppercase tracking-wider">
            Pathway Network
          </p>
          <PathwayNetworkViz
            pathways={filteredPathways}
            geneSymbol={geneSymbol}
            onPathwayClick={scrollToPathway}
          />
        </div>
      </div>

      {/* Pathway list */}
      <div className="space-y-3">
        {filteredPathways.map((pathway, i) => (
          <motion.div
            key={pathway.id}
            ref={(el) => { cardRefs.current[pathway.id] = el; }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.02 }}
          >
            <PathwayCard
              pathway={pathway}
              isExpanded={expandedPathway === pathway.id}
              onToggle={() => setExpandedPathway(expandedPathway === pathway.id ? null : pathway.id)}
            />
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}

// ── Pathway Card ──

function PathwayCard({
  pathway,
  isExpanded,
  onToggle,
}: {
  pathway: PathwayEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categoryColor = getCategoryColor(pathway.category);

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isExpanded
          ? 'border-cyan/15 bg-space-700/40'
          : 'border-space-600/20 bg-space-800/20 hover:border-space-600/40'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-sm font-body font-semibold text-text-primary">
                {pathway.name}
              </h3>
              <GlowBadge color={pathway.source === 'Reactome' ? 'cyan' : 'amber'} className="text-[9px] px-1.5 py-0">
                {pathway.source}
              </GlowBadge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span
                className="inline-flex items-center gap-1 font-body"
                style={{ color: categoryColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
                {pathway.category}
              </span>
              {pathway.gene_count > 0 && (
                <span className="text-text-muted font-mono">
                  {pathway.gene_count} genes
                </span>
              )}
              <span className="text-text-muted font-mono">{pathway.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <a
              href={pathway.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-1 rounded text-text-muted hover:text-cyan transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {pathway.description && (
                <p className="text-text-secondary text-xs font-body leading-relaxed">
                  {pathway.description}
                </p>
              )}

              {pathway.sub_events.length > 0 && (
                <div>
                  <p className="text-text-muted text-xs font-body font-semibold mb-1.5">
                    Reactions & Sub-events
                  </p>
                  <ul className="space-y-1">
                    {pathway.sub_events.map((event, i) => (
                      <li key={i} className="text-text-secondary text-xs font-body flex items-start gap-2">
                        <span className="text-cyan/50 mt-0.5 shrink-0">&#8226;</span>
                        {event}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2">
                <a href={pathway.url} target="_blank" rel="noopener noreferrer">
                  <AnimatedButton variant="secondary" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      View Pathway Diagram
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </AnimatedButton>
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pathway Network Mini-Viz (SVG force-like layout) ──

function PathwayNetworkViz({
  pathways,
  geneSymbol,
  onPathwayClick,
}: {
  pathways: PathwayEntry[];
  geneSymbol: string;
  onPathwayClick: (id: string) => void;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 360;
  const height = 200;
  const cx = width / 2;
  const cy = height / 2;

  // Place pathway nodes in a radial layout around the center gene
  const nodes = useMemo(() => {
    const displayed = pathways.slice(0, 12);
    const angleStep = (2 * Math.PI) / Math.max(displayed.length, 1);
    const baseRadius = 70;

    return displayed.map((p, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const r = baseRadius + (i % 2) * 15;
      const nodeRadius = Math.min(Math.max(Math.sqrt(p.gene_count || 1) * 2, 6), 16);
      return {
        pathway: p,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        r: nodeRadius,
        color: getCategoryColor(p.category),
      };
    });
  }, [pathways, cx, cy]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: '200px' }}
      >
        {/* Edges */}
        {nodes.map(node => (
          <line
            key={`edge-${node.pathway.id}`}
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke={node.color}
            strokeWidth={hoveredNode === node.pathway.id ? 1.2 : 0.5}
            opacity={hoveredNode === node.pathway.id ? 0.6 : 0.2}
          />
        ))}

        {/* Pathway nodes */}
        {nodes.map(node => (
          <g
            key={node.pathway.id}
            onMouseEnter={() => setHoveredNode(node.pathway.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => onPathwayClick(node.pathway.id)}
            className="cursor-pointer"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={hoveredNode === node.pathway.id ? node.r + 2 : node.r}
              fill={node.color}
              opacity={hoveredNode === node.pathway.id ? 0.9 : 0.6}
              stroke={hoveredNode === node.pathway.id ? '#fff' : 'none'}
              strokeWidth={1}
            />
            {hoveredNode === node.pathway.id && (
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r + 6}
                fill="none"
                stroke={node.color}
                strokeWidth={0.8}
                opacity={0.3}
              />
            )}
          </g>
        ))}

        {/* Center gene node */}
        <circle
          cx={cx}
          cy={cy}
          r={14}
          fill="#00d4ff"
          opacity={0.9}
          stroke="#fff"
          strokeWidth={1.5}
        />
        <circle
          cx={cx}
          cy={cy}
          r={20}
          fill="none"
          stroke="#00d4ff"
          strokeWidth={0.8}
          opacity={0.2}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0a0e1a"
          fontSize={7}
          fontFamily="JetBrains Mono, monospace"
          fontWeight={600}
        >
          {geneSymbol.length <= 5 ? geneSymbol : geneSymbol.slice(0, 4)}
        </text>
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-space-700/95 backdrop-blur-md border border-cyan/20 rounded-lg px-3 py-1.5 shadow-lg pointer-events-none"
          >
            <p className="text-text-primary text-xs font-body truncate max-w-[200px]">
              {nodes.find(n => n.pathway.id === hoveredNode)?.pathway.name}
            </p>
            <p className="text-text-muted text-[10px] font-mono">
              {nodes.find(n => n.pathway.id === hoveredNode)?.pathway.gene_count || 0} genes
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
