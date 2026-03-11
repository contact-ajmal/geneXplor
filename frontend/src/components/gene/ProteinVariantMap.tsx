import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UniProtData, ClinVarVariant, GnomADVariant } from '../../lib/api';
import GlassCard from '../ui/GlassCard';

interface ProteinVariantMapProps {
  protein: UniProtData;
  clinvarVariants: ClinVarVariant[];
  gnomadVariants: GnomADVariant[];
  delay?: number;
  onVariantClick?: (variantId: string) => void;
}

const SIGNIFICANCE_COLORS: Record<string, string> = {
  'Pathogenic': '#ff3366',
  'Likely pathogenic': '#ff8c00',
  'Uncertain significance': '#ffaa00',
  'Likely benign': '#4a9eff',
  'Benign': '#00ff88',
};

const DOMAIN_COLORS = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#a855f7'];

interface MappedVariant {
  id: string;
  position: number;
  significance: string;
  color: string;
  af: number;
  consequence: string;
  hgvsp: string;
  title: string;
}

function getSignificanceColor(sig: string): string {
  const normalized = sig.toLowerCase();
  if (normalized.includes('pathogenic') && !normalized.includes('likely')) return SIGNIFICANCE_COLORS['Pathogenic'];
  if (normalized.includes('likely pathogenic') || normalized.includes('likely_pathogenic')) return SIGNIFICANCE_COLORS['Likely pathogenic'];
  if (normalized.includes('benign') && !normalized.includes('likely')) return SIGNIFICANCE_COLORS['Benign'];
  if (normalized.includes('likely benign') || normalized.includes('likely_benign')) return SIGNIFICANCE_COLORS['Likely benign'];
  if (normalized.includes('uncertain') || normalized.includes('vus')) return SIGNIFICANCE_COLORS['Uncertain significance'];
  return '#64748b';
}

function getSignificanceLabel(sig: string): string {
  const normalized = sig.toLowerCase();
  if (normalized.includes('pathogenic') && !normalized.includes('likely')) return 'Pathogenic';
  if (normalized.includes('likely pathogenic') || normalized.includes('likely_pathogenic')) return 'Likely pathogenic';
  if (normalized.includes('benign') && !normalized.includes('likely')) return 'Benign';
  if (normalized.includes('likely benign') || normalized.includes('likely_benign')) return 'Likely benign';
  if (normalized.includes('uncertain') || normalized.includes('vus')) return 'Uncertain significance';
  return sig;
}

function parseProteinPosition(hgvsp: string): number | null {
  const match = hgvsp.match(/p\.\D+(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default function ProteinVariantMap({ protein, clinvarVariants, gnomadVariants, delay = 0, onVariantClick }: ProteinVariantMapProps) {
  const [hoveredVariant, setHoveredVariant] = useState<MappedVariant | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MappedVariant | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Build a gnomAD AF lookup by variant_id
  const gnomadAFMap = useMemo(() => {
    const map = new Map<string, { af: number; consequence: string; hgvsp: string }>();
    for (const v of gnomadVariants) {
      map.set(v.variant_id, {
        af: v.allele_frequency,
        consequence: v.consequence,
        hgvsp: v.hgvsp || '',
      });
    }
    return map;
  }, [gnomadVariants]);

  // Map variants to protein positions
  const mappedVariants = useMemo(() => {
    const result: MappedVariant[] = [];
    const seen = new Set<string>();

    // First, try to map ClinVar variants via gnomAD hgvsp
    for (const cv of clinvarVariants) {
      const gnomadInfo = gnomadAFMap.get(cv.variant_id);
      const hgvsp = gnomadInfo?.hgvsp || '';
      const position = parseProteinPosition(hgvsp);

      if (position && position > 0 && position <= protein.protein_length) {
        const key = `${position}-${cv.clinical_significance}`;
        if (seen.has(key)) continue;
        seen.add(key);

        result.push({
          id: cv.variant_id,
          position,
          significance: getSignificanceLabel(cv.clinical_significance),
          color: getSignificanceColor(cv.clinical_significance),
          af: gnomadInfo?.af || 0,
          consequence: gnomadInfo?.consequence || cv.variant_type,
          hgvsp,
          title: cv.title,
        });
      }
    }

    // Also map gnomAD variants that have protein positions
    for (const gv of gnomadVariants) {
      if (!gv.hgvsp) continue;
      const position = parseProteinPosition(gv.hgvsp);
      if (!position || position <= 0 || position > protein.protein_length) continue;

      const key = `${position}-gnomad`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Check if we already have this from ClinVar
      const existingIndex = result.findIndex(r => r.position === position);
      if (existingIndex >= 0) continue;

      result.push({
        id: gv.variant_id,
        position,
        significance: 'Population',
        color: '#64748b',
        af: gv.allele_frequency,
        consequence: gv.consequence,
        hgvsp: gv.hgvsp,
        title: gv.variant_id,
      });
    }

    return result;
  }, [clinvarVariants, gnomadVariants, gnomadAFMap, protein.protein_length]);

  // SVG dimensions
  const width = 900;
  const height = 280;
  const margin = { top: 40, right: 30, bottom: 60, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const backboneY = margin.top + plotHeight - 30;
  const backboneHeight = 20;

  const xScale = useCallback((pos: number) => {
    return margin.left + (pos / protein.protein_length) * plotWidth;
  }, [protein.protein_length, margin.left, plotWidth]);

  // Marker radius: inversely proportional to AF (rarer = larger)
  const getRadius = useCallback((af: number) => {
    if (af <= 0 || af < 0.0001) return 6;
    if (af < 0.001) return 5;
    if (af < 0.01) return 4;
    return 3;
  }, []);

  // Calculate stem heights with collision avoidance
  const variantPositions = useMemo(() => {
    const sorted = [...mappedVariants].sort((a, b) => a.position - b.position);
    const positions: { variant: MappedVariant; stemTop: number }[] = [];

    for (const variant of sorted) {
      const x = xScale(variant.position);
      const radius = getRadius(variant.af);
      const baseTop = backboneY - 60;

      // Check for overlap with nearby variants
      let stemTop = baseTop;
      for (const existing of positions) {
        const existingX = xScale(existing.variant.position);
        const existingRadius = getRadius(existing.variant.af);
        if (Math.abs(x - existingX) < radius + existingRadius + 2) {
          stemTop = Math.min(stemTop, existing.stemTop - radius * 2 - 4);
        }
      }

      stemTop = Math.max(margin.top + 10, stemTop);
      positions.push({ variant, stemTop });
    }

    return positions;
  }, [mappedVariants, xScale, getRadius, backboneY, margin.top]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  // Generate tick positions for x-axis
  const xTicks = useMemo(() => {
    const count = 6;
    const step = Math.ceil(protein.protein_length / count / 50) * 50;
    const ticks: number[] = [1];
    for (let i = step; i < protein.protein_length; i += step) {
      ticks.push(i);
    }
    ticks.push(protein.protein_length);
    return ticks;
  }, [protein.protein_length]);

  // Close tooltip on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (svgRef.current && !svgRef.current.contains(e.target as Node)) {
        setSelectedVariant(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const legendItems = [
    { label: 'Pathogenic', color: SIGNIFICANCE_COLORS['Pathogenic'] },
    { label: 'Likely pathogenic', color: SIGNIFICANCE_COLORS['Likely pathogenic'] },
    { label: 'VUS', color: SIGNIFICANCE_COLORS['Uncertain significance'] },
    { label: 'Likely benign', color: SIGNIFICANCE_COLORS['Likely benign'] },
    { label: 'Benign', color: SIGNIFICANCE_COLORS['Benign'] },
  ];

  const activeVariant = selectedVariant || hoveredVariant;

  return (
    <GlassCard delay={delay} className="overflow-visible">
      <div className="mb-4">
        <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
          Protein Variant Map
        </h2>
        <p className="text-text-muted text-xs font-body mt-1">
          Variants mapped to protein domains — colored by clinical significance
        </p>
      </div>

      {mappedVariants.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm font-body">
          No variants could be mapped to protein positions
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            style={{ maxHeight: '320px' }}
            onMouseMove={handleMouseMove}
          >
            {/* X-axis ticks */}
            {xTicks.map(tick => (
              <g key={tick}>
                <line
                  x1={xScale(tick)}
                  y1={backboneY + backboneHeight + 4}
                  x2={xScale(tick)}
                  y2={backboneY + backboneHeight + 10}
                  stroke="#64748b"
                  strokeWidth={0.5}
                />
                <text
                  x={xScale(tick)}
                  y={backboneY + backboneHeight + 22}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={9}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* X-axis label */}
            <text
              x={width / 2}
              y={height - 5}
              textAnchor="middle"
              fill="#64748b"
              fontSize={10}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              Amino acid position
            </text>

            {/* Protein backbone */}
            <rect
              x={margin.left}
              y={backboneY}
              width={plotWidth}
              height={backboneHeight}
              rx={4}
              fill="rgba(26, 35, 50, 0.9)"
              stroke="rgba(0, 212, 255, 0.15)"
              strokeWidth={1}
            />

            {/* Domain segments on backbone */}
            {protein.domains.map((domain, i) => {
              const domainX = xScale(domain.start);
              const domainWidth = xScale(domain.end) - xScale(domain.start);
              const color = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
              return (
                <g key={`domain-${i}`}>
                  <rect
                    x={domainX}
                    y={backboneY}
                    width={Math.max(domainWidth, 3)}
                    height={backboneHeight}
                    rx={3}
                    fill={color}
                    opacity={0.5}
                  />
                  {/* Domain labels below */}
                  {domainWidth > 30 && (
                    <text
                      x={domainX + domainWidth / 2}
                      y={backboneY + backboneHeight + 38}
                      textAnchor="middle"
                      fill={color}
                      fontSize={8}
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      opacity={0.8}
                    >
                      {domain.name.length > 12
                        ? domain.name.slice(0, 12) + '…'
                        : domain.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Lollipop variants */}
            {variantPositions.map(({ variant, stemTop }) => {
              const cx = xScale(variant.position);
              const r = getRadius(variant.af);
              const isActive = activeVariant?.id === variant.id;

              return (
                <g
                  key={variant.id}
                  onMouseEnter={() => setHoveredVariant(variant)}
                  onMouseLeave={() => setHoveredVariant(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onVariantClick) {
                      onVariantClick(variant.id);
                    } else {
                      setSelectedVariant(selectedVariant?.id === variant.id ? null : variant);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {/* Stem */}
                  <line
                    x1={cx}
                    y1={backboneY}
                    x2={cx}
                    y2={stemTop + r}
                    stroke={variant.color}
                    strokeWidth={isActive ? 1.5 : 0.8}
                    opacity={isActive ? 1 : 0.6}
                  />
                  {/* Head */}
                  <circle
                    cx={cx}
                    cy={stemTop}
                    r={isActive ? r + 1.5 : r}
                    fill={variant.color}
                    opacity={isActive ? 1 : 0.8}
                    stroke={isActive ? '#fff' : 'none'}
                    strokeWidth={isActive ? 1 : 0}
                  />
                  {/* Glow on active */}
                  {isActive && (
                    <circle
                      cx={cx}
                      cy={stemTop}
                      r={r + 6}
                      fill="none"
                      stroke={variant.color}
                      strokeWidth={1}
                      opacity={0.3}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          <AnimatePresence>
            {activeVariant && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute z-20 pointer-events-none rounded-lg bg-space-700/95 backdrop-blur-md border border-cyan/20 p-3 shadow-lg shadow-black/30"
                style={{
                  left: Math.min(tooltipPos.x + 12, (svgRef.current?.clientWidth || 600) - 220),
                  top: tooltipPos.y - 10,
                  maxWidth: 240,
                }}
              >
                <p className="font-mono text-xs text-cyan mb-1 truncate">{activeVariant.id}</p>
                {activeVariant.hgvsp && (
                  <p className="font-mono text-xs text-text-primary mb-1">{activeVariant.hgvsp}</p>
                )}
                <p className="text-xs text-text-secondary mb-1">
                  Position: <span className="font-mono">{activeVariant.position}</span>
                </p>
                <p className="text-xs text-text-secondary mb-1">
                  Consequence: {activeVariant.consequence.replace(/_/g, ' ')}
                </p>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: activeVariant.color }}
                  />
                  <span className="text-xs" style={{ color: activeVariant.color }}>
                    {activeVariant.significance}
                  </span>
                </div>
                {activeVariant.af > 0 && (
                  <p className="text-xs text-text-muted font-mono">
                    AF: {activeVariant.af.toExponential(2)}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-space-600/30">
        {legendItems.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-text-muted text-xs font-body">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-4 border-l border-space-600/30 pl-4">
          <span className="text-text-muted text-xs font-body">Size:</span>
          <svg width="60" height="16" viewBox="0 0 60 16">
            <circle cx="8" cy="8" r="6" fill="#64748b" opacity={0.5} />
            <circle cx="26" cy="8" r="4" fill="#64748b" opacity={0.5} />
            <circle cx="40" cy="8" r="3" fill="#64748b" opacity={0.5} />
          </svg>
          <span className="text-text-muted text-xs font-body">rare → common</span>
        </div>
      </div>
    </GlassCard>
  );
}
