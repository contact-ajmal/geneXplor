import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Dna,
  Search,
  ArrowLeft,
  ExternalLink,
  GitCompare,
} from 'lucide-react';
import { fetchCompareGenes } from '../lib/api';
import type { GeneDashboardResponse, DiseaseAssociation } from '../lib/api';
import GlassCard from '../components/ui/GlassCard';
import AnimatedButton from '../components/ui/AnimatedButton';
import DecodeText from '../components/ui/DecodeText';
import GlowBadge from '../components/ui/GlowBadge';
import CountUp from '../components/ui/CountUp';
import ScrollReveal from '../components/ui/ScrollReveal';
import CompareLoadingPage from './CompareLoadingPage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function CompareResultPage() {
  const { symbolA, symbolB } = useParams<{
    symbolA: string;
    symbolB: string;
  }>();
  const navigate = useNavigate();
  const a = symbolA?.toUpperCase() || '';
  const b = symbolB?.toUpperCase() || '';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['compare', a, b],
    queryFn: () => fetchCompareGenes(a, b),
    enabled: a.length > 0 && b.length > 0,
  });

  if (isLoading) {
    return <CompareLoadingPage symbolA={a} symbolB={b} />;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Dna className="w-20 h-20 text-danger/40 mx-auto mb-6" />
          <div className="p-6 rounded-2xl bg-danger-light border border-danger/20 mb-6">
            <AlertCircle className="w-6 h-6 text-danger mx-auto mb-3" />
            <h2 className="text-lg font-heading font-semibold text-text-heading mb-2">
              Comparison failed
            </h2>
            <p className="text-text-secondary text-sm font-body mb-4">
              Could not compare{' '}
              <span className="font-mono text-primary">{a}</span> and{' '}
              <span className="font-mono text-danger">{b}</span>.
            </p>
            <p className="text-text-muted text-xs font-body">{error.message}</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link to="/compare">
              <AnimatedButton variant="primary">
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Try again
                </span>
              </AnimatedButton>
            </Link>
            <AnimatedButton variant="secondary" onClick={() => refetch()}>
              Retry
            </AnimatedButton>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  const [geneA, geneB] = data;

  return (
    <div className="max-w-7xl mx-auto px-6 pt-20 pb-12">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-4"
      >
        <button
          onClick={() => navigate('/compare')}
          className="flex items-center gap-1.5 text-text-muted hover:text-primary text-sm font-body transition-colors cursor-pointer bg-transparent border-none"
        >
          <ArrowLeft className="w-4 h-4" />
          New comparison
        </button>
      </motion.div>

      {/* Comparison Header */}
      <CompareHeader symbolA={a} symbolB={b} />

      {/* Summary Highlights */}
      <ScrollReveal>
        <SummaryHighlights geneA={geneA} geneB={geneB} />
      </ScrollReveal>

      {/* Gene Overview Comparison */}
      <ScrollReveal delay={0.05}>
        <GeneOverviewComparison geneA={geneA} geneB={geneB} />
      </ScrollReveal>

      {/* Variant Count Comparison */}
      <ScrollReveal delay={0.1}>
        <VariantCountComparison geneA={geneA} geneB={geneB} />
      </ScrollReveal>

      {/* Disease Association Comparison */}
      <ScrollReveal delay={0.15}>
        <DiseaseComparison geneA={geneA} geneB={geneB} />
      </ScrollReveal>

      {/* Publication Comparison */}
      <ScrollReveal delay={0.2}>
        <PublicationComparison geneA={geneA} geneB={geneB} />
      </ScrollReveal>

      {/* Protein Length Comparison */}
      <ScrollReveal delay={0.25}>
        <ProteinComparison geneA={geneA} geneB={geneB} />
      </ScrollReveal>

      {/* View Full Dashboard Links */}
      <ScrollReveal delay={0.3}>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to={`/gene/${a}`}>
            <AnimatedButton variant="secondary">
              <span className="flex items-center gap-2">
                View full <span className="font-mono text-primary">{a}</span>{' '}
                dashboard
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </AnimatedButton>
          </Link>
          <Link to={`/gene/${b}`}>
            <AnimatedButton variant="secondary">
              <span className="flex items-center gap-2">
                View full <span className="font-mono text-danger">{b}</span>{' '}
                dashboard
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </AnimatedButton>
          </Link>
        </div>
      </ScrollReveal>
    </div>
  );
}

/* -- Sub-components -- */

function CompareHeader({
  symbolA,
  symbolB,
}: {
  symbolA: string;
  symbolB: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <div className="flex items-center justify-center gap-4 md:gap-6">
        <h1 className="text-2xl md:text-4xl font-heading font-bold font-mono text-primary">
          <DecodeText text={symbolA} speed={35} />
        </h1>
        <div className="flex items-center gap-2">
          <div className="w-8 h-px bg-ocean-200" />
          <GitCompare className="w-6 h-6 text-text-muted" />
          <div className="w-8 h-px bg-ocean-200" />
        </div>
        <h1 className="text-2xl md:text-4xl font-heading font-bold font-mono text-danger">
          <DecodeText text={symbolB} speed={35} delay={200} />
        </h1>
      </div>
    </motion.div>
  );
}

function SummaryHighlights({
  geneA,
  geneB,
}: {
  geneA: GeneDashboardResponse;
  geneB: GeneDashboardResponse;
}) {
  const highlights = useMemo(() => {
    const items: string[] = [];

    const variantsA = geneA.variants?.variants.length ?? 0;
    const variantsB = geneB.variants?.variants.length ?? 0;
    const diff = Math.abs(variantsA - variantsB);
    if (diff > 0) {
      const more = variantsA > variantsB ? geneA.gene_symbol : geneB.gene_symbol;
      items.push(`${more} has ${diff} more clinical variant${diff === 1 ? '' : 's'}`);
    } else {
      items.push('Both genes have the same number of clinical variants');
    }

    const diseasesA = new Set(
      geneA.variants?.diseases.map((d) => d.disease_name.toLowerCase()) ?? [],
    );
    const diseasesB = new Set(
      geneB.variants?.diseases.map((d) => d.disease_name.toLowerCase()) ?? [],
    );
    const shared = [...diseasesA].filter((d) => diseasesB.has(d)).length;
    if (shared > 0) {
      items.push(
        `Both genes are associated with ${shared} common condition${shared === 1 ? '' : 's'}`,
      );
    }

    const pubsA = geneA.publications?.total_results ?? 0;
    const pubsB = geneB.publications?.total_results ?? 0;
    if (pubsA > 0 && pubsB > 0) {
      const more = pubsA > pubsB ? geneA.gene_symbol : geneB.gene_symbol;
      items.push(
        `${more} has more published research (${Math.max(pubsA, pubsB).toLocaleString()} vs ${Math.min(pubsA, pubsB).toLocaleString()})`,
      );
    }

    return items;
  }, [geneA, geneB]);

  if (highlights.length === 0) return null;

  return (
    <GlassCard delay={0}>
      <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider mb-3">
        Comparison Highlights
      </h2>
      <ul className="space-y-2">
        {highlights.map((h, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm font-body text-text-secondary"
          >
            <span className="text-primary mt-0.5">•</span>
            {h}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

function GeneOverviewComparison({
  geneA,
  geneB,
}: {
  geneA: GeneDashboardResponse;
  geneB: GeneDashboardResponse;
}) {
  const a = geneA.gene;
  const b = geneB.gene;
  if (!a || !b) return null;

  const lenA = a.end - a.start;
  const lenB = b.end - b.start;
  const maxLen = Math.max(lenA, lenB);

  const stats = [
    {
      label: 'Chromosome',
      valueA: `chr${a.chromosome}`,
      valueB: `chr${b.chromosome}`,
      match: a.chromosome === b.chromosome,
    },
    {
      label: 'Biotype',
      valueA: a.biotype.replace(/_/g, ' '),
      valueB: b.biotype.replace(/_/g, ' '),
      match: a.biotype === b.biotype,
    },
    {
      label: 'Transcripts',
      valueA: String(a.transcript_count),
      valueB: String(b.transcript_count),
    },
  ];

  return (
    <GlassCard delay={0} className="mt-6">
      <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider mb-4">
        Gene Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-ocean-50 border border-ocean-100 p-4"
          >
            <p className="text-text-muted text-xs font-body mb-2">{s.label}</p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-primary text-sm">{s.valueA}</span>
              {s.match !== undefined && (
                <GlowBadge color={s.match ? 'green' : 'amber'} className="text-[10px]">
                  {s.match ? 'Match' : 'Different'}
                </GlowBadge>
              )}
              <span className="font-mono text-danger text-sm">{s.valueB}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Gene Length Bar Comparison */}
      <div className="rounded-xl bg-ocean-50 border border-ocean-100 p-4">
        <p className="text-text-muted text-xs font-body mb-3">Gene Length</p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-primary">{geneA.gene_symbol}</span>
              <span className="text-xs font-mono text-text-secondary">
                {(lenA / 1000).toFixed(1)} kb
              </span>
            </div>
            <div className="h-3 rounded-full bg-ocean-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(lenA / maxLen) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-danger">
                {geneB.gene_symbol}
              </span>
              <span className="text-xs font-mono text-text-secondary">
                {(lenB / 1000).toFixed(1)} kb
              </span>
            </div>
            <div className="h-3 rounded-full bg-ocean-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(lenB / maxLen) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full rounded-full bg-gradient-to-r from-danger/60 to-danger"
              />
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function VariantCountComparison({
  geneA,
  geneB,
}: {
  geneA: GeneDashboardResponse;
  geneB: GeneDashboardResponse;
}) {
  const chartData = useMemo(() => {
    const categories = [
      'Pathogenic',
      'Likely pathogenic',
      'Uncertain significance',
      'Likely benign',
      'Benign',
    ];

    const countBySig = (
      variants: GeneDashboardResponse['variants'],
      sig: string,
    ) =>
      variants?.variants.filter(
        (v) => v.clinical_significance.toLowerCase() === sig.toLowerCase(),
      ).length ?? 0;

    return categories.map((cat) => ({
      name: cat.length > 15 ? cat.replace('significance', 'sig.') : cat,
      [geneA.gene_symbol]: countBySig(geneA.variants, cat),
      [geneB.gene_symbol]: countBySig(geneB.variants, cat),
    }));
  }, [geneA, geneB]);

  const totalA = geneA.variants?.variants.length ?? 0;
  const totalB = geneB.variants?.variants.length ?? 0;

  return (
    <GlassCard delay={0} className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
          Variant Comparison
        </h2>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-primary">
            {geneA.gene_symbol}: <CountUp end={totalA} />
          </span>
          <span className="text-danger">
            {geneB.gene_symbol}: <CountUp end={totalB} />
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'Plus Jakarta Sans',
              }}
              itemStyle={{ color: '#1e293b' }}
              labelStyle={{ color: '#64748b', marginBottom: '4px' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
            />
            <Bar
              dataKey={geneA.gene_symbol}
              fill="#1B4965"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={geneB.gene_symbol}
              fill="#D64045"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

function DiseaseComparison({
  geneA,
  geneB,
}: {
  geneA: GeneDashboardResponse;
  geneB: GeneDashboardResponse;
}) {
  const { uniqueA, uniqueB, shared } = useMemo(() => {
    const diseasesA = geneA.variants?.diseases ?? [];
    const diseasesB = geneB.variants?.diseases ?? [];

    const mapB = new Map<string, DiseaseAssociation>();
    for (const d of diseasesB) {
      mapB.set(d.disease_name.toLowerCase(), d);
    }

    const sharedList: { name: string; countA: number; countB: number }[] = [];
    const onlyA: DiseaseAssociation[] = [];

    for (const d of diseasesA) {
      const key = d.disease_name.toLowerCase();
      const match = mapB.get(key);
      if (match) {
        sharedList.push({
          name: d.disease_name,
          countA: d.variant_count,
          countB: match.variant_count,
        });
        mapB.delete(key);
      } else {
        onlyA.push(d);
      }
    }

    const onlyB = [...mapB.values()];

    return { uniqueA: onlyA, uniqueB: onlyB, shared: sharedList };
  }, [geneA, geneB]);

  const total = uniqueA.length + uniqueB.length + shared.length;
  if (total === 0) return null;

  return (
    <GlassCard delay={0} className="mt-6">
      <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider mb-1">
        Disease Associations
      </h2>
      <p className="text-text-muted text-xs font-body mb-4">
        Venn-style comparison of associated conditions
      </p>

      {/* Count badges */}
      <div className="flex flex-wrap gap-3 mb-5">
        <GlowBadge color="cyan">
          Unique to {geneA.gene_symbol}: {uniqueA.length}
        </GlowBadge>
        <GlowBadge color="muted">Shared: {shared.length}</GlowBadge>
        <GlowBadge color="magenta">
          Unique to {geneB.gene_symbol}: {uniqueB.length}
        </GlowBadge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Unique to A */}
        <div className="rounded-xl bg-primary-light border border-primary/10 p-3">
          <p className="text-xs font-heading font-semibold text-primary uppercase tracking-wider mb-2">
            {geneA.gene_symbol} only
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {uniqueA.slice(0, 15).map((d) => (
              <p
                key={d.disease_name}
                className="text-xs font-body text-text-secondary truncate"
                title={d.disease_name}
              >
                {d.disease_name}
                <span className="text-text-muted ml-1">({d.variant_count})</span>
              </p>
            ))}
            {uniqueA.length > 15 && (
              <p className="text-xs text-text-muted">
                +{uniqueA.length - 15} more
              </p>
            )}
            {uniqueA.length === 0 && (
              <p className="text-xs text-text-muted italic">None</p>
            )}
          </div>
        </div>

        {/* Shared */}
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-3">
          <p className="text-xs font-heading font-semibold text-purple-600 uppercase tracking-wider mb-2">
            Shared
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {shared.slice(0, 15).map((d) => (
              <p
                key={d.name}
                className="text-xs font-body text-text-secondary truncate"
                title={d.name}
              >
                {d.name}
                <span className="text-text-muted ml-1">
                  ({d.countA} / {d.countB})
                </span>
              </p>
            ))}
            {shared.length > 15 && (
              <p className="text-xs text-text-muted">
                +{shared.length - 15} more
              </p>
            )}
            {shared.length === 0 && (
              <p className="text-xs text-text-muted italic">None</p>
            )}
          </div>
        </div>

        {/* Unique to B */}
        <div className="rounded-xl bg-danger-light border border-danger/10 p-3">
          <p className="text-xs font-heading font-semibold text-danger uppercase tracking-wider mb-2">
            {geneB.gene_symbol} only
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {uniqueB.slice(0, 15).map((d) => (
              <p
                key={d.disease_name}
                className="text-xs font-body text-text-secondary truncate"
                title={d.disease_name}
              >
                {d.disease_name}
                <span className="text-text-muted ml-1">({d.variant_count})</span>
              </p>
            ))}
            {uniqueB.length > 15 && (
              <p className="text-xs text-text-muted">
                +{uniqueB.length - 15} more
              </p>
            )}
            {uniqueB.length === 0 && (
              <p className="text-xs text-text-muted italic">None</p>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function PublicationComparison({
  geneA,
  geneB,
}: {
  geneA: GeneDashboardResponse;
  geneB: GeneDashboardResponse;
}) {
  const pubsA = geneA.publications;
  const pubsB = geneB.publications;
  if (!pubsA && !pubsB) return null;

  const totalA = pubsA?.total_results ?? 0;
  const totalB = pubsB?.total_results ?? 0;
  const maxPubs = Math.max(totalA, totalB, 1);

  return (
    <GlassCard delay={0} className="mt-6">
      <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider mb-4">
        Publications
      </h2>

      {/* Total bar comparison */}
      <div className="rounded-xl bg-ocean-50 border border-ocean-100 p-4 mb-5">
        <p className="text-text-muted text-xs font-body mb-3">
          Total publications in PubMed
        </p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-primary">
                {geneA.gene_symbol}
              </span>
              <span className="text-xs font-mono text-text-secondary">
                <CountUp end={totalA} />
              </span>
            </div>
            <div className="h-3 rounded-full bg-ocean-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(totalA / maxPubs) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-danger">
                {geneB.gene_symbol}
              </span>
              <span className="text-xs font-mono text-text-secondary">
                <CountUp end={totalB} />
              </span>
            </div>
            <div className="h-3 rounded-full bg-ocean-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(totalB / maxPubs) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full rounded-full bg-gradient-to-r from-danger/60 to-danger"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side recent papers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-heading font-semibold text-primary uppercase tracking-wider mb-2">
            Recent {geneA.gene_symbol} papers
          </p>
          <div className="space-y-2">
            {(pubsA?.articles ?? []).slice(0, 5).map((article) => (
              <a
                key={article.pmid}
                href={article.pubmed_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-ocean-50 border border-ocean-100 p-3 hover:border-primary/20 transition-colors"
              >
                <p className="text-xs font-body text-text-heading line-clamp-2 mb-1">
                  {article.title}
                </p>
                <p className="text-[10px] font-body text-text-muted">
                  {article.journal} · {article.year}
                </p>
              </a>
            ))}
            {(!pubsA || pubsA.articles.length === 0) && (
              <p className="text-xs text-text-muted italic">No publications</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-heading font-semibold text-danger uppercase tracking-wider mb-2">
            Recent {geneB.gene_symbol} papers
          </p>
          <div className="space-y-2">
            {(pubsB?.articles ?? []).slice(0, 5).map((article) => (
              <a
                key={article.pmid}
                href={article.pubmed_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-ocean-50 border border-ocean-100 p-3 hover:border-danger/20 transition-colors"
              >
                <p className="text-xs font-body text-text-heading line-clamp-2 mb-1">
                  {article.title}
                </p>
                <p className="text-[10px] font-body text-text-muted">
                  {article.journal} · {article.year}
                </p>
              </a>
            ))}
            {(!pubsB || pubsB.articles.length === 0) && (
              <p className="text-xs text-text-muted italic">No publications</p>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function ProteinComparison({
  geneA,
  geneB,
}: {
  geneA: GeneDashboardResponse;
  geneB: GeneDashboardResponse;
}) {
  const protA = geneA.protein;
  const protB = geneB.protein;
  if (!protA && !protB) return null;

  const lenA = protA?.protein_length ?? 0;
  const lenB = protB?.protein_length ?? 0;
  const maxLen = Math.max(lenA, lenB, 1);

  // All unique domains from both proteins
  const domainsA = protA?.domains ?? [];
  const domainsB = protB?.domains ?? [];

  return (
    <GlassCard delay={0} className="mt-6">
      <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider mb-4">
        Protein Comparison
      </h2>

      {/* Protein Length Bars */}
      <div className="rounded-xl bg-ocean-50 border border-ocean-100 p-4 mb-5">
        <p className="text-text-muted text-xs font-body mb-3">Protein Length (aa)</p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-primary">
                {protA?.protein_name || geneA.gene_symbol}
              </span>
              <span className="text-xs font-mono text-text-secondary">
                <CountUp end={lenA} /> aa
              </span>
            </div>
            <div className="h-4 rounded-full bg-ocean-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(lenA / maxLen) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary relative"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-danger">
                {protB?.protein_name || geneB.gene_symbol}
              </span>
              <span className="text-xs font-mono text-text-secondary">
                <CountUp end={lenB} /> aa
              </span>
            </div>
            <div className="h-4 rounded-full bg-ocean-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(lenB / maxLen) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="h-full rounded-full bg-gradient-to-r from-danger/60 to-danger"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Domain comparison */}
      {(domainsA.length > 0 || domainsB.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-heading font-semibold text-primary uppercase tracking-wider mb-2">
              {geneA.gene_symbol} Domains ({domainsA.length})
            </p>
            <div className="space-y-1">
              {domainsA.slice(0, 8).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-ocean-50 border border-ocean-100 px-3 py-1.5"
                >
                  <span className="text-xs font-body text-text-secondary truncate mr-2">
                    {d.name || d.description}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">
                    {d.start}–{d.end}
                  </span>
                </div>
              ))}
              {domainsA.length > 8 && (
                <p className="text-xs text-text-muted">
                  +{domainsA.length - 8} more
                </p>
              )}
              {domainsA.length === 0 && (
                <p className="text-xs text-text-muted italic">No domains</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-heading font-semibold text-danger uppercase tracking-wider mb-2">
              {geneB.gene_symbol} Domains ({domainsB.length})
            </p>
            <div className="space-y-1">
              {domainsB.slice(0, 8).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-ocean-50 border border-ocean-100 px-3 py-1.5"
                >
                  <span className="text-xs font-body text-text-secondary truncate mr-2">
                    {d.name || d.description}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">
                    {d.start}–{d.end}
                  </span>
                </div>
              ))}
              {domainsB.length > 8 && (
                <p className="text-xs text-text-muted">
                  +{domainsB.length - 8} more
                </p>
              )}
              {domainsB.length === 0 && (
                <p className="text-xs text-text-muted italic">No domains</p>
              )}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
