import { ExternalLink } from 'lucide-react';
import type { EnsemblGeneData } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';
import CountUp from '../ui/CountUp';

interface GeneOverviewCardProps {
  gene: EnsemblGeneData;
  delay?: number;
}

export default function GeneOverviewCard({ gene, delay = 0 }: GeneOverviewCardProps) {
  const geneLength = gene.end - gene.start;

  return (
    <GlassCard delay={delay}>
      <h2 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider">
        Gene Overview
      </h2>

      {gene.description && (
        <p className="text-text-secondary text-sm font-body leading-relaxed mb-5">
          {gene.description}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCell label="Biotype">
          <GlowBadge color="cyan">{gene.biotype.replace(/_/g, ' ')}</GlowBadge>
        </StatCell>
        <StatCell label="Transcripts">
          <span className="text-xl font-mono text-text-primary font-semibold">
            <CountUp end={gene.transcript_count} />
          </span>
        </StatCell>
        <StatCell label="Chromosome">
          <span className="text-xl font-mono text-text-primary font-semibold">
            {gene.chromosome}
          </span>
        </StatCell>
        <StatCell label="Gene Length">
          <span className="text-xl font-mono text-text-primary font-semibold">
            <CountUp end={parseFloat((geneLength / 1000).toFixed(1))} decimals={1} />
            <span className="text-sm text-text-muted ml-1">kb</span>
          </span>
        </StatCell>
      </div>

      <a
        href={`https://ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-cyan/10 border border-cyan/20 text-cyan text-sm font-body hover:bg-cyan/20 transition-colors"
      >
        View on Ensembl
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </GlassCard>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-space-800/50 border border-space-600/30 p-3 text-center">
      <p className="text-text-muted text-xs font-body mb-1">{label}</p>
      {children}
    </div>
  );
}
