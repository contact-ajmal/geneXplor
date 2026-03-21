import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitCompare, ArrowRightLeft, Search } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import AnimatedButton from '../components/ui/AnimatedButton';
import DecodeText from '../components/ui/DecodeText';

const POPULAR_PAIRS = [
  ['TP53', 'BRCA1'],
  ['EGFR', 'BRAF'],
  ['KRAS', 'NRAS'],
  ['HER2', 'EGFR'],
];

const GENE_SUGGESTIONS = [
  'TP53', 'BRCA1', 'BRCA2', 'EGFR', 'BRAF', 'KRAS', 'NRAS', 'CFTR',
  'APOE', 'HTT', 'HBB', 'FMR1', 'PTEN', 'RB1', 'APC', 'MLH1', 'MSH2',
  'VHL', 'RET', 'MYC', 'HER2', 'ALK', 'PIK3CA', 'FGFR2', 'CDH1',
  'PALB2', 'ATM', 'CHEK2', 'RAD51C', 'RAD51D', 'MUTYH', 'STK11',
];

export default function ComparePage() {
  const navigate = useNavigate();
  const [geneA, setGeneA] = useState('');
  const [geneB, setGeneB] = useState('');
  const [focusedInput, setFocusedInput] = useState<'a' | 'b' | null>(null);

  const filteredSuggestions = useCallback(
    (query: string, other: string) => {
      if (!query.trim()) return [];
      const q = query.toUpperCase();
      return GENE_SUGGESTIONS.filter(
        (g) => g.includes(q) && g !== other.toUpperCase(),
      ).slice(0, 6);
    },
    [],
  );

  const handleCompare = () => {
    const a = geneA.trim().toUpperCase();
    const b = geneB.trim().toUpperCase();
    if (a && b && a !== b) {
      navigate(`/compare/${a}/${b}`);
    }
  };

  const handleSwap = () => {
    setGeneA(geneB);
    setGeneB(geneA);
  };

  const suggestionsA = focusedInput === 'a' ? filteredSuggestions(geneA, geneB) : [];
  const suggestionsB = focusedInput === 'b' ? filteredSuggestions(geneB, geneA) : [];

  const canCompare =
    geneA.trim().length > 0 &&
    geneB.trim().length > 0 &&
    geneA.trim().toUpperCase() !== geneB.trim().toUpperCase();

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <GitCompare className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-text-heading mb-3">
          <DecodeText text="Gene Comparison" speed={35} />
        </h1>
        <p className="text-text-secondary font-body text-sm max-w-lg mx-auto">
          Compare two genes side by side — variants, diseases, pathways, and more.
        </p>
      </motion.div>

      {/* Search Inputs */}
      <GlassCard delay={0.1}>
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          {/* Gene A */}
          <div className="flex-1 relative">
            <label className="block text-xs font-heading font-semibold text-primary uppercase tracking-wider mb-2">
              Gene A
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={geneA}
                onChange={(e) => setGeneA(e.target.value.toUpperCase())}
                onFocus={() => setFocusedInput('a')}
                onBlur={() => setTimeout(() => setFocusedInput(null), 150)}
                placeholder="e.g. TP53"
                className="w-full pl-9 pr-4 py-3 rounded-lg text-sm font-mono
                  bg-ocean-50 border border-ocean-200 text-text-heading
                  placeholder:text-text-muted/50
                  focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20
                  transition-all"
              />
            </div>
            {suggestionsA.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-ocean-200 bg-white shadow-xl overflow-hidden">
                {suggestionsA.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => {
                      setGeneA(s);
                      setFocusedInput(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-mono text-text-heading
                      hover:bg-primary-light hover:text-primary transition-colors cursor-pointer bg-transparent border-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex items-end justify-center md:pb-1">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSwap}
              className="p-3 rounded-full bg-ocean-50 border border-ocean-200
                text-text-secondary hover:text-primary hover:border-primary/30 transition-colors
                cursor-pointer"
              aria-label="Swap genes"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Gene B */}
          <div className="flex-1 relative">
            <label className="block text-xs font-heading font-semibold text-danger uppercase tracking-wider mb-2">
              Gene B
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={geneB}
                onChange={(e) => setGeneB(e.target.value.toUpperCase())}
                onFocus={() => setFocusedInput('b')}
                onBlur={() => setTimeout(() => setFocusedInput(null), 150)}
                placeholder="e.g. BRCA1"
                className="w-full pl-9 pr-4 py-3 rounded-lg text-sm font-mono
                  bg-ocean-50 border border-ocean-200 text-text-heading
                  placeholder:text-text-muted/50
                  focus:outline-none focus:border-danger/30 focus:ring-1 focus:ring-danger/20
                  transition-all"
              />
            </div>
            {suggestionsB.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-ocean-200 bg-white shadow-xl overflow-hidden">
                {suggestionsB.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => {
                      setGeneB(s);
                      setFocusedInput(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm font-mono text-text-heading
                      hover:bg-danger-light hover:text-danger transition-colors cursor-pointer bg-transparent border-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compare Button */}
        <div className="mt-6 text-center">
          <AnimatedButton
            variant="primary"
            onClick={handleCompare}
            disabled={!canCompare}
            className="min-w-[200px]"
          >
            <span className="flex items-center justify-center gap-2">
              <GitCompare className="w-4 h-4" />
              Compare Genes
            </span>
          </AnimatedButton>
        </div>
      </GlassCard>

      {/* Popular Pairs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center"
      >
        <p className="text-text-muted text-xs font-body mb-3 uppercase tracking-wider">
          Popular comparisons
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_PAIRS.map(([a, b]) => (
            <motion.button
              key={`${a}-${b}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/compare/${a}/${b}`)}
              className="px-4 py-2 rounded-lg bg-ocean-50 border border-ocean-200
                text-text-secondary text-sm font-mono hover:border-primary/20 hover:text-primary
                transition-all cursor-pointer"
            >
              <span className="text-primary">{a}</span>
              <span className="text-text-muted mx-2">vs</span>
              <span className="text-danger">{b}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
