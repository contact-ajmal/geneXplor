import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
  Check, AlertTriangle, HelpCircle, X,
} from 'lucide-react';
import type {
  ClinVarVariant, GnomADVariant, UniProtData, ProteinDomain,
} from '../../lib/api';
import GlowBadge from '../ui/GlowBadge';

// ── Types ──

interface VariantImpactSimulatorProps {
  variantId: string;
  clinvarVariants: ClinVarVariant[];
  gnomadVariants: GnomADVariant[];
  protein: UniProtData | null;
  diseases?: { disease_name: string; variant_count: number }[];
  autoPlay?: boolean;
  embedded?: boolean;
  onClose?: () => void;
}

interface ParsedVariant {
  variantId: string;
  title: string;
  significance: string;
  condition: string;
  consequence: string;
  hgvsc: string;
  hgvsp: string;
  position: number;
  af: number;
  ac: number;
  an: number;
  proteinChange: { from: string; position: number; to: string } | null;
  consequenceType: ConsequenceType;
}

type ConsequenceType = 'missense' | 'nonsense' | 'frameshift' | 'splice' | 'synonymous' | 'other';

// ── Constants ──

const STAGES = [
  { id: 'dna', label: 'DNA', icon: '🧬' },
  { id: 'rna', label: 'RNA', icon: '📜' },
  { id: 'protein', label: 'Protein', icon: '🔗' },
  { id: 'structure', label: 'Structure', icon: '🏗️' },
  { id: 'function', label: 'Function', icon: '⚙️' },
  { id: 'clinical', label: 'Clinical', icon: '🏥' },
] as const;

const BASE_COLORS: Record<string, string> = {
  A: '#00ff88', T: '#ff3366', C: '#00d4ff', G: '#ffaa00',
  U: '#ff3366',
};

const AA_THREE_TO_ONE: Record<string, string> = {
  Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C',
  Glu: 'E', Gln: 'Q', Gly: 'G', His: 'H', Ile: 'I',
  Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P',
  Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V',
  Ter: '*',
};

const AA_PROPERTIES: Record<string, { color: string; property: string }> = {
  R: { color: '#4dabf7', property: 'positive' },
  K: { color: '#4dabf7', property: 'positive' },
  H: { color: '#748ffc', property: 'positive' },
  D: { color: '#ff6b6b', property: 'negative' },
  E: { color: '#ff6b6b', property: 'negative' },
  S: { color: '#69db7c', property: 'polar' },
  T: { color: '#69db7c', property: 'polar' },
  N: { color: '#69db7c', property: 'polar' },
  Q: { color: '#69db7c', property: 'polar' },
  C: { color: '#ffd43b', property: 'special' },
  G: { color: '#ffd43b', property: 'special' },
  P: { color: '#ffd43b', property: 'special' },
  A: { color: '#868e96', property: 'nonpolar' },
  V: { color: '#868e96', property: 'nonpolar' },
  I: { color: '#868e96', property: 'nonpolar' },
  L: { color: '#868e96', property: 'nonpolar' },
  M: { color: '#868e96', property: 'nonpolar' },
  F: { color: '#da77f2', property: 'aromatic' },
  W: { color: '#da77f2', property: 'aromatic' },
  Y: { color: '#da77f2', property: 'aromatic' },
  '*': { color: '#ff3366', property: 'stop' },
};

const SPEED_OPTIONS = [0.5, 1, 2] as const;
const STAGE_DURATION = 2000; // ms at 1x speed

// ── Helpers ──

function parseProteinChange(hgvsp: string): { from: string; position: number; to: string } | null {
  const match = hgvsp.match(/p\.([A-Za-z]{3})(\d+)([A-Za-z]{3,})/);
  if (match) return { from: match[1], position: parseInt(match[2], 10), to: match[3] };
  return null;
}

function getConsequenceType(consequence: string): ConsequenceType {
  const c = consequence.toLowerCase();
  if (c.includes('missense')) return 'missense';
  if (c.includes('stop_gained') || c.includes('nonsense')) return 'nonsense';
  if (c.includes('frameshift')) return 'frameshift';
  if (c.includes('splice')) return 'splice';
  if (c.includes('synonymous')) return 'synonymous';
  return 'other';
}

function getSignificanceCategory(sig: string): 'pathogenic' | 'benign' | 'vus' | 'unknown' {
  const s = sig.toLowerCase();
  if (s.includes('pathogenic')) return 'pathogenic';
  if (s.includes('benign')) return 'benign';
  if (s.includes('uncertain') || s.includes('vus')) return 'vus';
  return 'unknown';
}

function generateDNASequence(position: number): { bases: string[]; variantIndex: number } {
  const bases = ['A', 'T', 'G', 'C'];
  const seq: string[] = [];
  // Generate 21 bases centered on variant position
  for (let i = 0; i < 21; i++) {
    seq.push(bases[(position + i) % 4]);
  }
  return { bases: seq, variantIndex: 10 };
}

function complement(base: string): string {
  const map: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
  return map[base] || base;
}

function dnaToRna(base: string): string {
  return base === 'T' ? 'U' : base;
}

// ── Main Component ──

export default function VariantImpactSimulator({
  variantId,
  clinvarVariants,
  gnomadVariants,
  protein,
  diseases = [],
  autoPlay = false,
  embedded = false,
  onClose,
}: VariantImpactSimulatorProps) {
  const [currentStage, setCurrentStage] = useState(-1); // -1 = not started
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [stageAnimPhase, setStageAnimPhase] = useState(0); // 0=entering, 1=highlight, 2=complete
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  // Parse variant data
  const variant = useMemo((): ParsedVariant | null => {
    const cv = clinvarVariants.find(v => v.variant_id === variantId);
    const gv = gnomadVariants.find(v => v.variant_id === variantId);
    if (!cv && !gv) return null;

    const consequence = gv?.consequence || cv?.variant_type || '';
    const hgvsp = gv?.hgvsp || '';

    return {
      variantId,
      title: cv?.title || variantId,
      significance: cv?.clinical_significance || 'Not in ClinVar',
      condition: cv?.condition || '',
      consequence,
      hgvsc: gv?.hgvsc || '',
      hgvsp,
      position: gv?.position || 0,
      af: gv?.allele_frequency || 0,
      ac: gv?.allele_count || 0,
      an: gv?.allele_number || 0,
      proteinChange: hgvsp ? parseProteinChange(hgvsp) : null,
      consequenceType: getConsequenceType(consequence),
    };
  }, [variantId, clinvarVariants, gnomadVariants]);

  // Determine which stages to show based on consequence type
  const activeStages = useMemo(() => {
    if (!variant) return [];
    const ct = variant.consequenceType;
    // All types get DNA + RNA + Protein + Clinical
    // Structure + Function only for protein-altering
    if (ct === 'synonymous') return [0, 1, 2, 5]; // DNA, RNA, Protein (no change), Clinical
    if (ct === 'splice') return [0, 1, 2, 5]; // DNA, RNA (splice disruption), Protein, Clinical
    return [0, 1, 2, 3, 4, 5]; // Full pipeline for missense/nonsense/frameshift
  }, [variant]);

  // Affected domain
  const affectedDomain = useMemo((): ProteinDomain | null => {
    if (!variant?.proteinChange || !protein) return null;
    return protein.domains.find(
      d => variant.proteinChange!.position >= d.start && variant.proteinChange!.position <= d.end
    ) || null;
  }, [variant, protein]);

  // Auto-play on mount if requested
  useEffect(() => {
    if (autoPlay && variant) {
      const t = setTimeout(() => handlePlay(), 500);
      return () => clearTimeout(t);
    }
  }, [autoPlay, variant]);

  // Cleanup timer
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const advanceStage = useCallback(() => {
    setCurrentStage(prev => {
      const currentActiveIdx = activeStages.indexOf(prev);
      const nextIdx = currentActiveIdx + 1;
      if (nextIdx >= activeStages.length) {
        setIsPlaying(false);
        return prev;
      }
      setStageAnimPhase(0);
      return activeStages[nextIdx];
    });
  }, [activeStages]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || currentStage < 0) return;
    const duration = prefersReducedMotion.current ? 100 : STAGE_DURATION / speed;

    // Phase progression: entering(0) -> highlight(1) -> complete(2)
    const phaseTimer = setTimeout(() => {
      setStageAnimPhase(1);
      const highlightTimer = setTimeout(() => {
        setStageAnimPhase(2);
        const completeTimer = setTimeout(() => {
          advanceStage();
        }, duration * 0.3);
        timerRef.current = completeTimer;
      }, duration * 0.4);
      timerRef.current = highlightTimer;
    }, duration * 0.3);
    timerRef.current = phaseTimer;

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, currentStage, speed, advanceStage]);

  const handlePlay = useCallback(() => {
    if (currentStage < 0 || currentStage === activeStages[activeStages.length - 1]) {
      // Start or restart
      setCurrentStage(activeStages[0]);
      setStageAnimPhase(0);
    }
    setIsPlaying(true);
  }, [currentStage, activeStages]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleStepForward = useCallback(() => {
    handlePause();
    const currentActiveIdx = activeStages.indexOf(currentStage);
    if (currentActiveIdx < activeStages.length - 1) {
      setCurrentStage(activeStages[currentActiveIdx + 1]);
      setStageAnimPhase(2);
    }
  }, [currentStage, activeStages, handlePause]);

  const handleStepBack = useCallback(() => {
    handlePause();
    const currentActiveIdx = activeStages.indexOf(currentStage);
    if (currentActiveIdx > 0) {
      setCurrentStage(activeStages[currentActiveIdx - 1]);
      setStageAnimPhase(2);
    }
  }, [currentStage, activeStages, handlePause]);

  const handleReplay = useCallback(() => {
    setCurrentStage(activeStages[0]);
    setStageAnimPhase(0);
    setIsPlaying(true);
  }, [activeStages]);

  const handleStageClick = useCallback((stageIdx: number) => {
    handlePause();
    setCurrentStage(stageIdx);
    setStageAnimPhase(2);
  }, [handlePause]);

  if (!variant) return null;

  const sigCategory = getSignificanceCategory(variant.significance);
  const isComplete = currentStage === activeStages[activeStages.length - 1] && stageAnimPhase === 2;
  const hasStarted = currentStage >= 0;

  return (
    <div className={`${embedded ? '' : 'rounded-2xl border border-cyan/[0.08] glass-bg backdrop-blur-xl p-5'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
            Variant Impact Simulator
          </h3>
          <p className="font-mono text-cyan text-xs mt-0.5">{variant.variantId}</p>
        </div>
        <div className="flex items-center gap-2">
          <GlowBadge color={
            sigCategory === 'pathogenic' ? 'magenta'
            : sigCategory === 'benign' ? 'green'
            : sigCategory === 'vus' ? 'amber' : 'muted'
          }>
            {variant.significance}
          </GlowBadge>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-space-800/60 border border-space-600/30 text-text-secondary hover:text-text-primary hover:border-cyan/20 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stage progress dots */}
      <div className="flex items-center justify-center gap-1 mb-6" role="tablist" aria-label="Simulation stages">
        {STAGES.map((stage, i) => {
          const isActive = activeStages.includes(i);
          if (!isActive) return null;
          const isCurrent = currentStage === i;
          const isPast = activeStages.indexOf(i) < activeStages.indexOf(currentStage);
          return (
            <button
              key={stage.id}
              role="tab"
              aria-selected={isCurrent}
              aria-label={stage.label}
              onClick={() => handleStageClick(i)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body transition-all cursor-pointer
                ${isCurrent
                  ? 'bg-cyan/15 text-cyan border border-cyan/30 shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                  : isPast
                    ? 'bg-space-700/50 text-text-secondary border border-space-600/20'
                    : 'bg-space-800/30 text-text-muted border border-transparent hover:border-space-600/20'
                }
              `}
            >
              <span className="hidden sm:inline">{stage.label}</span>
              {isPast && <Check className="w-3 h-3 text-helix-green" />}
            </button>
          );
        })}
      </div>

      {/* Stage content */}
      <div
        className="relative min-h-[280px] sm:min-h-[320px] flex items-center justify-center"
        role="tabpanel"
        aria-label={hasStarted ? STAGES[currentStage]?.label : 'Not started'}
      >
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <StartScreen key="start" variant={variant} onStart={handlePlay} />
          ) : currentStage === 0 ? (
            <DNAStage key="dna" variant={variant} phase={stageAnimPhase} />
          ) : currentStage === 1 ? (
            <RNAStage key="rna" variant={variant} phase={stageAnimPhase} />
          ) : currentStage === 2 ? (
            <ProteinStage key="protein" variant={variant} protein={protein} phase={stageAnimPhase} />
          ) : currentStage === 3 ? (
            <StructureStage key="structure" variant={variant} sigCategory={sigCategory} phase={stageAnimPhase} />
          ) : currentStage === 4 ? (
            <FunctionStage key="function" variant={variant} affectedDomain={affectedDomain} protein={protein} phase={stageAnimPhase} />
          ) : currentStage === 5 ? (
            <ClinicalStage key="clinical" variant={variant} diseases={diseases} sigCategory={sigCategory} phase={stageAnimPhase} />
          ) : null}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-space-600/20">
        <button
          onClick={handleStepBack}
          disabled={!hasStarted || currentStage === activeStages[0]}
          className="p-2 rounded-lg bg-space-800/50 border border-space-600/30 text-text-secondary hover:text-cyan hover:border-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          aria-label="Previous stage"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {isComplete ? (
          <button
            onClick={handleReplay}
            className="p-3 rounded-full bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 transition-all cursor-pointer shadow-[0_0_16px_rgba(0,212,255,0.1)]"
            aria-label="Replay simulation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className="p-3 rounded-full bg-cyan/10 border border-cyan/30 text-cyan hover:bg-cyan/20 transition-all cursor-pointer shadow-[0_0_16px_rgba(0,212,255,0.1)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
        )}

        <button
          onClick={handleStepForward}
          disabled={!hasStarted || isComplete}
          className="p-2 rounded-lg bg-space-800/50 border border-space-600/30 text-text-secondary hover:text-cyan hover:border-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          aria-label="Next stage"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Speed control */}
        <div className="flex items-center gap-1 ml-4 border-l border-space-600/20 pl-4">
          {SPEED_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-mono cursor-pointer transition-all
                ${speed === s ? 'bg-cyan/15 text-cyan border border-cyan/25' : 'text-text-muted hover:text-text-secondary border border-transparent'}
              `}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Start Screen ──

function StartScreen({ variant, onStart }: { variant: ParsedVariant; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="text-center"
    >
      <div className="mb-6">
        <p className="text-text-secondary font-body text-sm mb-2">
          Simulate the biological impact of
        </p>
        <p className="font-mono text-cyan text-lg">{variant.variantId}</p>
        {variant.hgvsp && (
          <p className="font-mono text-text-muted text-sm mt-1">{variant.hgvsp}</p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-4 mb-6 text-xs text-text-muted font-body">
        <span>DNA → RNA → Protein → Structure → Function → Clinical</span>
      </div>

      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan to-cyan/70 text-space-900 font-body font-semibold text-sm hover:shadow-[0_0_24px_rgba(0,212,255,0.35)] transition-all cursor-pointer"
      >
        <Play className="w-4 h-4" />
        Simulate Impact
      </button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAGE 1: DNA
// ═══════════════════════════════════════════════════════════

function DNAStage({ variant, phase }: { variant: ParsedVariant; phase: number }) {
  const { bases, variantIndex } = useMemo(
    () => generateDNASequence(variant.position || 12345),
    [variant.position]
  );

  // Determine ref and alt bases from hgvsc if possible
  const refBase = variant.hgvsc?.match(/>([ATGC])$/)?.[1] || null;
  const altBase = variant.hgvsc?.match(/([ATGC])>$/)?.[0]?.[0] || null;
  const mutantBase = refBase
    ? (variant.hgvsc?.split('>')[1] || bases[variantIndex])
    : bases[variantIndex] === 'A' ? 'T' : 'A';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-xl mx-auto text-center"
    >
      <h4 className="text-lg font-heading font-semibold text-text-primary mb-1">DNA Level</h4>
      <p className="text-text-muted text-xs font-body mb-6">
        A single base change at position {variant.position > 0 ? variant.position.toLocaleString() : '—'}
      </p>

      {/* DNA double helix visualization */}
      <div className="relative overflow-x-auto pb-2">
        <div className="inline-flex flex-col items-center gap-0.5 min-w-fit mx-auto">
          {/* Sense strand */}
          <div className="flex gap-0.5">
            {bases.map((base, i) => {
              const isVariant = i === variantIndex;
              const showMutant = isVariant && phase >= 1;
              const displayBase = showMutant ? mutantBase : base;
              return (
                <motion.div
                  key={`sense-${i}`}
                  className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center font-mono text-xs font-bold
                    transition-all duration-500
                    ${isVariant && phase >= 1
                      ? 'ring-2 ring-magenta shadow-[0_0_12px_rgba(255,51,102,0.5)] scale-110 z-10'
                      : isVariant && phase === 0
                        ? 'ring-1 ring-cyan/50'
                        : ''
                    }
                  `}
                  style={{
                    backgroundColor: isVariant && phase >= 1
                      ? 'rgba(255,51,102,0.2)'
                      : `${BASE_COLORS[displayBase]}15`,
                    color: isVariant && phase >= 1
                      ? '#ff3366'
                      : BASE_COLORS[displayBase],
                  }}
                  animate={isVariant && phase === 1 ? {
                    scale: [1, 1.2, 1.1],
                  } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {displayBase}
                </motion.div>
              );
            })}
          </div>

          {/* Base pair bonds */}
          <div className="flex gap-0.5">
            {bases.map((_, i) => (
              <div
                key={`bond-${i}`}
                className={`w-7 sm:w-8 flex justify-center ${i === variantIndex && phase >= 1 ? 'text-magenta' : 'text-space-600'}`}
              >
                <span className="text-[10px]">│</span>
              </div>
            ))}
          </div>

          {/* Antisense strand */}
          <div className="flex gap-0.5">
            {bases.map((base, i) => {
              const isVariant = i === variantIndex;
              const comp = complement(isVariant && phase >= 1 ? mutantBase : base);
              return (
                <div
                  key={`anti-${i}`}
                  className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center font-mono text-xs font-bold
                    transition-all duration-500
                    ${isVariant && phase >= 1 ? 'ring-2 ring-magenta/50' : ''}
                  `}
                  style={{
                    backgroundColor: isVariant && phase >= 1
                      ? 'rgba(255,51,102,0.1)'
                      : `${BASE_COLORS[comp]}10`,
                    color: isVariant && phase >= 1
                      ? '#ff3366'
                      : `${BASE_COLORS[comp]}99`,
                  }}
                >
                  {comp}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* HGVS label */}
      {variant.hgvsc && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 1 ? 1 : 0 }}
          className="font-mono text-sm text-magenta mt-4"
        >
          {variant.hgvsc}
        </motion.p>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAGE 2: RNA
// ═══════════════════════════════════════════════════════════

function RNAStage({ variant, phase }: { variant: ParsedVariant; phase: number }) {
  // Generate a codon context
  const { bases } = useMemo(
    () => generateDNASequence(variant.position || 12345),
    [variant.position]
  );

  const normalCodon = bases.slice(9, 12).map(dnaToRna);
  const mutantCodon = [...normalCodon];
  const mutantBase = variant.hgvsc?.split('>')[1];
  if (mutantBase) {
    mutantCodon[1] = dnaToRna(mutantBase);
  } else {
    mutantCodon[1] = mutantCodon[1] === 'U' ? 'A' : 'U';
  }

  const isSplice = variant.consequenceType === 'splice';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-xl mx-auto text-center"
    >
      <h4 className="text-lg font-heading font-semibold text-text-primary mb-1">RNA Level</h4>
      <p className="text-text-muted text-xs font-body mb-6">
        {isSplice
          ? 'This variant disrupts RNA splicing'
          : 'DNA is transcribed into messenger RNA'
        }
      </p>

      {/* mRNA single strand */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <span className="text-text-muted text-xs font-mono">5'</span>
        <div className="flex gap-0.5">
          {bases.map((base, i) => {
            const rnaBase = dnaToRna(base);
            const isCodon = i >= 9 && i < 12;
            return (
              <motion.div
                key={i}
                className={`
                  w-6 h-8 sm:w-7 sm:h-9 rounded-b flex items-center justify-center font-mono text-[11px] font-bold
                  ${isCodon ? 'ring-1 ring-amber/40' : ''}
                `}
                style={{
                  backgroundColor: `${BASE_COLORS[rnaBase]}12`,
                  color: BASE_COLORS[rnaBase],
                }}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                {rnaBase}
              </motion.div>
            );
          })}
        </div>
        <span className="text-text-muted text-xs font-mono">3'</span>
      </div>

      {/* Codon comparison */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0.3 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center gap-6"
      >
        <div className="text-center">
          <p className="text-text-muted text-[10px] font-body mb-1">Normal codon</p>
          <div className="flex gap-0.5 justify-center">
            {normalCodon.map((b, i) => (
              <span
                key={i}
                className="w-8 h-8 rounded flex items-center justify-center font-mono text-sm font-bold"
                style={{
                  backgroundColor: `${BASE_COLORS[b]}20`,
                  color: BASE_COLORS[b],
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        <motion.span
          animate={phase >= 1 ? { x: [0, 4, 0] } : {}}
          transition={{ repeat: phase === 1 ? Infinity : 0, duration: 0.8 }}
          className="text-text-muted text-lg"
        >
          →
        </motion.span>

        <div className="text-center">
          <p className="text-text-muted text-[10px] font-body mb-1">Mutant codon</p>
          <div className="flex gap-0.5 justify-center">
            {mutantCodon.map((b, i) => {
              const changed = b !== normalCodon[i];
              return (
                <span
                  key={i}
                  className={`w-8 h-8 rounded flex items-center justify-center font-mono text-sm font-bold transition-all
                    ${changed && phase >= 1 ? 'ring-2 ring-magenta shadow-[0_0_8px_rgba(255,51,102,0.4)]' : ''}`}
                  style={{
                    backgroundColor: changed && phase >= 1 ? 'rgba(255,51,102,0.15)' : `${BASE_COLORS[b]}20`,
                    color: changed && phase >= 1 ? '#ff3366' : BASE_COLORS[b],
                  }}
                >
                  {b}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>

      {isSplice && phase >= 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 rounded-lg bg-magenta/[0.06] border border-magenta/20"
        >
          <p className="text-magenta text-xs font-body">
            This variant affects a splice site, potentially causing exon skipping or intron retention
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAGE 3: Protein
// ═══════════════════════════════════════════════════════════

function ProteinStage({ variant, protein, phase }: {
  variant: ParsedVariant;
  protein: UniProtData | null;
  phase: number;
}) {
  const pc = variant.proteinChange;
  const fromAA = pc ? (AA_THREE_TO_ONE[pc.from] || pc.from) : '?';
  const toAA = pc ? (AA_THREE_TO_ONE[pc.to] || pc.to) : '?';
  const fromProps = AA_PROPERTIES[fromAA] || { color: '#94a3b8', property: 'unknown' };
  const toProps = AA_PROPERTIES[toAA] || { color: '#94a3b8', property: 'unknown' };

  // Generate simplified amino acid chain
  const chainLength = 15;
  const variantPos = 7; // center
  const aas = useMemo(() => {
    const chain: string[] = [];
    const all = 'ARNDCEQGHILKMFPSTWYV';
    for (let i = 0; i < chainLength; i++) {
      chain.push(all[(variant.position + i) % all.length]);
    }
    if (pc) chain[variantPos] = fromAA;
    return chain;
  }, [variant.position, pc, fromAA]);

  const ct = variant.consequenceType;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-xl mx-auto text-center"
    >
      <h4 className="text-lg font-heading font-semibold text-text-primary mb-1">Protein Level</h4>
      <p className="text-text-muted text-xs font-body mb-6">
        {ct === 'missense' && pc
          ? `Amino acid ${pc.from} becomes ${pc.to} at position ${pc.position}`
          : ct === 'nonsense'
            ? 'A premature stop signal truncates the protein'
            : ct === 'frameshift'
              ? 'The reading frame shifts, scrambling downstream amino acids'
              : ct === 'synonymous'
                ? 'The protein sequence is unchanged'
                : 'The protein may be affected'
        }
      </p>

      {/* Amino acid chain */}
      <div className="flex items-center justify-center gap-1 mb-6 overflow-x-auto pb-2">
        {aas.map((aa, i) => {
          const isVariant = i === variantPos;
          const isDownstream = i > variantPos;
          const props = AA_PROPERTIES[aa] || { color: '#94a3b8', property: 'unknown' };

          // Determine display
          let displayAA = aa;
          let color = props.color;
          let truncated = false;
          let scrambled = false;

          if (isVariant && phase >= 1) {
            if (ct === 'missense') {
              displayAA = toAA;
              color = toProps.color;
            } else if (ct === 'nonsense') {
              displayAA = '*';
              color = '#ff3366';
            } else if (ct === 'frameshift') {
              displayAA = '?';
              color = '#ff3366';
              scrambled = true;
            }
          }

          if (isDownstream && phase >= 1) {
            if (ct === 'nonsense') {
              truncated = true;
            } else if (ct === 'frameshift') {
              displayAA = '?';
              color = '#ff8c00';
              scrambled = true;
            }
          }

          return (
            <motion.div
              key={i}
              className={`
                w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold
                transition-all duration-500 shrink-0
                ${isVariant && phase >= 1 && ct !== 'synonymous'
                  ? 'ring-2 ring-magenta shadow-[0_0_10px_rgba(255,51,102,0.4)] scale-110 z-10'
                  : ''
                }
              `}
              style={{
                backgroundColor: truncated
                  ? 'transparent'
                  : `${color}20`,
                color: truncated ? 'transparent' : color,
                borderStyle: truncated ? 'dashed' : undefined,
                borderWidth: truncated ? 1 : undefined,
                borderColor: truncated ? '#64748b30' : undefined,
                opacity: truncated ? 0.3 : 1,
              }}
              animate={scrambled && phase === 1 ? {
                rotate: [0, 10, -10, 0],
              } : {}}
              transition={{ duration: 0.4 }}
            >
              {truncated ? '' : displayAA}
            </motion.div>
          );
        })}
      </div>

      {/* Amino acid change detail */}
      {pc && ct === 'missense' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 1 ? 1 : 0 }}
          className="flex items-center justify-center gap-4"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold"
              style={{ backgroundColor: `${fromProps.color}25`, color: fromProps.color }}
            >
              {fromAA}
            </div>
            <div>
              <p className="text-text-primary text-xs font-mono">{pc.from}</p>
              <p className="text-text-muted text-[10px] font-body">{fromProps.property}</p>
            </div>
          </div>

          <span className="text-magenta text-lg">→</span>

          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-mono text-sm font-bold"
              style={{ backgroundColor: `${toProps.color}25`, color: toProps.color }}
            >
              {toAA}
            </div>
            <div>
              <p className="text-text-primary text-xs font-mono">{pc.to}</p>
              <p className="text-text-muted text-[10px] font-body">{toProps.property}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* HGVS protein notation */}
      {variant.hgvsp && (
        <p className="font-mono text-xs text-text-muted mt-3">{variant.hgvsp}</p>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAGE 4: Structure
// ═══════════════════════════════════════════════════════════

function StructureStage({ variant, sigCategory, phase }: {
  variant: ParsedVariant;
  sigCategory: string;
  phase: number;
}) {
  const isPathogenic = sigCategory === 'pathogenic';
  const isBenign = sigCategory === 'benign';
  const isVUS = sigCategory === 'vus';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto text-center"
    >
      <h4 className="text-lg font-heading font-semibold text-text-primary mb-1">Protein Structure</h4>
      <p className="text-text-muted text-xs font-body mb-6">
        {isPathogenic
          ? 'This may disrupt the protein\'s 3D structure'
          : isBenign
            ? 'The protein structure is likely unaffected'
            : 'The structural impact is uncertain'
        }
      </p>

      {/* Simplified protein fold SVG */}
      <div className="relative mx-auto w-64 h-48 mb-4">
        <svg viewBox="0 0 260 180" className="w-full h-full">
          {/* Normal protein fold - smooth curves */}
          <motion.path
            d="M30,90 C50,40 80,30 110,50 S150,90 170,70 S210,30 230,60 S250,100 230,120 S190,150 160,130 S120,100 90,120 S50,150 30,130 Z"
            fill="none"
            stroke={isPathogenic && phase >= 1 ? '#ff3366' : isBenign && phase >= 1 ? '#00ff88' : '#00d4ff'}
            strokeWidth={2.5}
            className="transition-all duration-700"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1 }}
          />

          {/* Variant position marker */}
          <motion.circle
            cx={140}
            cy={80}
            r={phase >= 1 ? 8 : 5}
            fill={isPathogenic ? '#ff3366' : isBenign ? '#00ff88' : '#ffaa00'}
            opacity={0.8}
            className="transition-all duration-500"
            animate={phase === 1 ? {
              r: [5, 10, 8],
              opacity: [0.5, 1, 0.8],
            } : {}}
          />

          {/* Disruption effect for pathogenic */}
          {isPathogenic && phase >= 1 && (
            <>
              <motion.path
                d="M120,65 L135,55 M145,55 L160,65"
                stroke="#ff3366"
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0.6] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              />
              {/* Wavy distortion lines */}
              <motion.path
                d="M110,90 Q120,75 130,90 Q140,105 150,90"
                fill="none"
                stroke="#ff3366"
                strokeWidth={1}
                strokeDasharray="3,3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ delay: 0.5 }}
              />
            </>
          )}

          {/* Check mark for benign */}
          {isBenign && phase >= 1 && (
            <motion.path
              d="M125,85 L135,95 L155,70"
              fill="none"
              stroke="#00ff88"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            />
          )}

          {/* Question mark for VUS */}
          {isVUS && phase >= 1 && (
            <motion.text
              x={136}
              y={88}
              textAnchor="middle"
              className="font-bold text-2xl"
              fill="#ffaa00"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.8, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              ?
            </motion.text>
          )}
        </svg>
      </div>

      {/* Impact indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        className="flex items-center justify-center gap-2"
      >
        {isPathogenic ? (
          <GlowBadge color="magenta" pulse>
            <AlertTriangle className="w-3 h-3" /> Structural disruption likely
          </GlowBadge>
        ) : isBenign ? (
          <GlowBadge color="green">
            <Check className="w-3 h-3" /> Structure maintained
          </GlowBadge>
        ) : (
          <GlowBadge color="amber">
            <HelpCircle className="w-3 h-3" /> Uncertain impact
          </GlowBadge>
        )}
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAGE 5: Function
// ═══════════════════════════════════════════════════════════

function FunctionStage({ variant, affectedDomain, protein, phase }: {
  variant: ParsedVariant;
  affectedDomain: ProteinDomain | null;
  protein: UniProtData | null;
  phase: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-xl mx-auto text-center"
    >
      <h4 className="text-lg font-heading font-semibold text-text-primary mb-1">Functional Impact</h4>
      <p className="text-text-muted text-xs font-body mb-6">
        {affectedDomain
          ? `This variant affects the ${affectedDomain.name} domain`
          : 'Assessing impact on protein function'
        }
      </p>

      {/* Domain diagram */}
      {protein && protein.domains.length > 0 && (
        <div className="mb-6">
          <div className="relative h-10 bg-space-700/50 rounded-full overflow-hidden border border-space-600/20 mx-auto max-w-lg">
            {protein.domains.map((domain, i) => {
              const start = (domain.start / protein.protein_length) * 100;
              const width = ((domain.end - domain.start) / protein.protein_length) * 100;
              const colors = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#748ffc', '#da77f2'];
              const isAffected = affectedDomain && domain.name === affectedDomain.name;
              return (
                <motion.div
                  key={i}
                  className={`absolute top-0 h-full rounded-full transition-all duration-500
                    ${isAffected && phase >= 1 ? 'ring-2 ring-magenta z-10' : ''}
                  `}
                  style={{
                    left: `${start}%`,
                    width: `${Math.max(width, 2)}%`,
                    backgroundColor: isAffected && phase >= 1
                      ? 'rgba(255,51,102,0.4)'
                      : `${colors[i % colors.length]}50`,
                  }}
                  title={domain.name}
                />
              );
            })}

            {/* Variant position marker */}
            {variant.proteinChange && (
              <motion.div
                className="absolute top-0 h-full w-1 bg-magenta shadow-[0_0_8px_rgba(255,51,102,0.6)]"
                style={{
                  left: `${(variant.proteinChange.position / protein.protein_length) * 100}%`,
                }}
                animate={phase === 1 ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
                transition={{ repeat: phase === 1 ? Infinity : 0, duration: 0.8 }}
              />
            )}
          </div>

          {/* Domain labels */}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {protein.domains.slice(0, 5).map((domain, i) => {
              const colors = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#748ffc', '#da77f2'];
              const isAffected = affectedDomain && domain.name === affectedDomain.name;
              return (
                <span
                  key={i}
                  className={`flex items-center gap-1 text-[10px] font-mono transition-all
                    ${isAffected && phase >= 1 ? 'text-magenta font-bold' : 'text-text-muted'}
                  `}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isAffected && phase >= 1 ? '#ff3366' : colors[i % colors.length] }}
                  />
                  {domain.name.length > 18 ? domain.name.slice(0, 18) + '...' : domain.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Affected domain detail */}
      {affectedDomain && phase >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-magenta/[0.06] border border-magenta/20 max-w-lg mx-auto"
        >
          <p className="text-text-primary font-body text-sm">
            This variant affects the <span className="font-mono text-magenta font-semibold">{affectedDomain.name}</span> domain
            {affectedDomain.description && (
              <>, which is responsible for <span className="text-text-secondary">{affectedDomain.description.toLowerCase()}</span></>
            )}
          </p>
          <p className="text-text-muted text-xs font-mono mt-1">
            Domain region: {affectedDomain.start}–{affectedDomain.end}
          </p>
        </motion.div>
      )}

      {!affectedDomain && phase >= 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-space-700/30 border border-space-600/20 max-w-lg mx-auto"
        >
          <p className="text-text-secondary font-body text-sm">
            This variant is not located within a known protein domain, but may still affect protein function
            through other mechanisms.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAGE 6: Clinical
// ═══════════════════════════════════════════════════════════

function ClinicalStage({ variant, diseases, sigCategory, phase }: {
  variant: ParsedVariant;
  diseases: { disease_name: string; variant_count: number }[];
  sigCategory: string;
  phase: number;
}) {
  // Find diseases associated with this variant
  const relatedDiseases = useMemo(() => {
    if (!variant.condition) return diseases.slice(0, 3);
    const conditionLower = variant.condition.toLowerCase();
    const matched = diseases.filter(d =>
      conditionLower.includes(d.disease_name.toLowerCase()) ||
      d.disease_name.toLowerCase().includes(conditionLower)
    );
    return matched.length > 0 ? matched.slice(0, 3) : diseases.slice(0, 3);
  }, [variant.condition, diseases]);

  const afDisplay = variant.af > 0
    ? variant.af < 0.001
      ? variant.af.toExponential(2)
      : (variant.af * 100).toFixed(3) + '%'
    : null;

  const oneInN = variant.af > 0 ? Math.round(1 / variant.af) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-xl mx-auto text-center"
    >
      <h4 className="text-lg font-heading font-semibold text-text-primary mb-1">Clinical Outcome</h4>
      <p className="text-text-muted text-xs font-body mb-6">
        What this variant means for health
      </p>

      {/* Significance badge - large */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-6"
      >
        <GlowBadge
          color={
            sigCategory === 'pathogenic' ? 'magenta'
            : sigCategory === 'benign' ? 'green'
            : sigCategory === 'vus' ? 'amber' : 'muted'
          }
          pulse={sigCategory === 'pathogenic'}
          className="text-sm px-5 py-2"
        >
          {variant.significance}
        </GlowBadge>
      </motion.div>

      {/* Disease cards */}
      {relatedDiseases.length > 0 && phase >= 1 && (
        <div className="space-y-2 mb-6 max-w-md mx-auto">
          {relatedDiseases.map((disease, i) => (
            <motion.div
              key={disease.disease_name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="p-3 rounded-xl bg-space-700/30 border border-space-600/20 text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-magenta shrink-0" />
                <p className="font-body text-sm text-text-primary">{disease.disease_name}</p>
              </div>
              <p className="text-text-muted text-xs font-body mt-0.5 ml-3.5">
                {disease.variant_count} variant{disease.variant_count !== 1 ? 's' : ''} linked
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Condition from ClinVar */}
      {variant.condition && !relatedDiseases.length && phase >= 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 p-3 rounded-xl bg-space-700/30 border border-space-600/20 max-w-md mx-auto"
        >
          <p className="font-body text-sm text-text-primary">{variant.condition}</p>
        </motion.div>
      )}

      {/* Population frequency context */}
      {phase >= 1 && afDisplay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-1"
        >
          <p className="text-text-secondary text-sm font-body">
            This variant is found in <span className="font-mono text-cyan">{afDisplay}</span> of the population
          </p>
          {oneInN && oneInN < 10000000 && (
            <p className="text-text-muted text-xs font-body">
              Approximately <span className="font-mono text-text-secondary">1 in {oneInN.toLocaleString()}</span> people carry this variant
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
