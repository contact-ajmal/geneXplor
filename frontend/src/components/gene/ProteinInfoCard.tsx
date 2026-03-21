import { ExternalLink } from 'lucide-react';
import type { UniProtData } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';

interface ProteinInfoCardProps {
  protein: UniProtData;
  delay?: number;
}

const DOMAIN_COLORS = ['#1B4965', '#D64045', '#2B9F78', '#D4A843', '#a855f7'];

/**
 * Split a function description into readable sentences,
 * stripping PubMed references like {ECO:...|PubMed:12345} or (PubMed:12345).
 */
function cleanAndSplitSentences(text: string): string[] {
  // Remove ECO evidence codes and PubMed references in curly braces
  let cleaned = text.replace(/\s*\{ECO:[^}]*\}/g, '');
  // Remove parenthetical PubMed references
  cleaned = cleaned.replace(/\s*\(PubMed:\d+[^)]*\)/g, '');
  // Remove standalone "PubMed:NNNNN" references
  cleaned = cleaned.replace(/\s*PubMed:\d+/g, '');
  // Remove leftover empty parentheses
  cleaned = cleaned.replace(/\(\s*\)/g, '');
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // Split on sentence boundaries (period followed by space or end)
  const sentences = cleaned
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
    .slice(0, 5)
    .map((s) => (s.endsWith('.') ? s : `${s}.`));

  return sentences;
}

export default function ProteinInfoCard({ protein, delay = 0 }: ProteinInfoCardProps) {
  const sentences = protein.function_description
    ? cleanAndSplitSentences(protein.function_description)
    : [];

  return (
    <GlassCard delay={delay}>
      {/* -- Header -- */}
      <h2 className="text-sm font-heading font-semibold text-text-heading mb-4 uppercase tracking-wider">
        Protein Information
      </h2>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h3 className="text-lg font-heading text-text-heading font-semibold">
          Protein: <span className="text-primary">{protein.protein_name}</span>
        </h3>
        <GlowBadge color="cyan">{protein.protein_length} amino acids</GlowBadge>
        <a
          href={`https://www.uniprot.org/uniprot/${protein.uniprot_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary/70 hover:text-primary transition-colors font-mono text-xs"
        >
          {protein.uniprot_id}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* -- Key Properties Grid -- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 rounded-lg bg-ocean-50 border border-ocean-100">
        {/* Length */}
        <div>
          <span className="text-xs font-body text-text-muted uppercase tracking-wider block mb-1">
            Length
          </span>
          <span className="text-sm font-mono text-text-heading">
            {protein.protein_length.toLocaleString()} amino acids
          </span>
          <p className="text-xs font-body text-text-secondary mt-0.5">
            This protein is made up of {protein.protein_length.toLocaleString()} amino acid building blocks
          </p>
        </div>

        {/* UniProt ID */}
        <div>
          <span className="text-xs font-body text-text-muted uppercase tracking-wider block mb-1">
            UniProt ID
          </span>
          <a
            href={`https://www.uniprot.org/uniprot/${protein.uniprot_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-primary hover:text-primary/80 transition-colors"
          >
            {protein.uniprot_id}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Gene Names */}
        {protein.gene_names && protein.gene_names.length > 0 && (
          <div className="sm:col-span-2">
            <span className="text-xs font-body text-text-muted uppercase tracking-wider block mb-1.5">
              Gene Names
            </span>
            <div className="flex flex-wrap gap-2">
              {protein.gene_names.map((name) => (
                <GlowBadge key={name} color="green">
                  {name}
                </GlowBadge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* -- What This Protein Does -- */}
      {sentences.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-heading text-text-muted uppercase tracking-wider mb-3">
            What This Protein Does
          </h4>
          <ul className="space-y-2 max-w-prose">
            {sentences.map((sentence, i) => (
              <li key={i} className="flex gap-2.5 text-sm font-body text-text-secondary leading-relaxed">
                <span className="text-primary/60 mt-1 shrink-0">&#8226;</span>
                <span>{sentence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* -- Protein Domain Visualization -- */}
      {protein.domains.length > 0 && (
        <div>
          <h4 className="text-xs font-heading text-text-muted uppercase tracking-wider mb-1">
            Protein Domains
          </h4>
          <p className="text-xs font-body text-text-secondary mb-3">
            Functional regions of the protein
          </p>
          <DomainBar protein={protein} />
        </div>
      )}
    </GlassCard>
  );
}

function DomainBar({ protein }: { protein: UniProtData }) {
  const totalLength = protein.protein_length;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${totalLength} 60`}
        className="w-full h-16"
        preserveAspectRatio="none"
      >
        {/* Backbone */}
        <rect
          x={0}
          y={22}
          width={totalLength}
          height={16}
          rx={4}
          fill="#f0f4f8"
          stroke="#c8d6e5"
          strokeWidth={1}
        />

        {/* Domain segments */}
        {protein.domains.map((domain, i) => {
          const color = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
          return (
            <g key={`${domain.name}-${i}`}>
              <rect
                x={domain.start}
                y={22}
                width={Math.max(domain.end - domain.start, 2)}
                height={16}
                rx={3}
                fill={color}
                opacity={0.7}
              >
                <title>
                  {domain.name}: {domain.start}-{domain.end}
                  {domain.description ? `\n${domain.description}` : ''}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>

      {/* Domain legend -- enhanced */}
      <div className="flex flex-col gap-2 mt-3">
        {protein.domains.map((domain, i) => (
          <div
            key={`${domain.name}-${i}`}
            className="flex items-start gap-2.5 p-2.5 rounded-md bg-ocean-50 border border-ocean-100"
          >
            <span
              className="w-3 h-3 rounded-sm mt-0.5 shrink-0"
              style={{ backgroundColor: DOMAIN_COLORS[i % DOMAIN_COLORS.length], opacity: 0.7 }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-text-heading text-xs font-body font-semibold">
                  {domain.name}
                </span>
                <span className="text-text-muted text-xs font-mono">
                  Position {domain.start}&ndash;{domain.end}
                </span>
              </div>
              {domain.description && (
                <p className="text-text-secondary text-xs font-body mt-0.5 leading-relaxed">
                  {domain.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
