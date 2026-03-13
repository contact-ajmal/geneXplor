import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowDown, ChevronRight, BookOpen,
  LayoutDashboard, ExternalLink, Share2, AlertTriangle,
} from 'lucide-react';
import { fetchGene } from '../lib/api';
import type {
  GeneDashboardResponse, EnsemblGeneData, UniProtData,
  ClinVarData, GnomADData, PubMedData, InteractionData,
  DiseaseAssociation, GnomADVariant, PopulationFrequency,
} from '../lib/api';
import DecodeText from '../components/ui/DecodeText';
import GlowBadge from '../components/ui/GlowBadge';
import AnimatedButton from '../components/ui/AnimatedButton';
import CountUp from '../components/ui/CountUp';
import WatchButton from '../components/gene/WatchButton';
import LoadingPage from './LoadingPage';

const PopulationMap = lazy(() => import('../components/viz/PopulationMap'));
const VariantImpactSimulator = lazy(() => import('../components/viz/VariantImpactSimulator'));

// ── Plain language helpers ──

function biotypeToPlain(biotype: string): string {
  const map: Record<string, string> = {
    protein_coding: 'a protein-coding gene',
    lncRNA: 'a long non-coding RNA gene',
    miRNA: 'a microRNA gene',
    snRNA: 'a small nuclear RNA gene',
    snoRNA: 'a small nucleolar RNA gene',
    rRNA: 'a ribosomal RNA gene',
    pseudogene: 'a pseudogene',
    processed_pseudogene: 'a processed pseudogene',
  };
  return map[biotype] || `a ${biotype.replace(/_/g, ' ')} gene`;
}

function significanceToPlain(sig: string): string {
  const map: Record<string, string> = {
    'Pathogenic': 'known to cause disease',
    'Likely pathogenic': 'likely to cause disease',
    'Uncertain significance': 'of uncertain significance',
    'Likely benign': 'likely harmless',
    'Benign': 'harmless',
    'Pathogenic/Likely pathogenic': 'known or likely to cause disease',
  };
  return map[sig] || sig.toLowerCase();
}

function consequenceToPlain(consequence: string): string {
  const map: Record<string, string> = {
    missense_variant: 'changes one amino acid in the protein',
    nonsense_variant: 'creates a premature stop signal',
    frameshift_variant: 'shifts the reading frame of the protein',
    splice_variant: 'affects how the gene is spliced together',
    synonymous_variant: 'does not change the protein sequence',
    stop_gained: 'creates a premature stop signal',
    stop_lost: 'removes the stop signal',
    start_lost: 'removes the start signal',
    inframe_deletion: 'removes amino acids from the protein',
    inframe_insertion: 'inserts amino acids into the protein',
  };
  return map[consequence] || consequence.replace(/_/g, ' ');
}

function getPathogenicCount(variants: ClinVarData): number {
  return variants.variants.filter(v =>
    v.clinical_significance.toLowerCase().includes('pathogenic')
  ).length;
}

function getSignificanceDistribution(variants: ClinVarData): { label: string; count: number; color: string }[] {
  const counts: Record<string, number> = {};
  for (const v of variants.variants) {
    const sig = v.clinical_significance;
    counts[sig] = (counts[sig] || 0) + 1;
  }
  const colorMap: Record<string, string> = {
    'Pathogenic': '#ff3366',
    'Likely pathogenic': '#ff8c00',
    'Uncertain significance': '#ffaa00',
    'Likely benign': '#00d4ff',
    'Benign': '#00ff88',
    'Pathogenic/Likely pathogenic': '#ff3366',
  };
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, color: colorMap[label] || '#94a3b8' }))
    .sort((a, b) => b.count - a.count);
}

function getMostStratifiedVariant(gnomadVariants: GnomADVariant[]): GnomADVariant | null {
  let best: GnomADVariant | null = null;
  let bestRatio = 0;
  for (const v of gnomadVariants) {
    if (v.population_frequencies.length < 2) continue;
    const afs = v.population_frequencies.filter(p => p.af > 0).map(p => p.af);
    if (afs.length < 2) continue;
    const ratio = Math.max(...afs) / Math.min(...afs);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = v;
    }
  }
  return best;
}

const POP_NAMES: Record<string, string> = {
  afr: 'African/African American',
  amr: 'Latino/Admixed American',
  asj: 'Ashkenazi Jewish',
  eas: 'East Asian',
  fin: 'Finnish',
  nfe: 'Non-Finnish European',
  sas: 'South Asian',
  mid: 'Middle Eastern',
  ami: 'Amish',
  remaining: 'Remaining',
};

// ── Chapter components ──

interface ChapterProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function Chapter({ id, children, className = '' }: ChapterProps) {
  return (
    <section
      id={id}
      className={`min-h-screen flex flex-col justify-center py-20 px-6 ${className}`}
    >
      {children}
    </section>
  );
}

function useChapterInView(id: string, setActive: (id: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(id); },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, setActive]);
  return ref;
}

// ── Animated donut chart ──

function DonutChart({ segments, size = 200 }: {
  segments: { label: string; count: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {segments.map((seg, i) => {
        const fraction = seg.count / total;
        const dashLength = circumference * fraction;
        const offset = circumference * accumulated;
        accumulated += fraction;
        return (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={20}
            strokeDasharray={`${visible ? dashLength : 0} ${circumference}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: `stroke-dasharray 1s ease-out ${i * 0.15}s`,
              filter: seg.label.toLowerCase().includes('pathogenic') && !seg.label.toLowerCase().includes('benign')
                ? 'drop-shadow(0 0 6px rgba(255,51,102,0.5))' : undefined,
            }}
          />
        );
      })}
      <text x={size / 2} y={size / 2 - 8} textAnchor="middle" className="fill-text-primary font-mono text-2xl font-bold">
        {total.toLocaleString()}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="fill-text-secondary text-xs font-body">
        total variants
      </text>
    </svg>
  );
}

// ── Scroll progress bar ──

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  return (
    <motion.div
      className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-cyan to-magenta z-50"
      style={{ width }}
    />
  );
}

// ── Scroll-spy dots ──

const CHAPTERS = [
  { id: 'hero', label: 'Introduction' },
  { id: 'function', label: 'Function' },
  { id: 'variants', label: 'Variants' },
  { id: 'population', label: 'Population' },
  { id: 'research', label: 'Research' },
  { id: 'network', label: 'Network' },
  { id: 'explore', label: 'Explore More' },
];

function ScrollSpy({ activeChapter, chapters }: { activeChapter: string; chapters: typeof CHAPTERS }) {
  return (
    <nav className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-3" aria-label="Story navigation">
      {chapters.map(ch => (
        <a
          key={ch.id}
          href={`#${ch.id}`}
          className="group flex items-center gap-2"
          title={ch.label}
        >
          <span className={`
            block w-2.5 h-2.5 rounded-full border transition-all duration-300
            ${activeChapter === ch.id
              ? 'bg-cyan border-cyan shadow-[0_0_8px_rgba(0,212,255,0.5)] scale-125'
              : 'border-text-muted/30 hover:border-cyan/50'
            }
          `} />
          <span className={`
            text-xs font-body opacity-0 group-hover:opacity-100 transition-opacity duration-200
            ${activeChapter === ch.id ? 'text-cyan' : 'text-text-muted'}
          `}>
            {ch.label}
          </span>
        </a>
      ))}
    </nav>
  );
}

// ── Mode toggle ──

function ModeToggle({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-space-600/60 p-1 bg-space-800/60 backdrop-blur-sm">
      <Link
        to={`/gene/${symbol}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body text-text-secondary hover:text-text-primary transition-colors"
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        Dashboard
      </Link>
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body bg-cyan/10 text-cyan border border-cyan/20">
        <BookOpen className="w-3.5 h-3.5" />
        Story
      </span>
    </div>
  );
}

// ── Population frequency bar chart (fallback for small data) ──

function PopulationBars({ variant }: { variant: GnomADVariant }) {
  const sorted = [...variant.population_frequencies]
    .filter(p => p.af > 0)
    .sort((a, b) => b.af - a.af);
  const maxAf = sorted[0]?.af || 1;

  const popColors: Record<string, string> = {
    afr: '#ff6b6b', amr: '#ffa94d', asj: '#748ffc', eas: '#ffd43b',
    fin: '#69db7c', nfe: '#4dabf7', sas: '#da77f2', mid: '#e599f7',
    ami: '#38d9a9', remaining: '#94a3b8',
  };

  return (
    <div className="space-y-2 max-w-lg mx-auto">
      {sorted.map(p => (
        <div key={p.population} className="flex items-center gap-3">
          <span className="text-xs font-mono text-text-muted w-28 text-right shrink-0">
            {POP_NAMES[p.population] || p.population}
          </span>
          <div className="flex-1 h-5 bg-space-700/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              whileInView={{ width: `${(p.af / maxAf) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ backgroundColor: popColors[p.population] || '#94a3b8' }}
            />
          </div>
          <span className="text-xs font-mono text-text-secondary w-16 shrink-0">
            {(p.af * 100).toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ──

export default function GeneStoryPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const upperSymbol = symbol?.toUpperCase() || '';
  const [activeChapter, setActiveChapter] = useState('hero');

  const { data, isLoading, error } = useQuery<GeneDashboardResponse, Error>({
    queryKey: ['gene', upperSymbol],
    queryFn: () => fetchGene(upperSymbol),
    enabled: upperSymbol.length > 0,
  });

  // Determine which chapters are available
  const availableChapters = useMemo(() => {
    if (!data) return CHAPTERS.filter(c => c.id === 'hero');
    const chs = [CHAPTERS[0], CHAPTERS[1]]; // hero, function always present
    if (data.variants && data.variants.variants.length > 0) chs.push(CHAPTERS[2]); // variants
    if (data.allele_frequencies && data.allele_frequencies.variants.length > 0) chs.push(CHAPTERS[3]); // population
    if (data.publications && data.publications.articles.length > 0) chs.push(CHAPTERS[4]); // research
    if (data.interactions && data.interactions.interactions.length > 0) chs.push(CHAPTERS[5]); // network
    chs.push(CHAPTERS[6]); // explore always present
    return chs;
  }, [data]);

  if (isLoading) return <LoadingPage symbol={upperSymbol} />;

  if (error || !data?.gene) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <AlertTriangle className="w-16 h-16 text-magenta/40 mx-auto mb-6" />
          <h2 className="text-lg font-heading font-semibold text-text-primary mb-2">Gene not found</h2>
          <p className="text-text-secondary text-sm font-body mb-6">
            Could not find a story for <span className="font-mono text-cyan">{upperSymbol}</span>.
          </p>
          <Link to="/">
            <AnimatedButton variant="primary">Back to search</AnimatedButton>
          </Link>
        </motion.div>
      </div>
    );
  }

  const { gene, protein, variants, allele_frequencies, publications, interactions } = data;

  return (
    <article className="relative">
      {/* Scroll progress bar */}
      <ScrollProgress />

      {/* Scroll spy navigation */}
      <ScrollSpy activeChapter={activeChapter} chapters={availableChapters} />

      {/* Top bar: Back + Mode toggle */}
      <div className="fixed top-16 left-0 right-0 z-30 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(`/gene/${upperSymbol}`)}
          className="flex items-center gap-2 text-text-secondary hover:text-cyan transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-body">Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          <WatchButton symbol={upperSymbol} size="sm" />
          <ModeToggle symbol={upperSymbol} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          CHAPTER 1 — "Meet {Gene}"
         ═══════════════════════════════════════════════ */}
      <HeroChapter gene={gene} setActive={setActiveChapter} />

      {/* ═══════════════════════════════════════════════
          CHAPTER 2 — "What Does It Do?"
         ═══════════════════════════════════════════════ */}
      <FunctionChapter gene={gene} protein={protein} setActive={setActiveChapter} />

      {/* ═══════════════════════════════════════════════
          CHAPTER 3 — "What Can Go Wrong?"
         ═══════════════════════════════════════════════ */}
      {variants && variants.variants.length > 0 && (
        <VariantsChapter
          gene={gene}
          variants={variants}
          gnomadVariants={allele_frequencies?.variants || []}
          protein={protein}
          setActive={setActiveChapter}
        />
      )}

      {/* ═══════════════════════════════════════════════
          CHAPTER 4 — "Where in the World?"
         ═══════════════════════════════════════════════ */}
      {allele_frequencies && allele_frequencies.variants.length > 0 && (
        <PopulationChapter
          gene={gene}
          gnomadVariants={allele_frequencies.variants}
          clinvarVariants={variants?.variants || []}
          setActive={setActiveChapter}
        />
      )}

      {/* ═══════════════════════════════════════════════
          CHAPTER 5 — "The Research Story"
         ═══════════════════════════════════════════════ */}
      {publications && publications.articles.length > 0 && (
        <ResearchChapter
          gene={gene}
          publications={publications}
          timeline={variants?.timeline || null}
          setActive={setActiveChapter}
        />
      )}

      {/* ═══════════════════════════════════════════════
          CHAPTER 6 — "Connected Genes"
         ═══════════════════════════════════════════════ */}
      {interactions && interactions.interactions.length > 0 && (
        <NetworkChapter
          gene={gene}
          interactions={interactions}
          setActive={setActiveChapter}
        />
      )}

      {/* ═══════════════════════════════════════════════
          CHAPTER 7 — "Explore Further"
         ═══════════════════════════════════════════════ */}
      <ExploreChapter gene={gene} setActive={setActiveChapter} />
    </article>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 1: Hero
// ═══════════════════════════════════════════════════════════

function HeroChapter({ gene, setActive }: { gene: EnsemblGeneData; setActive: (id: string) => void }) {
  const ref = useChapterInView('hero', setActive);
  const { scrollYProgress } = useScroll();
  const helixY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);

  return (
    <section id="hero" ref={ref} className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Parallax DNA helix background */}
      <motion.div
        style={{ y: helixY }}
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
      >
        <svg viewBox="0 0 200 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 20 }).map((_, i) => {
            const y = i * 30;
            const x1 = 100 + Math.sin(i * 0.5) * 40;
            const x2 = 100 - Math.sin(i * 0.5) * 40;
            return (
              <g key={i}>
                <circle cx={x1} cy={y} r={3} fill="#00d4ff" opacity={0.6} />
                <circle cx={x2} cy={y} r={3} fill="#ff3366" opacity={0.6} />
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="#00d4ff" strokeWidth={0.5} opacity={0.3} />
              </g>
            );
          })}
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center relative z-10"
      >
        {/* Gene symbol - massive */}
        <h1 className="text-[100px] sm:text-[130px] md:text-[160px] font-mono font-bold leading-none mb-4">
          <DecodeText text={gene.gene_symbol} className="text-cyan" speed={30} />
        </h1>

        {/* Gene name */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-2xl sm:text-3xl md:text-4xl font-body text-text-primary mb-6"
        >
          {gene.gene_name || gene.description}
        </motion.p>

        {/* Chromosome badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-3"
        >
          <GlowBadge color="cyan" className="text-sm">
            Chromosome {gene.chromosome}
          </GlowBadge>
          <GlowBadge color={gene.strand === 1 ? 'green' : 'amber'} className="text-sm">
            {gene.strand === 1 ? '+' : '-'} strand
          </GlowBadge>
          <GlowBadge color="muted" className="text-sm">
            {gene.biotype.replace(/_/g, ' ')}
          </GlowBadge>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-12 flex flex-col items-center gap-2"
      >
        <span className="text-text-muted text-sm font-body">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        >
          <ArrowDown className="w-5 h-5 text-cyan/60" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 2: Function
// ═══════════════════════════════════════════════════════════

function FunctionChapter({ gene, protein, setActive }: {
  gene: EnsemblGeneData;
  protein: UniProtData | null;
  setActive: (id: string) => void;
}) {
  const ref = useChapterInView('function', setActive);

  const description = protein?.function_description || gene.description || '';
  const plainBiotype = biotypeToPlain(gene.biotype);
  const geneLength = gene.end - gene.start;

  return (
    <section id="function" ref={ref} className="min-h-screen flex items-center py-20 px-6">
      <div className="max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
        {/* Left: Chromosome illustration */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center"
        >
          {/* Simple chromosome ideogram */}
          <div className="relative w-16 h-64 mx-auto">
            {/* Chromosome body */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-space-600 via-space-700 to-space-600 border border-space-500/30" />
            {/* Centromere pinch */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-3 bg-space-800 rounded-full" />
            {/* Gene position marker */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 w-20 h-2 bg-cyan rounded-full shadow-[0_0_12px_rgba(0,212,255,0.6)]"
              style={{ top: `${30 + ((gene.start % 1000000) / 1000000) * 40}%` }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
          <p className="text-center text-text-muted text-xs font-mono mt-4">
            chr{gene.chromosome}:{gene.start.toLocaleString()}-{gene.end.toLocaleString()}
          </p>
        </motion.div>

        {/* Right: Text content */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-6">
            What Does It Do?
          </h2>

          <p className="text-text-secondary font-body text-lg leading-relaxed mb-6">
            <span className="font-mono text-cyan">{gene.gene_symbol}</span> is {plainBiotype} located
            on <span className="text-cyan">chromosome {gene.chromosome}</span>.
            {description && (
              <> {description.endsWith('.') ? description : `${description}.`}</>
            )}
          </p>

          {/* Stats that count up */}
          <div className="grid grid-cols-3 gap-4">
            {protein && (
              <div className="text-center p-4 rounded-xl bg-space-700/30 border border-space-600/20">
                <CountUp
                  end={protein.protein_length}
                  className="text-2xl font-mono font-bold text-cyan"
                  formatter={(n) => Math.round(n).toLocaleString()}
                />
                <p className="text-text-muted text-xs font-body mt-1">amino acids</p>
              </div>
            )}
            <div className="text-center p-4 rounded-xl bg-space-700/30 border border-space-600/20">
              <span className="text-2xl font-mono font-bold text-cyan">{gene.chromosome}</span>
              <p className="text-text-muted text-xs font-body mt-1">chromosome</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-space-700/30 border border-space-600/20">
              <CountUp
                end={gene.transcript_count}
                className="text-2xl font-mono font-bold text-cyan"
                formatter={(n) => Math.round(n).toLocaleString()}
              />
              <p className="text-text-muted text-xs font-body mt-1">transcripts</p>
            </div>
          </div>

          {/* Simplified protein domain bar */}
          {protein && protein.domains.length > 0 && (
            <div className="mt-6">
              <p className="text-text-muted text-xs font-body mb-2">Protein domains</p>
              <div className="relative h-6 bg-space-700/50 rounded-full overflow-hidden border border-space-600/20">
                {protein.domains.map((domain, i) => {
                  const start = (domain.start / protein.protein_length) * 100;
                  const width = ((domain.end - domain.start) / protein.protein_length) * 100;
                  const colors = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#748ffc', '#da77f2'];
                  return (
                    <motion.div
                      key={i}
                      className="absolute top-0 h-full rounded-full"
                      style={{
                        left: `${start}%`,
                        width: `${Math.max(width, 1)}%`,
                        backgroundColor: colors[i % colors.length],
                        opacity: 0.7,
                      }}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                      title={domain.name}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {protein.domains.slice(0, 4).map((domain, i) => {
                  const colors = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#748ffc', '#da77f2'];
                  return (
                    <span key={i} className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                      {domain.name.length > 20 ? domain.name.slice(0, 20) + '...' : domain.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 3: Variants
// ═══════════════════════════════════════════════════════════

function VariantsChapter({ gene, variants, gnomadVariants, protein, setActive }: {
  gene: EnsemblGeneData;
  variants: ClinVarData;
  gnomadVariants: GnomADVariant[];
  protein: UniProtData | null;
  setActive: (id: string) => void;
}) {
  const ref = useChapterInView('variants', setActive);
  const pathogenicCount = getPathogenicCount(variants);
  const distribution = getSignificanceDistribution(variants);
  const topDiseases = variants.diseases.slice(0, 5);
  const remainingDiseases = variants.diseases.length - 5;

  // Find top pathogenic variant for the simulator
  const topPathogenicVariant = useMemo(() => {
    return variants.variants.find(v =>
      v.clinical_significance.toLowerCase().includes('pathogenic') &&
      !v.clinical_significance.toLowerCase().includes('likely')
    ) || variants.variants.find(v =>
      v.clinical_significance.toLowerCase().includes('pathogenic')
    ) || null;
  }, [variants]);

  return (
    <section
      id="variants"
      ref={ref}
      className="min-h-screen flex items-center py-20 px-6 relative"
    >
      {/* Subtle red tint overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-magenta/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-4 text-center">
            What Can Go Wrong?
          </h2>

          {/* Dramatic variant counter */}
          <p className="text-center text-text-secondary font-body text-lg mb-10">
            Scientists have found{' '}
            <span className="inline-block">
              <CountUp
                end={variants.variants.length}
                className="font-mono font-bold text-cyan text-3xl"
                formatter={(n) => Math.round(n).toLocaleString()}
              />
            </span>
            {' '}variants in <span className="font-mono text-cyan">{gene.gene_symbol}</span>
          </p>

          {/* Donut + pathogenic callout */}
          <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
            <DonutChart segments={distribution} size={220} />
            <div>
              {pathogenicCount > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="text-magenta text-xl font-body font-semibold mb-4"
                >
                  <CountUp
                    end={pathogenicCount}
                    className="font-mono text-3xl"
                    formatter={(n) => Math.round(n).toLocaleString()}
                  />
                  {' '}are {significanceToPlain('Pathogenic')}
                </motion.p>
              )}
              <div className="space-y-2">
                {distribution.map(seg => (
                  <div key={seg.label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <span className="text-sm font-body text-text-secondary flex-1">{seg.label}</span>
                    <span className="text-sm font-mono text-text-muted">{seg.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Disease cards */}
          {topDiseases.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-heading font-semibold text-text-primary mb-4">
                Associated Conditions
              </h3>
              {topDiseases.map((disease, i) => (
                <motion.div
                  key={disease.disease_name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="p-4 rounded-xl bg-space-700/30 border border-space-600/20 hover:border-magenta/20 transition-colors"
                >
                  <p className="font-body font-semibold text-text-primary text-lg">
                    {disease.disease_name}
                  </p>
                  <p className="text-text-muted text-sm font-body mt-1">
                    Linked to{' '}
                    <span className="font-mono text-magenta">{disease.variant_count}</span>
                    {' '}variant{disease.variant_count !== 1 ? 's' : ''} in this gene
                  </p>
                </motion.div>
              ))}
              {remainingDiseases > 0 && (
                <p className="text-text-muted text-sm font-body text-center mt-4">
                  and <span className="font-mono text-text-secondary">{remainingDiseases}</span> more condition{remainingDiseases !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Variant Impact Simulator for top pathogenic variant */}
          {topPathogenicVariant && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-10"
            >
              <Suspense fallback={
                <div className="h-[400px] rounded-2xl skeleton-shimmer" />
              }>
                <VariantImpactSimulator
                  variantId={topPathogenicVariant.variant_id}
                  clinvarVariants={variants.variants}
                  gnomadVariants={gnomadVariants}
                  protein={protein}
                  diseases={variants.diseases}
                  autoPlay
                  embedded={false}
                />
              </Suspense>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 4: Population
// ═══════════════════════════════════════════════════════════

function PopulationChapter({ gene, gnomadVariants, clinvarVariants, setActive }: {
  gene: EnsemblGeneData;
  gnomadVariants: GnomADVariant[];
  clinvarVariants: ClinVarData['variants'];
  setActive: (id: string) => void;
}) {
  const ref = useChapterInView('population', setActive);
  const stratifiedVariant = getMostStratifiedVariant(gnomadVariants);

  // Build narrative for most stratified variant
  let narrative: React.ReactNode = null;
  if (stratifiedVariant) {
    const pops = [...stratifiedVariant.population_frequencies]
      .filter(p => p.af > 0)
      .sort((a, b) => b.af - a.af);
    if (pops.length >= 2) {
      const highest = pops[0];
      const lowest = pops[pops.length - 1];
      narrative = (
        <p className="text-text-secondary font-body text-lg leading-relaxed mb-8 text-center max-w-2xl mx-auto">
          The <span className="font-mono text-cyan">{stratifiedVariant.variant_id}</span> variant
          is found in <span className="font-mono text-cyan">{(highest.af * 100).toFixed(2)}%</span> of{' '}
          <span className="text-text-primary">{POP_NAMES[highest.population] || highest.population}</span> people,
          but only <span className="font-mono text-cyan">{(lowest.af * 100).toFixed(4)}%</span> of{' '}
          <span className="text-text-primary">{POP_NAMES[lowest.population] || lowest.population}</span> people.
        </p>
      );
    }
  }

  return (
    <section id="population" ref={ref} className="min-h-screen flex items-center py-20 px-6">
      <div className="max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-4 text-center">
            Where in the World?
          </h2>

          <p className="text-text-secondary font-body text-center mb-8">
            How variant frequencies differ across populations
          </p>

          {narrative}

          {/* Population map or bar chart fallback */}
          <div className="rounded-2xl border border-cyan/[0.08] p-4 glass-bg backdrop-blur-xl">
            <Suspense
              fallback={
                <div className="h-[400px] flex items-center justify-center">
                  <div className="h-5 w-48 rounded skeleton-shimmer" />
                </div>
              }
            >
              <PopulationMap
                gnomadVariants={gnomadVariants}
                clinvarVariants={clinvarVariants}
                geneSymbol={gene.gene_symbol}
                delay={0}
              />
            </Suspense>
          </div>

          <p className="text-text-muted text-xs font-body text-center mt-4 max-w-xl mx-auto">
            Differences in variant frequencies across populations can result from founder effects,
            natural selection, genetic drift, or differences in sample sizes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 5: Research
// ═══════════════════════════════════════════════════════════

function ResearchChapter({ gene, publications, timeline, setActive }: {
  gene: EnsemblGeneData;
  publications: PubMedData;
  timeline: ClinVarData['timeline'];
  setActive: (id: string) => void;
}) {
  const ref = useChapterInView('research', setActive);

  // Build a simple publication sparkline from articles by year
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const article of publications.articles) {
      const year = article.year || 'Unknown';
      counts[year] = (counts[year] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([y]) => y !== 'Unknown')
      .sort(([a], [b]) => a.localeCompare(b));
  }, [publications]);

  const maxCount = Math.max(...yearCounts.map(([, c]) => c), 1);

  // Pick a notable paper title
  const notableTitle = publications.articles[0]?.title || null;

  // Research momentum from timeline
  const momentum = timeline?.submission_rate_trend || null;

  return (
    <section id="research" ref={ref} className="min-h-screen flex items-center py-20 px-6">
      <div className="max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-4 text-center">
            The Research Story
          </h2>

          {/* Key stats */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            <div className="text-center p-5 rounded-xl bg-space-700/30 border border-space-600/20 min-w-[140px]">
              <CountUp
                end={publications.total_results}
                className="text-3xl font-mono font-bold text-cyan"
                formatter={(n) => Math.round(n).toLocaleString()}
              />
              <p className="text-text-muted text-xs font-body mt-1">papers published</p>
            </div>
            {timeline && (
              <>
                <div className="text-center p-5 rounded-xl bg-space-700/30 border border-space-600/20 min-w-[140px]">
                  <span className="text-3xl font-mono font-bold text-cyan">
                    {timeline.first_submission_date?.slice(0, 4) || '—'}
                  </span>
                  <p className="text-text-muted text-xs font-body mt-1">first ClinVar entry</p>
                </div>
                <div className="text-center p-5 rounded-xl bg-space-700/30 border border-space-600/20 min-w-[140px]">
                  <CountUp
                    end={timeline.unique_submitters}
                    className="text-3xl font-mono font-bold text-cyan"
                    formatter={(n) => Math.round(n).toLocaleString()}
                  />
                  <p className="text-text-muted text-xs font-body mt-1">submitters</p>
                </div>
              </>
            )}
            {momentum && (
              <div className="text-center p-5 rounded-xl bg-space-700/30 border border-space-600/20 min-w-[140px]">
                <GlowBadge
                  color={momentum === 'accelerating' ? 'green' : momentum === 'decelerating' ? 'amber' : 'cyan'}
                  className="text-sm"
                >
                  {momentum}
                </GlowBadge>
                <p className="text-text-muted text-xs font-body mt-2">research momentum</p>
              </div>
            )}
          </div>

          {/* Publication sparkline */}
          {yearCounts.length > 1 && (
            <div className="mb-10">
              <p className="text-text-muted text-xs font-body mb-3 text-center">Research interest over time</p>
              <div className="flex items-end justify-center gap-1 h-24">
                {yearCounts.map(([year, count]) => (
                  <motion.div
                    key={year}
                    className="flex flex-col items-center"
                    title={`${year}: ${count} papers`}
                  >
                    <motion.div
                      className="w-3 sm:w-4 bg-cyan/60 rounded-t hover:bg-cyan transition-colors"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${(count / maxCount) * 80 + 4}px` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.02 * yearCounts.indexOf([year, count].join(',') as never) }}
                    />
                    <span className="text-[8px] font-mono text-text-muted mt-1 rotate-[-45deg] origin-top-left">
                      {year.slice(-2)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Notable paper quote */}
          {notableTitle && (
            <motion.blockquote
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="border-l-2 border-cyan/30 pl-4 py-2 mb-8 max-w-2xl mx-auto"
            >
              <p className="text-text-secondary font-body italic text-sm leading-relaxed">
                "{notableTitle}"
              </p>
              <p className="text-text-muted text-xs font-body mt-1">
                — {publications.articles[0]?.authors?.split(',')[0] || 'Unknown'} et al., {publications.articles[0]?.year}
              </p>
            </motion.blockquote>
          )}

          {/* PubMed link */}
          <div className="text-center">
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/?term=${gene.gene_symbol}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-cyan hover:text-cyan/80 font-body text-sm transition-colors"
            >
              View all {publications.total_results.toLocaleString()} papers on PubMed
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 6: Network
// ═══════════════════════════════════════════════════════════

function NetworkChapter({ gene, interactions, setActive }: {
  gene: EnsemblGeneData;
  interactions: InteractionData;
  setActive: (id: string) => void;
}) {
  const ref = useChapterInView('network', setActive);

  // Top interactors by combined score
  const topInteractors = useMemo(() => {
    const seen = new Set<string>();
    const result: { gene: string; score: number }[] = [];
    for (const edge of interactions.interactions) {
      const other = edge.gene_a === gene.gene_symbol ? edge.gene_b : edge.gene_a;
      if (!seen.has(other)) {
        seen.add(other);
        result.push({ gene: other, score: edge.combined_score });
      }
    }
    return result.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [interactions, gene.gene_symbol]);

  const top1 = topInteractors[0]?.gene || '';
  const top2 = topInteractors[1]?.gene || '';

  // Enrichment terms for pathway description
  const topEnrichment = interactions.enrichment?.slice(0, 3) || [];

  return (
    <section id="network" ref={ref} className="min-h-screen flex items-center py-20 px-6">
      <div className="max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-4 text-center">
            Connected Genes
          </h2>

          <p className="text-text-secondary font-body text-lg text-center mb-10 max-w-2xl mx-auto">
            <span className="font-mono text-cyan">{gene.gene_symbol}</span> works closely with{' '}
            <span className="font-mono text-cyan">{top1}</span>
            {top2 && (<> and <span className="font-mono text-cyan">{top2}</span></>)}
            {topEnrichment.length > 0 && (
              <> in {topEnrichment[0].description.toLowerCase()}</>
            )}
          </p>

          {/* Simplified interaction display */}
          <div className="relative flex flex-wrap justify-center gap-4 mb-10">
            {/* Center gene */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none hidden md:block">
              <div className="w-48 h-48 rounded-full border border-cyan/10" />
              <div className="absolute inset-0 w-80 h-80 -left-16 -top-16 rounded-full border border-cyan/5" />
            </div>

            {topInteractors.map((interactor, i) => (
              <motion.div
                key={interactor.gene}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                <Link
                  to={`/gene/${interactor.gene}/story`}
                  className="block p-4 rounded-xl bg-space-700/40 border border-space-600/30 hover:border-cyan/30
                    hover:shadow-[0_0_20px_rgba(0,212,255,0.1)] transition-all group"
                >
                  <p className="font-mono text-cyan font-bold text-lg group-hover:text-cyan/80">
                    {interactor.gene}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-cyan/60"
                      style={{ width: `${interactor.score * 100}%`, maxWidth: '80px' }}
                    />
                    <span className="text-[10px] font-mono text-text-muted">
                      {(interactor.score * 1000).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-text-muted text-[10px] font-body mt-1 flex items-center gap-1">
                    Explore story <ChevronRight className="w-3 h-3" />
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Enrichment terms */}
          {topEnrichment.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {topEnrichment.map(term => (
                <GlowBadge key={term.term} color="green" className="text-xs">
                  {term.description.length > 40 ? term.description.slice(0, 40) + '...' : term.description}
                </GlowBadge>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Chapter 7: Explore Further
// ═══════════════════════════════════════════════════════════

function ExploreChapter({ gene, setActive }: {
  gene: EnsemblGeneData;
  setActive: (id: string) => void;
}) {
  const ref = useChapterInView('explore', setActive);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section id="explore" ref={ref} className="min-h-screen flex items-center py-20 px-6">
      <div className="max-w-3xl mx-auto w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary mb-8">
            Explore Further
          </h2>

          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <Link
              to={`/gene/${gene.gene_symbol}`}
              className="p-6 rounded-xl bg-space-700/40 border border-cyan/10 hover:border-cyan/30
                hover:shadow-[0_0_24px_rgba(0,212,255,0.1)] transition-all group"
            >
              <LayoutDashboard className="w-8 h-8 text-cyan mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <p className="font-heading font-semibold text-text-primary">Full Dashboard</p>
              <p className="text-text-muted text-xs font-body mt-1">Detailed data view</p>
            </Link>

            <Link
              to="/compare"
              className="p-6 rounded-xl bg-space-700/40 border border-cyan/10 hover:border-cyan/30
                hover:shadow-[0_0_24px_rgba(0,212,255,0.1)] transition-all group"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-cyan mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              <p className="font-heading font-semibold text-text-primary">Compare Genes</p>
              <p className="text-text-muted text-xs font-body mt-1">Side-by-side analysis</p>
            </Link>

            <Link
              to="/"
              className="p-6 rounded-xl bg-space-700/40 border border-cyan/10 hover:border-cyan/30
                hover:shadow-[0_0_24px_rgba(0,212,255,0.1)] transition-all group"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-cyan mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx={11} cy={11} r={8} />
                <line x1={21} y1={21} x2={16.65} y2={16.65} />
              </svg>
              <p className="font-heading font-semibold text-text-primary">Search Another</p>
              <p className="text-text-muted text-xs font-body mt-1">Discover a different gene</p>
            </Link>
          </div>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-space-600/40
              text-text-secondary hover:text-cyan hover:border-cyan/30 transition-all text-sm font-body cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            {copied ? 'Link copied!' : 'Share this gene story'}
          </button>

          {/* Attribution & disclaimer */}
          <div className="mt-10 space-y-3">
            <p className="text-text-muted text-xs font-body">
              Data sources: Ensembl, ClinVar, gnomAD, UniProt, PubMed, STRING
            </p>
            <p className="text-text-muted/60 text-xs font-body max-w-md mx-auto">
              This story is generated from public genomic databases.
              Not intended for clinical use or medical decision-making.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
