import { ExternalLink } from 'lucide-react';
import type { UniProtData } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';

interface ProteinInfoCardProps {
  protein: UniProtData;
  delay?: number;
}

const DOMAIN_COLORS = ['#00d4ff', '#ff3366', '#00ff88', '#ffaa00', '#a855f7'];

export default function ProteinInfoCard({ protein, delay = 0 }: ProteinInfoCardProps) {
  return (
    <GlassCard delay={delay}>
      <h2 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider">
        Protein Information
      </h2>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-lg font-body text-text-primary font-semibold">
          {protein.protein_name}
        </h3>
        <GlowBadge color="cyan">{protein.protein_length} amino acids</GlowBadge>
        <a
          href={`https://www.uniprot.org/uniprot/${protein.uniprot_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-cyan/70 hover:text-cyan transition-colors font-mono text-xs"
        >
          {protein.uniprot_id}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {protein.function_description && (
        <div className="text-text-secondary text-sm font-body leading-relaxed mb-6 max-w-prose">
          {protein.function_description.split('\n').slice(0, 3).map((para, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {para}
            </p>
          ))}
        </div>
      )}

      {/* Protein Domain Visualization */}
      {protein.domains.length > 0 && (
        <div>
          <h4 className="text-xs font-body text-text-muted uppercase tracking-wider mb-3">
            Protein Domains
          </h4>
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
          fill="rgba(26, 35, 50, 0.8)"
          stroke="rgba(0, 212, 255, 0.1)"
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

      {/* Domain legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {protein.domains.map((domain, i) => (
          <div key={`${domain.name}-${i}`} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: DOMAIN_COLORS[i % DOMAIN_COLORS.length], opacity: 0.7 }}
            />
            <span className="text-text-secondary text-xs font-body">
              {domain.name}
            </span>
            <span className="text-text-muted text-xs font-mono">
              ({domain.start}-{domain.end})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
