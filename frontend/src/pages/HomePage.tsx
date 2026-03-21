import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Database, Dna, FlaskConical, Activity, BookOpen,
  Clock, TrendingUp, Star, ArrowRight, GitCompare,
  Network, Layers, Microscope, Sparkles,
  FileText, Zap, CheckCircle2, Shield, BarChart3,
} from 'lucide-react';
import DecodeText from '../components/ui/DecodeText';
import GlassCard from '../components/ui/GlassCard';
import GlowBadge from '../components/ui/GlowBadge';
import AnimatedButton from '../components/ui/AnimatedButton';
import SmartSearch from '../components/SmartSearch';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useWatchlist } from '../hooks/useWatchlist';
import { fetchGene, fetchTrendingGenes } from '../lib/api';
import type { TrendingGenesResponse } from '../lib/api';
import { Sparkline } from '../components/gene/ResearchPulseCard';

const POPULAR_GENES = ['TP53', 'BRCA1', 'EGFR', 'CFTR', 'BRAF', 'APOE', 'HTT', 'HBB'];

const DATA_SOURCES = [
  { name: 'Ensembl', desc: 'Gene Structure & Transcripts', detail: 'Comprehensive genome annotations, transcript variants, and regulatory regions', icon: Dna, color: 'text-primary' },
  { name: 'ClinVar', desc: 'Clinical Variant Classifications', detail: 'Clinical significance of genomic variants linked to human diseases', icon: Activity, color: 'text-danger' },
  { name: 'gnomAD', desc: 'Population Allele Frequencies', detail: 'Allele frequencies across 140,000+ exomes and genomes worldwide', icon: Database, color: 'text-success' },
  { name: 'UniProt', desc: 'Protein Function & Domains', detail: 'Curated protein sequences, functional domains, and post-translational modifications', icon: FlaskConical, color: 'text-warning' },
  { name: 'PubMed', desc: 'Research Publications', detail: 'Over 35 million biomedical literature citations and abstracts', icon: BookOpen, color: 'text-primary' },
  { name: 'AlphaFold', desc: '3D Protein Structures', detail: 'AI-predicted 3D structures for nearly every known human protein', icon: Layers, color: 'text-chart-5' },
  { name: 'STRING', desc: 'Protein Interactions', detail: 'Known and predicted protein-protein interaction networks', icon: Network, color: 'text-success' },
  { name: 'Reactome', desc: 'Biological Pathways', detail: 'Curated molecular pathways and biological processes', icon: Sparkles, color: 'text-warning' },
];

const PLATFORM_STATS = [
  { label: '20,000+ Genes', icon: Dna },
  { label: '8 Data Sources', icon: Database },
  { label: 'Real-time Updates', icon: Activity },
  { label: '12 Analysis Tools', icon: BarChart3 },
];

const CAPABILITIES = [
  '3D Protein Structure Visualization (AlphaFold)',
  'Cross-database Variant Reconciliation',
  'Population-level Allele Frequency Maps',
  'AI-Powered Gene Summaries',
  'Interactive Protein-Protein Interaction Networks',
  'Discovery Timeline & Historical Analysis',
  'Biological Pathway Mapping',
  'Side-by-side Gene Comparison',
];

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { history, addSearch, clearHistory } = useSearchHistory();
  const { watchlist } = useWatchlist();

  const { data: trendingData } = useQuery<TrendingGenesResponse>({
    queryKey: ['trending-genes'],
    queryFn: fetchTrendingGenes,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const topTrending = useMemo(() => {
    if (!trendingData) return [];
    return trendingData.trending.filter(g => g.last_12_months >= 5).slice(0, 8);
  }, [trendingData]);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => {
        POPULAR_GENES.slice(0, 3).forEach(gene => {
          queryClient.prefetchQuery({
            queryKey: ['gene', gene],
            queryFn: () => fetchGene(gene),
            staleTime: 5 * 60 * 1000,
          });
        });
      });
      return () => cancelIdleCallback(id);
    }
  }, [queryClient]);

  const doSearch = useCallback((symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (s) {
      addSearch(s);
      navigate(`/gene/${s}`);
    }
  }, [navigate, addSearch]);

  return (
    <div className="flex flex-col">
      {/* ═══ HERO SECTION ═══ */}
      <section className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tight text-text-heading">
              <DecodeText text="GeneXplor" speed={35} />
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-primary font-mono text-sm tracking-[0.2em] uppercase mb-2"
          >
            Comprehensive Gene Intelligence Platform
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-text-secondary font-body text-lg md:text-xl mb-10"
          >
            Search any human gene. Explore its biology.
          </motion.p>

          {/* Smart Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.0 }}
            className="max-w-xl mx-auto mb-4"
          >
            <SmartSearch variant="hero" autoFocus />
          </motion.div>

          {/* Popular Genes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.3 }}
            className="mb-6"
          >
            <p className="text-text-muted text-xs font-body uppercase tracking-widest mb-3">
              Popular genes
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {POPULAR_GENES.map((gene, i) => (
                <motion.div
                  key={gene}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 1.4 + i * 0.05 }}
                >
                  <GlowBadge color="cyan" onClick={() => doSearch(gene)}>
                    {gene}
                  </GlowBadge>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Platform Stats Strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.5 }}
            className="mb-6"
          >
            <div className="flex flex-wrap justify-center gap-4 md:gap-8">
              {PLATFORM_STATS.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 1.55 + i * 0.07 }}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4 text-primary/60" />
                    <span className="text-xs font-mono text-text-secondary">{stat.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Explore Trending link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
          >
            <Link
              to="/trending"
              className="inline-flex items-center gap-1.5 text-xs font-body text-success/70 hover:text-success transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Explore Trending Genes
              <ArrowRight className="w-3 h-3" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ PLATFORM OVERVIEW STRIP (Data Sources) ═══ */}
      <section className="px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-heading font-bold text-text-heading mb-2">
              Powered by World-Class Genomic Databases
            </h2>
            <p className="text-text-secondary font-body text-sm max-w-2xl mx-auto">
              GeneXplor aggregates data from 8 authoritative sources, delivering a unified view of gene biology,
              clinical relevance, and research landscape in real time.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {DATA_SOURCES.map((source, i) => {
              const Icon = source.icon;
              return (
                <motion.div
                  key={source.name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="rounded-xl border border-ocean-100 p-4 bg-white h-full hover:border-ocean-200 transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-ocean-50 flex items-center justify-center">
                        <Icon className={`w-4.5 h-4.5 ${source.color} opacity-80`} />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-semibold text-text-heading">{source.name}</p>
                        <p className="text-[10px] font-body text-primary/70">{source.desc}</p>
                      </div>
                    </div>
                    <p className="text-[11px] font-body text-text-muted leading-relaxed">{source.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ═══ WHAT YOU CAN DO ═══ */}
      <section className="px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <h2 className="text-2xl font-heading font-bold text-text-heading text-center mb-8">
            What You Can Do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Explore */}
            <GlassCard hover>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center mx-auto mb-4">
                  <Dna className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-heading mb-2">
                  Explore Any Gene
                </h3>
                <p className="text-text-secondary text-sm font-body mb-4 leading-relaxed">
                  Search 20,000+ human genes. Get instant access to genomic data, protein structure,
                  clinical variants, and research publications — all in one dashboard.
                </p>
                <Link to="/gene/TP53">
                  <AnimatedButton variant="primary">
                    <span className="flex items-center gap-1.5">
                      Try TP53 <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </AnimatedButton>
                </Link>
              </div>
            </GlassCard>

            {/* Card 2: Compare */}
            <GlassCard hover>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-danger-light flex items-center justify-center mx-auto mb-4">
                  <GitCompare className="w-6 h-6 text-danger" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-heading mb-2">
                  Compare Genes
                </h3>
                <p className="text-text-secondary text-sm font-body mb-4 leading-relaxed">
                  Compare two genes side by side — variant counts, disease associations,
                  protein domains, and research activity.
                </p>
                <Link to="/compare/TP53/BRCA1">
                  <AnimatedButton variant="secondary">
                    <span className="flex items-center gap-1.5">
                      Compare TP53 vs BRCA1 <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </AnimatedButton>
                </Link>
              </div>
            </GlassCard>

            {/* Card 3: Discover */}
            <GlassCard hover>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-success-light flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-heading mb-2">
                  Discover Trends
                </h3>
                <p className="text-text-secondary text-sm font-body mb-4 leading-relaxed">
                  See which genes are gaining research attention. Track publication momentum
                  and discover emerging targets.
                </p>
                <Link to="/trending">
                  <AnimatedButton variant="secondary">
                    <span className="flex items-center gap-1.5">
                      View Trending Genes <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </AnimatedButton>
                </Link>
              </div>
            </GlassCard>

            {/* Card 4: Watchlist & Track */}
            <GlassCard hover>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-warning-light flex items-center justify-center mx-auto mb-4">
                  <Star className="w-6 h-6 text-warning" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-heading mb-2">
                  Watchlist & Track
                </h3>
                <p className="text-text-secondary text-sm font-body mb-4 leading-relaxed">
                  Build a personalized watchlist of genes. Add notes, tags, and track changes over time.
                </p>
                <Link to="/watchlist">
                  <AnimatedButton variant="secondary">
                    <span className="flex items-center gap-1.5">
                      Open Watchlist <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </AnimatedButton>
                </Link>
              </div>
            </GlassCard>

            {/* Card 5: Generate Reports */}
            <GlassCard hover>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F0EBF8] flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-chart-5" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-heading mb-2">
                  Generate Reports
                </h3>
                <p className="text-text-secondary text-sm font-body mb-4 leading-relaxed">
                  Generate ACMG-formatted clinical reports with customizable sections. Export as PDF, JSON, or Markdown.
                </p>
                <AnimatedButton variant="secondary" onClick={() => doSearch('TP53')}>
                  <span className="flex items-center gap-1.5">
                    Try with TP53 <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </AnimatedButton>
              </div>
            </GlassCard>

            {/* Card 6: Visualize Impact */}
            <GlassCard hover>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-danger-light flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-danger" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-heading mb-2">
                  Visualize Impact
                </h3>
                <p className="text-text-secondary text-sm font-body mb-4 leading-relaxed">
                  Simulate variant impact with animated DNA-to-phenotype visualizations. Understand mutations visually.
                </p>
                <AnimatedButton variant="secondary" onClick={() => doSearch('BRCA1')}>
                  <span className="flex items-center gap-1.5">
                    Try with BRCA1 <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </AnimatedButton>
              </div>
            </GlassCard>
          </div>
        </motion.div>
      </section>

      {/* ═══ PLATFORM CAPABILITIES ═══ */}
      <section className="px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <h2 className="text-2xl font-heading font-bold text-text-heading text-center mb-2">
            Platform Capabilities
          </h2>
          <p className="text-text-secondary font-body text-sm text-center mb-10 max-w-xl mx-auto">
            Everything you need to understand gene function, clinical relevance, and research context.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Capabilities List */}
            <div className="flex flex-col justify-center gap-3">
              {CAPABILITIES.map((cap, i) => (
                <motion.div
                  key={cap}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors duration-200">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-body text-text-secondary group-hover:text-text-heading transition-colors duration-200">
                    {cap}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Right: Dashboard Preview Card */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard>
                <div className="p-2">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                        <Dna className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-mono font-bold text-primary">TP53</p>
                        <p className="text-[11px] font-body text-text-muted">Tumor Protein P53</p>
                      </div>
                    </div>
                    <GlowBadge color="magenta">Tumor Suppressor</GlowBadge>
                  </div>

                  {/* Mini stats grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg bg-ocean-50 p-3 text-center">
                      <p className="text-lg font-mono font-bold text-primary">1,247</p>
                      <p className="text-[10px] font-body text-text-muted">ClinVar Variants</p>
                    </div>
                    <div className="rounded-lg bg-ocean-50 p-3 text-center">
                      <p className="text-lg font-mono font-bold text-danger">393</p>
                      <p className="text-[10px] font-body text-text-muted">Amino Acids</p>
                    </div>
                    <div className="rounded-lg bg-ocean-50 p-3 text-center">
                      <p className="text-lg font-mono font-bold text-success">12.4k</p>
                      <p className="text-[10px] font-body text-text-muted">Publications</p>
                    </div>
                  </div>

                  {/* Mini pathway indicators */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-warning-light text-warning border border-ocean-200">
                      Cell Cycle
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-danger-light text-danger border border-ocean-200">
                      Apoptosis
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary-light text-primary border border-ocean-200">
                      DNA Repair
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-success-light text-success border border-ocean-200">
                      p53 Signaling
                    </span>
                  </div>

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-ocean-100">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-success" />
                      <span className="text-[10px] font-body text-text-muted">AlphaFold structure available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-[10px] font-mono text-text-muted">Chr 17p13.1</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ═══ TRENDING GENES PREVIEW ═══ */}
      {topTrending.length > 0 && (
        <section className="px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-heading font-bold text-text-heading flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Trending in Research
              </h2>
              <Link
                to="/trending"
                className="text-xs font-body text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {topTrending.map((gene, i) => (
                <motion.div
                  key={gene.gene_symbol}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="shrink-0 w-44"
                >
                  <GlassCard hover>
                    <button
                      onClick={() => doSearch(gene.gene_symbol)}
                      className="w-full text-left bg-transparent border-none cursor-pointer"
                    >
                      <p className="text-lg font-mono font-bold text-primary mb-1">{gene.gene_symbol}</p>
                      <GlowBadge
                        color={gene.trend_direction === 'rising' ? 'green' : gene.trend_direction === 'declining' ? 'magenta' : 'amber'}
                        className="mb-2"
                      >
                        {gene.trend_direction === 'rising' ? '\u2191' : gene.trend_direction === 'declining' ? '\u2193' : '\u2192'}
                        {' '}{gene.trend_direction}
                      </GlowBadge>
                      {gene.yearly_publications.length > 0 && (
                        <div className="mb-2">
                          <Sparkline data={gene.yearly_publications} trend={gene.trend_direction} width={120} height={24} />
                        </div>
                      )}
                      <p className="text-[11px] font-mono text-text-muted">
                        {gene.last_12_months.toLocaleString()} papers/yr
                      </p>
                    </button>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ═══ RECENTLY EXPLORED ═══ */}
      {history.length > 0 && (
        <section className="px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-text-heading flex items-center gap-2">
                <Clock className="w-5 h-5 text-text-muted" />
                Recently Explored
              </h2>
              <button
                onClick={clearHistory}
                className="text-text-muted/50 hover:text-text-muted text-xs font-body transition-colors cursor-pointer bg-transparent border-none"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((gene) => (
                <GlowBadge key={gene} color="cyan" onClick={() => doSearch(gene)}>
                  {gene}
                </GlowBadge>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ═══ WATCHLIST PREVIEW ═══ */}
      {watchlist.length > 0 && (
        <section className="px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold text-text-heading flex items-center gap-2">
                <Star className="w-5 h-5 fill-warning text-warning" />
                Your Watchlist
              </h2>
              <Link
                to="/watchlist"
                className="text-xs font-body text-warning/70 hover:text-warning transition-colors flex items-center gap-1"
              >
                View All ({watchlist.length}) <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {watchlist.slice(0, 4).map((entry) => (
                <GlowBadge key={entry.gene_symbol} color="amber" onClick={() => doSearch(entry.gene_symbol)}>
                  <Star className="w-3 h-3 fill-warning" />
                  {entry.gene_symbol}
                </GlowBadge>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <h2 className="text-2xl font-heading font-bold text-text-heading text-center mb-10">
            How It Works
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0">
            {/* Step 1: Search */}
            <div className="flex-1 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-sm font-heading font-semibold text-text-heading mb-1">Search</h3>
              <p className="text-text-muted text-xs font-body leading-relaxed">
                Enter any human gene symbol. Autocomplete helps you find the right gene instantly.
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:block w-12 h-px bg-gradient-to-r from-primary/30 to-warning/30" />
            <div className="md:hidden h-6 w-px bg-gradient-to-b from-primary/30 to-warning/30" />

            {/* Step 2: Aggregate */}
            <div className="flex-1 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-warning-light flex items-center justify-center mx-auto mb-3">
                <Network className="w-7 h-7 text-warning" />
              </div>
              <h3 className="text-sm font-heading font-semibold text-text-heading mb-1">Aggregate</h3>
              <p className="text-text-muted text-xs font-body leading-relaxed">
                We query 8 genomic databases simultaneously, collecting variants, proteins, pathways, and literature.
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:block w-12 h-px bg-gradient-to-r from-warning/30 to-success/30" />
            <div className="md:hidden h-6 w-px bg-gradient-to-b from-warning/30 to-success/30" />

            {/* Step 3: Analyze */}
            <div className="flex-1 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-3">
                <Microscope className="w-7 h-7 text-success" />
              </div>
              <h3 className="text-sm font-heading font-semibold text-text-heading mb-1">Analyze</h3>
              <p className="text-text-muted text-xs font-body leading-relaxed">
                Explore an interactive dashboard with 3D structures, variant tables, interaction networks, and research trends.
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:block w-12 h-px bg-gradient-to-r from-success/30 to-danger/30" />
            <div className="md:hidden h-6 w-px bg-gradient-to-b from-success/30 to-danger/30" />

            {/* Step 4: Export */}
            <div className="flex-1 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-danger-light flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-danger" />
              </div>
              <h3 className="text-sm font-heading font-semibold text-text-heading mb-1">Export</h3>
              <p className="text-text-muted text-xs font-body leading-relaxed">
                Generate ACMG clinical reports, export data as PDF, JSON, or Markdown, and share findings with your team.
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
