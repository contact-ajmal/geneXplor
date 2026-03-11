import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Dna, Activity, AlertCircle } from 'lucide-react';
import { fetchGene, type GeneResponse } from './lib/api';

function App() {
  const [searchInput, setSearchInput] = useState('');
  const [geneSymbol, setGeneSymbol] = useState('');

  const {
    data: gene,
    isLoading,
    error,
    isFetching,
  } = useQuery<GeneResponse, Error>({
    queryKey: ['gene', geneSymbol],
    queryFn: () => fetchGene(geneSymbol),
    enabled: geneSymbol.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim().toUpperCase();
    if (trimmed) {
      setGeneSymbol(trimmed);
    }
  };

  return (
    <div className="min-h-screen bg-space-900 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Dna className="w-10 h-10 text-cyan" />
            <h1 className="text-4xl font-bold font-heading text-text-primary tracking-tight">
              GeneXplor
            </h1>
          </div>
          <p className="text-text-secondary font-body text-lg">
            Search any human gene. Get a comprehensive genomic dashboard.
          </p>
        </motion.header>

        {/* Search */}
        <motion.form
          onSubmit={handleSearch}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="max-w-xl mx-auto mb-10"
        >
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter gene symbol (e.g., TP53, BRCA1, EGFR)"
              className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-space-700/70 border border-space-600
                         text-text-primary font-mono placeholder:text-text-secondary/50
                         focus:outline-none focus:border-cyan/50 focus:ring-1 focus:ring-cyan/30
                         backdrop-blur-xl transition-all"
            />
            <button
              type="submit"
              disabled={isFetching}
              className="absolute right-2 px-5 py-2 rounded-lg font-body font-semibold text-sm
                         bg-gradient-to-r from-cyan to-cyan/80 text-space-900
                         hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFetching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </motion.form>

        {/* Loading */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <Activity className="w-8 h-8 text-cyan mx-auto mb-3 animate-pulse" />
              <p className="text-text-secondary font-mono text-sm">
                Decoding {geneSymbol}...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto p-4 rounded-xl bg-magenta/10 border border-magenta/30 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-magenta flex-shrink-0 mt-0.5" />
              <p className="text-magenta text-sm font-body">{error.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gene Result */}
        <AnimatePresence>
          {gene && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Gene Header Card */}
              <div
                className="rounded-2xl p-6 mb-6 border border-cyan/10"
                style={{
                  background: 'rgba(20, 27, 45, 0.7)',
                  backdropFilter: 'blur(24px)',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-heading font-bold text-text-primary flex items-center gap-2">
                      <span className="font-mono text-cyan">{gene.ensembl.gene_symbol}</span>
                    </h2>
                    <p className="text-text-secondary mt-1">{gene.ensembl.description}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-medium ${
                      gene.source === 'cache'
                        ? 'bg-helix-green/10 text-helix-green border border-helix-green/30'
                        : 'bg-cyan/10 text-cyan border border-cyan/30'
                    }`}
                  >
                    {gene.source === 'cache' ? 'Cached' : 'Live'}
                  </span>
                </div>

                {/* Gene Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <InfoCard label="Ensembl ID" value={gene.ensembl.ensembl_id} />
                  <InfoCard
                    label="Location"
                    value={`Chr ${gene.ensembl.chromosome}: ${gene.ensembl.start.toLocaleString()} - ${gene.ensembl.end.toLocaleString()}`}
                  />
                  <InfoCard
                    label="Strand"
                    value={gene.ensembl.strand === 1 ? 'Forward (+)' : 'Reverse (-)'}
                  />
                  <InfoCard label="Biotype" value={gene.ensembl.biotype} />
                  <InfoCard
                    label="Transcripts"
                    value={gene.ensembl.transcript_count.toString()}
                  />
                  <InfoCard
                    label="Gene Length"
                    value={`${((gene.ensembl.end - gene.ensembl.start) / 1000).toFixed(1)} kb`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3 bg-space-800/60 border border-space-600/50">
      <p className="text-text-secondary text-xs font-body mb-1">{label}</p>
      <p className="text-text-primary text-sm font-mono truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

export default App;
