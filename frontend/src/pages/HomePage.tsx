import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Database, Dna, FlaskConical, Activity, BookOpen } from 'lucide-react';
import DecodeText from '../components/ui/DecodeText';
import GlowBadge from '../components/ui/GlowBadge';

const POPULAR_GENES = ['TP53', 'BRCA1', 'EGFR', 'CFTR', 'BRAF', 'APOE', 'HTT', 'HBB'];

const GENE_SUGGESTIONS = [
  'TP53', 'BRCA1', 'BRCA2', 'EGFR', 'BRAF', 'KRAS', 'PIK3CA', 'PTEN', 'APC',
  'MYC', 'RB1', 'ATM', 'CFTR', 'HBB', 'HTT', 'FMR1', 'DMD', 'APOE', 'APP',
  'SCN1A', 'MYBPC3', 'MYH7', 'KCNQ1', 'LMNA', 'LDLR', 'PCSK9', 'GBA',
  'SMN1', 'FGFR3', 'WT1', 'VHL', 'NF1', 'NF2', 'TSC1', 'TSC2', 'RET',
  'JAK2', 'ABL1', 'ERBB2', 'ALK', 'MET', 'NRAS', 'CDH1', 'MLH1', 'MSH2',
  'PALB2', 'CHEK2', 'RAD51C', 'MUTYH', 'STK11',
];

const DATA_SOURCES = [
  { name: 'Ensembl', icon: Dna, color: 'text-cyan' },
  { name: 'ClinVar', icon: Activity, color: 'text-magenta' },
  { name: 'gnomAD', icon: Database, color: 'text-helix-green' },
  { name: 'UniProt', icon: FlaskConical, color: 'text-amber' },
  { name: 'PubMed', icon: BookOpen, color: 'text-cyan' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = searchInput.trim().toUpperCase();
    if (!q) return [];
    return GENE_SUGGESTIONS.filter((g) => g.startsWith(q)).slice(0, 8);
  }, [searchInput]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchInput]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (s) {
      setShowSuggestions(false);
      navigate(`/gene/${s}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < filtered.length) {
      doSearch(filtered[selectedIndex]);
    } else {
      doSearch(searchInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6 relative">
      {/* Hero Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl mx-auto"
      >
        {/* Title with DNA decode effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <h1 className="text-6xl md:text-7xl font-heading font-bold tracking-tight text-text-primary">
            <DecodeText text="GeneXplor" speed={35} />
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-text-secondary font-body text-lg md:text-xl mb-10"
        >
          Search any human gene. Explore its biology.
        </motion.p>

        {/* Search Bar */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.0 }}
          className="relative max-w-xl mx-auto mb-10"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a gene symbol (e.g., TP53, BRCA1, EGFR)"
              autoComplete="off"
              className="w-full pl-12 pr-28 py-4 rounded-xl text-base font-mono
                         bg-[rgba(20,27,45,0.7)] backdrop-blur-xl
                         border border-space-500/60 text-text-primary
                         placeholder:text-text-muted/50
                         focus:outline-none focus:border-cyan/50
                         focus:shadow-[0_0_30px_rgba(0,212,255,0.15)]
                         transition-all duration-300"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2
                         px-5 py-2 rounded-lg font-body font-semibold text-sm
                         bg-gradient-to-r from-cyan to-cyan-dim text-space-900
                         hover:shadow-[0_0_24px_rgba(0,212,255,0.35)]
                         transition-all duration-200 cursor-pointer border-none"
            >
              Search
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {showSuggestions && filtered.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden
                         bg-[rgba(15,22,40,0.95)] backdrop-blur-xl border border-space-500/40
                         shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50"
            >
              {filtered.map((gene, i) => (
                <button
                  key={gene}
                  type="button"
                  onClick={() => doSearch(gene)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full text-left px-4 py-2.5 font-mono text-sm flex items-center gap-3
                              transition-colors cursor-pointer border-none
                              ${i === selectedIndex
                                ? 'bg-cyan/10 text-cyan'
                                : 'text-text-primary hover:bg-space-700/60'
                              }`}
                >
                  <Dna className="w-3.5 h-3.5 text-text-muted" />
                  <span>{gene}</span>
                </button>
              ))}
            </div>
          )}
        </motion.form>

        {/* Popular Genes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.3 }}
          className="mb-14"
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
                <GlowBadge
                  color="cyan"
                  onClick={() => navigate(`/gene/${gene}`)}
                >
                  {gene}
                </GlowBadge>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Data Sources Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.8 }}
          className="border-t border-space-600/40 pt-6"
        >
          <p className="text-text-muted text-xs font-body mb-4">
            Aggregating data from 5 genomic databases
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {DATA_SOURCES.map((source) => {
              const Icon = source.icon;
              return (
                <div
                  key={source.name}
                  className="flex items-center gap-1.5 text-text-secondary/60"
                >
                  <Icon className={`w-3.5 h-3.5 ${source.color} opacity-60`} />
                  <span className="text-xs font-mono">{source.name}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
