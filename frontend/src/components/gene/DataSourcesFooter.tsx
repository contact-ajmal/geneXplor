import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { ResponseMetadata } from '../../lib/api';

interface DataSourcesFooterProps {
  metadata: ResponseMetadata;
  delay?: number;
}

const SOURCE_INFO: Record<string, { name: string; url: string }> = {
  ensembl: { name: 'Ensembl', url: 'https://ensembl.org' },
  uniprot: { name: 'UniProt', url: 'https://uniprot.org' },
  clinvar: { name: 'ClinVar', url: 'https://www.ncbi.nlm.nih.gov/clinvar/' },
  gnomad: { name: 'gnomAD', url: 'https://gnomad.broadinstitute.org' },
  pubmed: { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov' },
};

export default function DataSourcesFooter({ metadata, delay = 0 }: DataSourcesFooterProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="mt-12 pt-6 border-t border-space-600/20"
    >
      <p className="text-text-muted text-xs font-body text-center mb-4">
        Data aggregated from:
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {Object.entries(metadata.data_sources).map(([key, ok]) => {
          const info = SOURCE_INFO[key];
          if (!info) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              {ok ? (
                <Check className="w-3.5 h-3.5 text-helix-green" />
              ) : (
                <X className="w-3.5 h-3.5 text-text-muted" />
              )}
              <span className={`text-xs font-mono ${ok ? 'text-text-secondary' : 'text-text-muted'}`}>
                {info.name}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-text-muted text-[10px] font-mono text-center mt-3">
        {metadata.cached
          ? `Cached data from ${new Date(metadata.fetched_at).toLocaleString()}`
          : 'Live data'}
      </p>
    </motion.div>
  );
}
