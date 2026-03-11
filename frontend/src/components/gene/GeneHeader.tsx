import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EnsemblGeneData, ResponseMetadata } from '../../lib/api';
import DecodeText from '../ui/DecodeText';
import GlowBadge from '../ui/GlowBadge';

interface GeneHeaderProps {
  gene: EnsemblGeneData;
  metadata: ResponseMetadata;
}

export default function GeneHeader({ gene, metadata }: GeneHeaderProps) {
  const navigate = useNavigate();
  const geneLength = gene.end - gene.start;
  const sources = metadata.data_sources;
  const activeSources = Object.entries(sources).filter(([, ok]) => ok);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-text-secondary hover:text-cyan transition-colors mb-6 cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-body">Back to search</span>
      </button>

      {/* Gene symbol + name */}
      <div className="flex flex-wrap items-start gap-4 mb-3">
        <h1 className="text-4xl md:text-5xl font-heading font-bold">
          <DecodeText
            text={gene.gene_symbol}
            className="font-mono text-cyan"
            speed={35}
          />
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <GlowBadge color="cyan">
            Chr {gene.chromosome}
          </GlowBadge>
          <GlowBadge color={gene.strand === 1 ? 'green' : 'amber'}>
            {gene.strand === 1 ? '+' : '-'} strand
          </GlowBadge>
          <GlowBadge color="muted">
            {gene.biotype.replace(/_/g, ' ')}
          </GlowBadge>
        </div>
      </div>

      {/* Gene full name */}
      <p className="text-text-secondary font-body text-lg mb-3">
        {gene.gene_name || gene.description}
      </p>

      {/* Genomic coordinates */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-mono text-text-muted">
          chr{gene.chromosome}:{gene.start.toLocaleString()}-{gene.end.toLocaleString()}
        </span>
        <span className="text-text-muted">
          {(geneLength / 1000).toFixed(1)} kb
        </span>
        <a
          href={`https://ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-cyan/70 hover:text-cyan transition-colors font-mono text-xs"
        >
          {gene.ensembl_id}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Source status dots + timestamp */}
      <div className="flex flex-wrap items-center gap-4 mt-4">
        <div className="flex items-center gap-3">
          {activeSources.map(([source]) => (
            <span key={source} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-helix-green animate-[glow-pulse_2s_ease-in-out_infinite]" />
              <span className="text-text-muted text-xs font-mono capitalize">{source}</span>
            </span>
          ))}
        </div>
        <span className="text-text-muted text-xs font-mono">
          {metadata.cached ? 'Cached' : 'Live'} &middot; {new Date(metadata.fetched_at).toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
}
