import { Dna } from 'lucide-react';

const DATA_SOURCES = [
  { name: 'Ensembl', url: 'https://ensembl.org' },
  { name: 'ClinVar', url: 'https://www.ncbi.nlm.nih.gov/clinvar/' },
  { name: 'gnomAD', url: 'https://gnomad.broadinstitute.org' },
  { name: 'UniProt', url: 'https://www.uniprot.org' },
  { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov' },
  { name: 'AlphaFold', url: 'https://alphafold.ebi.ac.uk' },
  { name: 'STRING', url: 'https://string-db.org' },
  { name: 'Reactome', url: 'https://reactome.org' },
];

export default function Footer() {
  return (
    <footer className="border-t border-cyan/[0.06] mt-auto">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <Dna className="w-4 h-4 text-cyan/40" />
            <span className="text-text-muted text-xs font-heading font-semibold">
              GeneXplor v1.0
            </span>
          </div>

          {/* Data sources */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {DATA_SOURCES.map(source => (
              <a
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted/60 hover:text-text-muted text-[11px] font-mono transition-colors"
              >
                {source.name}
              </a>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-text-muted/40 text-[10px] font-body text-center md:text-right">
            Data cached 24h. Not for clinical use.
          </p>
        </div>
      </div>
    </footer>
  );
}
