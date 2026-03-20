import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, Search, Moon, Sun, GitCompare, TrendingUp, Star, X } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useWatchlist } from '../hooks/useWatchlist';
import { useSearchHistory } from '../hooks/useSearchHistory';

const GENE_SUGGESTIONS = [
  'TP53', 'BRCA1', 'BRCA2', 'EGFR', 'BRAF', 'KRAS', 'PIK3CA', 'PTEN', 'APC',
  'MYC', 'RB1', 'ATM', 'CFTR', 'HBB', 'HTT', 'FMR1', 'DMD', 'APOE', 'APP',
  'SCN1A', 'MYBPC3', 'MYH7', 'KCNQ1', 'LMNA', 'LDLR', 'PCSK9', 'GBA',
  'SMN1', 'FGFR3', 'WT1', 'VHL', 'NF1', 'NF2', 'TSC1', 'TSC2', 'RET',
  'JAK2', 'ABL1', 'ERBB2', 'ALK', 'MET', 'NRAS', 'CDH1', 'MLH1', 'MSH2',
  'PALB2', 'CHEK2', 'RAD51C', 'MUTYH', 'STK11',
];

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Navbar({ darkMode, onToggleDarkMode }: NavbarProps) {
  const [navSearch, setNavSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { count: watchlistCount } = useWatchlist();
  const { history, addSearch } = useSearchHistory();

  const filtered = useMemo(() => {
    const q = navSearch.trim().toUpperCase();
    if (!q) return [];
    return GENE_SUGGESTIONS.filter(g => g.startsWith(q)).slice(0, 6);
  }, [navSearch]);

  useEffect(() => setSelectedIndex(-1), [navSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (s) {
      addSearch(s);
      setNavSearch('');
      setShowSuggestions(false);
      setSearchExpanded(false);
      navigate(`/gene/${s}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < filtered.length) {
      doSearch(filtered[selectedIndex]);
    } else {
      doSearch(navSearch);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = filtered.length > 0 ? filtered.length : history.length;
      setSelectedIndex(prev => (prev < max - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const max = filtered.length > 0 ? filtered.length : history.length;
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : max - 1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const shortcuts = useMemo(() => ({
    'mod+k': () => {
      inputRef.current?.focus();
      setSearchExpanded(true);
      setShowSuggestions(true);
    },
    'escape': () => {
      inputRef.current?.blur();
      setShowSuggestions(false);
    },
  }), []);
  useKeyboardShortcuts(shortcuts);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-cyan/[0.06]"
      style={{
        height: '56px',
        background: darkMode ? 'rgba(10, 14, 26, 0.8)' : 'rgba(248, 250, 252, 0.85)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-none shrink-0"
        >
          <Dna className="w-6 h-6 text-cyan" />
          <span className="font-heading font-bold text-lg text-text-primary tracking-tight hidden sm:inline">
            Gene<span className="text-cyan">Xplor</span>
          </span>
        </button>

        {/* Center: Global Search (always visible unless on home page) */}
        {!isHome && (
          <form onSubmit={handleSubmit} className="flex-1 max-w-lg relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={navSearch}
                onChange={(e) => { setNavSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => { setShowSuggestions(true); setSearchExpanded(true); }}
                onKeyDown={handleKeyDown}
                placeholder="Search gene..."
                autoComplete="off"
                className="w-full pl-9 pr-16 py-1.5 rounded-lg text-sm font-mono
                  bg-space-700/60 border border-space-600/60 text-text-primary
                  placeholder:text-text-muted/50
                  focus:outline-none focus:border-cyan/30 focus:ring-1 focus:ring-cyan/20
                  transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted/40 border border-space-500/20">
                {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
              </kbd>
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (filtered.length > 0 || (navSearch.trim() === '' && history.length > 0)) && (
                <motion.div
                  ref={suggestionsRef}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden
                    bg-[rgba(15,22,40,0.95)] backdrop-blur-xl border border-space-500/40
                    shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50"
                >
                  {/* Show recent searches when input is empty */}
                  {navSearch.trim() === '' && history.length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-body text-text-muted/60 uppercase tracking-widest">
                        Recent searches
                      </p>
                      {history.slice(0, 5).map((gene, i) => (
                        <button
                          key={gene}
                          type="button"
                          onClick={() => doSearch(gene)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className={`w-full text-left px-4 py-2 font-mono text-sm flex items-center gap-3
                            transition-colors cursor-pointer border-none
                            ${i === selectedIndex ? 'bg-cyan/10 text-cyan' : 'text-text-primary hover:bg-space-700/60'}`}
                        >
                          <Dna className="w-3.5 h-3.5 text-text-muted" />
                          <span>{gene}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Show filtered suggestions */}
                  {filtered.length > 0 && (
                    <>
                      {navSearch.trim() !== '' && (
                        <p className="px-3 pt-2 pb-1 text-[10px] font-body text-text-muted/60 uppercase tracking-widest">
                          Suggestions
                        </p>
                      )}
                      {filtered.map((gene, i) => (
                        <button
                          key={gene}
                          type="button"
                          onClick={() => doSearch(gene)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className={`w-full text-left px-4 py-2 font-mono text-sm flex items-center gap-3
                            transition-colors cursor-pointer border-none
                            ${i === selectedIndex ? 'bg-cyan/10 text-cyan' : 'text-text-primary hover:bg-space-700/60'}`}
                        >
                          <Dna className="w-3.5 h-3.5 text-text-muted" />
                          <span>{gene}</span>
                        </button>
                      ))}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}

        {/* Right section */}
        <div className="flex items-center gap-1">
          {/* Trending */}
          <motion.button
            onClick={() => navigate('/trending')}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
              transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5"
            aria-label="Trending genes"
            title="Trending genes"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden lg:inline text-xs font-body">Trending</span>
          </motion.button>

          {/* Compare */}
          <motion.button
            onClick={() => navigate('/compare')}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
              transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5"
            aria-label="Compare genes"
            title="Compare genes"
          >
            <GitCompare className="w-4 h-4" />
            <span className="hidden lg:inline text-xs font-body">Compare</span>
          </motion.button>

          {/* Watchlist */}
          <motion.button
            onClick={() => navigate('/watchlist')}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg text-text-secondary hover:text-amber hover:bg-amber/[0.05]
              transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5 relative"
            aria-label="Watchlist"
            title="Watchlist"
          >
            <Star className={`w-4 h-4 ${watchlistCount > 0 ? 'fill-amber text-amber' : ''}`} />
            <span className="hidden lg:inline text-xs font-body">Watchlist</span>
            {watchlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center
                px-1 rounded-full text-[9px] font-mono font-bold bg-amber text-space-900">
                {watchlistCount}
              </span>
            )}
          </motion.button>

          {/* Theme toggle */}
          <motion.button
            onClick={onToggleDarkMode}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
              transition-colors cursor-pointer bg-transparent border-none"
            aria-label="Toggle theme"
          >
            <motion.div
              key={darkMode ? 'sun' : 'moon'}
              initial={{ rotate: -30, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </motion.div>
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
}
