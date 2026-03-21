import { useState, useMemo, useCallback, useRef } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, AlertTriangle, ChevronDown } from 'lucide-react';
import type { GnomADVariant, ClinVarVariant, PopulationFrequency } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface PopulationGeo {
  name: string;
  center: [number, number]; // [lng, lat]
  color: string;
}

const POPULATION_GEO: Record<string, PopulationGeo> = {
  afr: { name: 'African / African American', center: [20, 0], color: '#D64045' },
  amr: { name: 'Latino / Admixed American', center: [-60, 0], color: '#E07A3A' },
  asj: { name: 'Ashkenazi Jewish', center: [35, 32], color: '#1B4965' },
  eas: { name: 'East Asian', center: [115, 35], color: '#D4A843' },
  fin: { name: 'Finnish', center: [26, 64], color: '#7C5CBF' },
  mid: { name: 'Middle Eastern', center: [45, 30], color: '#D64045' },
  nfe: { name: 'Non-Finnish European', center: [10, 50], color: '#2B9F78' },
  sas: { name: 'South Asian', center: [78, 25], color: '#5294C4' },
  oth: { name: 'Other', center: [0, -60], color: '#7B8794' },
};

interface PopulationMapProps {
  gnomadVariants: GnomADVariant[];
  clinvarVariants: ClinVarVariant[];
  initialVariantId?: string;
  geneSymbol: string;
  delay?: number;
  embedded?: boolean;
}

interface MergedVariantOption {
  variant_id: string;
  consequence: string;
  clinical_significance: string;
  allele_frequency: number;
  population_frequencies: PopulationFrequency[];
}

function getSignificanceOrder(sig: string): number {
  const s = sig.toLowerCase();
  if (s.includes('pathogenic') && !s.includes('likely')) return 0;
  if (s.includes('likely pathogenic') || s.includes('likely_pathogenic')) return 1;
  if (s.includes('uncertain') || s.includes('vus')) return 2;
  if (s.includes('likely benign') || s.includes('likely_benign')) return 3;
  if (s.includes('benign') && !s.includes('likely')) return 4;
  return 5;
}

function formatAF(af: number): string {
  if (af === 0) return '0';
  if (af < 0.0001) return af.toExponential(2);
  return af.toFixed(4);
}

export default function PopulationMap({
  gnomadVariants,
  clinvarVariants,
  initialVariantId,
  geneSymbol,
  delay = 0,
  embedded = false,
}: PopulationMapProps) {
  // Build merged variant options with clinical significance from ClinVar
  const variantOptions = useMemo((): MergedVariantOption[] => {
    const clinvarMap = new Map(clinvarVariants.map(cv => [cv.variant_id, cv]));
    const opts: MergedVariantOption[] = gnomadVariants
      .filter(v => v.population_frequencies.length > 0)
      .map(v => ({
        variant_id: v.variant_id,
        consequence: v.consequence,
        clinical_significance: clinvarMap.get(v.variant_id)?.clinical_significance || '',
        allele_frequency: v.allele_frequency,
        population_frequencies: v.population_frequencies,
      }));
    // Sort: pathogenic first, then by AF descending
    opts.sort((a, b) => {
      const sigDiff = getSignificanceOrder(a.clinical_significance) - getSignificanceOrder(b.clinical_significance);
      if (sigDiff !== 0) return sigDiff;
      return b.allele_frequency - a.allele_frequency;
    });
    return opts;
  }, [gnomadVariants, clinvarVariants]);

  // Default to initialVariantId or first option
  const defaultId = initialVariantId && variantOptions.some(v => v.variant_id === initialVariantId)
    ? initialVariantId
    : variantOptions[0]?.variant_id || '';

  const [selectedVariantId, setSelectedVariantId] = useState(defaultId);
  const [hoveredPop, setHoveredPop] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedVariant = useMemo(
    () => variantOptions.find(v => v.variant_id === selectedVariantId) || null,
    [variantOptions, selectedVariantId],
  );

  const popFreqMap = useMemo(() => {
    const map = new Map<string, PopulationFrequency>();
    if (!selectedVariant) return map;
    for (const pf of selectedVariant.population_frequencies) {
      map.set(pf.population.toLowerCase(), pf);
    }
    return map;
  }, [selectedVariant]);

  const globalAF = selectedVariant?.allele_frequency || 0;

  const maxAF = useMemo(() => {
    if (!selectedVariant) return 0;
    return Math.max(...selectedVariant.population_frequencies.map(p => p.af), 0);
  }, [selectedVariant]);

  const minAF = useMemo(() => {
    if (!selectedVariant) return 0;
    const nonZero = selectedVariant.population_frequencies.filter(p => p.af > 0);
    return nonZero.length > 0 ? Math.min(...nonZero.map(p => p.af)) : 0;
  }, [selectedVariant]);

  // Stratification: max/min ratio > 10
  const stratification = useMemo(() => {
    if (minAF === 0 || maxAF === 0) return null;
    const ratio = maxAF / minAF;
    if (ratio < 10) return null;
    const maxPop = selectedVariant?.population_frequencies.find(p => p.af === maxAF);
    const minPop = selectedVariant?.population_frequencies.filter(p => p.af > 0).find(p => p.af === minAF);
    if (!maxPop || !minPop) return null;
    return {
      ratio,
      maxPop: POPULATION_GEO[maxPop.population.toLowerCase()]?.name || maxPop.population,
      maxAF: maxPop.af,
      minPop: POPULATION_GEO[minPop.population.toLowerCase()]?.name || minPop.population,
      minAF: minPop.af,
    };
  }, [maxAF, minAF, selectedVariant]);

  // Sorted bar data
  const barData = useMemo(() => {
    if (!selectedVariant) return [];
    return [...selectedVariant.population_frequencies]
      .filter(p => p.population.toLowerCase() !== 'oth')
      .sort((a, b) => b.af - a.af);
  }, [selectedVariant]);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (tooltipRef.current) {
      tooltipRef.current.style.left = `${e.clientX + 14}px`;
      tooltipRef.current.style.top = `${e.clientY - 10}px`;
    }
  }, []);

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    : ({ children }: { children: React.ReactNode }) => <GlassCard delay={delay}>{children}</GlassCard>;

  if (variantOptions.length === 0) {
    return (
      <Wrapper>
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
            Global Variant Distribution
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Globe className="w-12 h-12 text-text-muted/30 mb-3" />
          <p className="text-text-muted text-sm font-body">
            Population frequency data not available for {geneSymbol} variants
          </p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
              Global Variant Distribution
            </h2>
            <p className="text-text-muted text-xs font-body mt-0.5">
              Population frequencies for{' '}
              <span className="font-mono text-primary">{selectedVariantId}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Variant Selector */}
      <div className="relative mb-5">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full sm:w-auto min-w-[320px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-mono
            bg-ocean-50 border border-ocean-100 text-text-heading
            hover:border-primary/20 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {selectedVariantId}
            {selectedVariant?.clinical_significance && (
              <span className="text-text-muted ml-2 font-body">
                · {selectedVariant.clinical_significance}
              </span>
            )}
            {selectedVariant && (
              <span className="text-text-muted ml-2 font-body">
                · AF {formatAF(selectedVariant.allele_frequency)}
              </span>
            )}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-30 top-full mt-1 left-0 w-full sm:w-[420px] max-h-60 overflow-y-auto
                rounded-lg border border-ocean-100 bg-white shadow-xl"
            >
              {variantOptions.map(v => (
                <button
                  key={v.variant_id}
                  onClick={() => {
                    setSelectedVariantId(v.variant_id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-primary-light transition-colors cursor-pointer
                    ${v.variant_id === selectedVariantId ? 'bg-primary-light text-primary' : 'text-text-heading'}`}
                >
                  <span className="font-mono">{v.variant_id}</span>
                  {v.clinical_significance && (
                    <span className="text-text-muted ml-2 font-body">· {v.clinical_significance}</span>
                  )}
                  <span className="text-text-muted ml-2 font-body">· AF {formatAF(v.allele_frequency)}</span>
                  {v.consequence && (
                    <span className="text-text-muted ml-2 font-body">
                      · {v.consequence.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map — hidden on mobile */}
      <div className="hidden md:block relative">
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 155, center: [10, 10] }}
          style={{ width: '100%', height: 'auto' }}
          viewBox="0 0 800 450"
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#E8EEF4"
                  stroke="#D9E2EC"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#D9E2EC' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Population bubbles */}
          {Object.entries(POPULATION_GEO).map(([popId, geo]) => {
            if (popId === 'oth') return null;
            const pf = popFreqMap.get(popId);
            const af = pf?.af || 0;
            const size = maxAF > 0 ? 6 + (af / maxAF) * 30 : 6;
            const isHighest = af === maxAF && af > 0;
            const isHovered = hoveredPop === popId;

            return (
              <Marker key={popId} coordinates={geo.center}>
                {/* Visible bubble — CSS transition only, no framer re-animation */}
                <circle
                  r={size}
                  fill={af > 0 ? geo.color : '#D9E2EC'}
                  fillOpacity={af > 0 ? (isHovered ? 1 : 0.8) : 0.3}
                  stroke={af > 0 ? geo.color : '#BCCCDC'}
                  strokeWidth={isHovered ? 2.5 : isHighest ? 2 : 1}
                  strokeOpacity={isHovered ? 0.9 : 0.6}
                  style={{
                    transition: 'r 0.4s ease, fill-opacity 0.2s, stroke-width 0.2s',
                    pointerEvents: 'none',
                  }}
                />
                {/* Invisible larger hit-area — stable size, no flicker */}
                <circle
                  r={Math.max(size + 8, 18)}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPop(popId)}
                  onMouseMove={handlePointerMove}
                  onMouseLeave={() => setHoveredPop(null)}
                />
                {/* Label */}
                <text
                  textAnchor="middle"
                  y={size + 12}
                  style={{
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    fontSize: 8,
                    fill: af > 0 ? '#334E68' : '#7B8794',
                    pointerEvents: 'none',
                  }}
                >
                  {geo.name.length > 15 ? popId.toUpperCase() : geo.name}
                </text>
                {af > 0 && (
                  <text
                    textAnchor="middle"
                    y={size + 21}
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 7,
                      fill: geo.color,
                      pointerEvents: 'none',
                    }}
                  >
                    {formatAF(af)}
                  </text>
                )}
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Tooltip — positioned via ref, not state */}
        {hoveredPop && popFreqMap.has(hoveredPop) && (
          <div
            ref={tooltipRef}
            className="fixed z-50 pointer-events-none px-3 py-2.5 rounded-lg
              border border-[#D9E2EC] bg-white
              shadow-lg
              transition-opacity duration-150"
            style={{ left: -9999, top: -9999 }}
          >
            <PopTooltip
              popId={hoveredPop}
              pf={popFreqMap.get(hoveredPop)!}
              globalAF={globalAF}
            />
          </div>
        )}
      </div>

      {/* Population Comparison Bar */}
      <div className="mt-5">
        <h3 className="text-xs font-heading font-semibold text-text-heading uppercase tracking-wider mb-3">
          Population Comparison
        </h3>
        <div className="space-y-2">
          {barData.map((pf, idx) => {
            const popId = pf.population.toLowerCase();
            const geo = POPULATION_GEO[popId];
            const barWidth = maxAF > 0 ? (pf.af / maxAF) * 100 : 0;

            return (
              <div
                key={popId}
                className="flex items-center gap-3"
              >
                <span className="text-text-muted text-xs font-body w-44 shrink-0 truncate">
                  {geo?.name || pf.population}
                </span>
                <div className="flex-1 h-4 bg-ocean-50 rounded-full overflow-hidden relative">
                  {/* Global AF reference line */}
                  {maxAF > 0 && globalAF > 0 && (
                    <div
                      className="absolute top-0 h-full w-px bg-text-muted/40 z-10"
                      style={{ left: `${(globalAF / maxAF) * 100}%` }}
                    />
                  )}
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: geo?.color || '#7B8794' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(barWidth, pf.af > 0 ? 1 : 0)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.04 }}
                  />
                </div>
                <span className="font-mono text-xs text-text-heading w-20 text-right shrink-0">
                  {formatAF(pf.af)}
                </span>
                {/* Mobile: colored dot */}
                <span
                  className="md:hidden w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: geo?.color || '#7B8794' }}
                />
              </div>
            );
          })}
          {barData.length > 0 && globalAF > 0 && (
            <div className="flex items-center gap-3 pt-1 border-t border-ocean-100">
              <span className="text-text-muted text-xs font-body w-44 shrink-0">
                Global Average
              </span>
              <div className="flex-1" />
              <span className="font-mono text-xs text-primary w-20 text-right shrink-0">
                {formatAF(globalAF)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stratification alert */}
      {stratification && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-warning/[0.06] border border-warning/20"
        >
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GlowBadge color="amber">Population-Stratified</GlowBadge>
            </div>
            <p className="text-text-secondary text-xs font-body leading-relaxed">
              This variant shows significant population stratification.
              AF ranges from {formatAF(stratification.minAF)} ({stratification.minPop}) to{' '}
              {formatAF(stratification.maxAF)} ({stratification.maxPop}).
              {stratification.ratio >= 100 && (
                <span className="text-warning">
                  {' '}({Math.round(stratification.ratio)}× difference)
                </span>
              )}
            </p>
          </div>
        </motion.div>
      )}
    </Wrapper>
  );
}

function PopTooltip({
  popId,
  pf,
  globalAF,
}: {
  popId: string;
  pf: PopulationFrequency;
  globalAF: number;
}) {
  const geo = POPULATION_GEO[popId];
  const ratio = globalAF > 0 ? pf.af / globalAF : 0;
  const ratioLabel =
    ratio >= 2
      ? `${ratio.toFixed(1)}× more common`
      : ratio <= 0.5 && ratio > 0
        ? `${(1 / ratio).toFixed(1)}× less common`
        : 'Near global average';

  return (
    <div className="min-w-[180px]">
      <p className="text-xs font-heading font-semibold mb-1.5" style={{ color: geo?.color }}>
        {geo?.name || popId}
      </p>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-4">
          <span className="text-text-muted">Allele Frequency</span>
          <span className="font-mono text-text-heading">{formatAF(pf.af)}</span>
        </div>
        {pf.ac > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Allele Count</span>
            <span className="font-mono text-text-heading">{pf.ac.toLocaleString()} / {pf.an.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-text-muted">vs Global</span>
          <span className="font-mono text-primary">{ratioLabel}</span>
        </div>
        {/* Mini comparison bar */}
        <div className="mt-1.5 pt-1.5 border-t border-ocean-100">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-ocean-50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min((pf.af / Math.max(globalAF * 3, pf.af)) * 100, 100)}%`,
                  backgroundColor: geo?.color || '#7B8794',
                }}
              />
            </div>
            <span className="text-text-muted text-[9px]">Pop</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1.5 bg-ocean-50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{
                  width: `${Math.min((globalAF / Math.max(globalAF * 3, pf.af)) * 100, 100)}%`,
                }}
              />
            </div>
            <span className="text-text-muted text-[9px]">Global</span>
          </div>
        </div>
      </div>
    </div>
  );
}
