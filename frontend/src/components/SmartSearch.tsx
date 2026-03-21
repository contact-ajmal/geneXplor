import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Dna, Activity, MapPin, FlaskConical, Hash, X, ArrowRight,
  Loader2, AlertCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchAutocomplete } from '../lib/api';
import type { AutocompleteItem } from '../lib/api';
import { useSearchHistory } from '../hooks/useSearchHistory';

const CATEGORY_CONFIG: Record<string, { icon: typeof Dna; color: string; label: string }> = {
  gene: { icon: Dna, color: 'text-primary', label: 'Gene' },
  alias: { icon: Hash, color: 'text-warning', label: 'Alias' },
  gene_name: { icon: Dna, color: 'text-primary-hover', label: 'Gene Name' },
  disease: { icon: Activity, color: 'text-danger', label: 'Disease' },
  chromosome: { icon: MapPin, color: 'text-success', label: 'Location' },
  location: { icon: MapPin, color: 'text-success', label: 'Location' },
  function: { icon: FlaskConical, color: 'text-purple-500', label: 'Function' },
};

interface SmartSearchProps {
  variant?: 'hero' | 'navbar';
  className?: string;
  autoFocus?: boolean;
  onSearchSubmit?: () => void;
}

export default function SmartSearch({
  variant = 'hero',
  className = '',
  autoFocus = false,
  onSearchSubmit,
}: SmartSearchProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { history, addSearch } = useSearchHistory();

  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(input.trim()), 200);
    return () => clearTimeout(timer);
  }, [input]);

  // Autocomplete query
  const { data: autocompleteItems, isFetching } = useQuery({
    queryKey: ['autocomplete', debouncedInput],
    queryFn: () => fetchAutocomplete(debouncedInput, 10),
    enabled: debouncedInput.length >= 1,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const items = autocompleteItems ?? [];
  const hasDropdownContent = items.length > 0 || (input.trim() === '' && history.length > 0);

  useEffect(() => setSelectedIndex(-1), [debouncedInput]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doNavigate = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    addSearch(q.toUpperCase());
    setInput('');
    setShowDropdown(false);
    onSearchSubmit?.();

    // If it resolves to a single gene, go directly to dashboard
    const item = items.find(
      i => (i.category === 'gene' || i.category === 'alias') &&
        i.text.toUpperCase() === q.toUpperCase(),
    );
    if (item?.resolved_to) {
      navigate(`/gene/${item.resolved_to}`);
    } else if (/^[A-Z][A-Z0-9-]{0,19}$/i.test(q)) {
      navigate(`/gene/${q.toUpperCase()}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  }, [navigate, addSearch, items, onSearchSubmit]);

  const handleItemClick = useCallback((item: AutocompleteItem) => {
    setInput('');
    setShowDropdown(false);
    onSearchSubmit?.();

    if (item.category === 'gene' || item.category === 'alias' || item.category === 'gene_name') {
      const symbol = item.resolved_to || item.text;
      addSearch(symbol.toUpperCase());
      navigate(`/gene/${symbol.toUpperCase()}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(item.text)}`);
    }
  }, [navigate, addSearch, onSearchSubmit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      handleItemClick(items[selectedIndex]);
    } else {
      doNavigate(input);
    }
  };

  // Compute total selectable items for keyboard nav
  const showHistory = input.trim() === '' && history.length > 0;
  const totalItems = showHistory ? history.length : items.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || totalItems === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      if (showHistory) {
        const gene = history[selectedIndex];
        addSearch(gene);
        setInput('');
        setShowDropdown(false);
        onSearchSubmit?.();
        navigate(`/gene/${gene}`);
      } else {
        handleItemClick(items[selectedIndex]);
      }
    }
  };

  const isHero = variant === 'hero';

  // Group items by category for display
  const grouped = items.reduce<Record<string, AutocompleteItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className={`absolute left-${isHero ? '4' : '3'} top-1/2 -translate-y-1/2 ${isHero ? 'w-5 h-5' : 'w-4 h-4'} text-text-muted`} />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search genes, diseases, variants, locations..."
            autoComplete="off"
            autoFocus={autoFocus}
            className={
              isHero
                ? `w-full pl-12 pr-28 py-4 rounded-xl text-base font-mono
                    bg-white border border-ocean-100 text-text-heading
                    placeholder:text-text-muted/50
                    focus:outline-none focus:border-primary
                    focus:shadow-[0_0_0_3px_rgba(16,42,67,0.08)]
                    transition-all duration-300`
                : `w-full pl-9 pr-16 py-1.5 rounded-lg text-sm font-mono
                    bg-white border border-ocean-200 text-text-heading
                    placeholder:text-text-muted/50
                    focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20
                    transition-all`
            }
          />
          {isHero && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted/50 border border-ocean-100 bg-ocean-50">
                {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
              </kbd>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg font-body font-semibold text-sm
                  bg-primary text-white
                  hover:shadow-[0_4px_12px_rgba(16,42,67,0.15)]
                  transition-all duration-200 cursor-pointer border-none"
              >
                Search
              </button>
            </div>
          )}
          {!isHero && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted/40 border border-ocean-100">
              {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
            </kbd>
          )}
          {input && (
            <button
              type="button"
              onClick={() => { setInput(''); inputRef.current?.focus(); }}
              className={`absolute ${isHero ? 'right-32' : 'right-12'} top-1/2 -translate-y-1/2 p-1 rounded text-text-muted/50 hover:text-text-muted transition-colors cursor-pointer bg-transparent border-none`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && hasDropdownContent && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden
              bg-white border border-ocean-100
              shadow-[0_8px_24px_rgba(16,42,67,0.12)] z-50 max-h-[400px] overflow-y-auto"
          >
            {/* Loading indicator */}
            {isFetching && input.trim() && (
              <div className="px-4 py-2 flex items-center gap-2 text-text-muted/60">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-body">Searching...</span>
              </div>
            )}

            {/* Recent searches when input is empty */}
            {showHistory && (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] font-body text-text-muted/60 uppercase tracking-widest">
                  Recent searches
                </p>
                {history.slice(0, 6).map((gene, i) => (
                  <button
                    key={gene}
                    type="button"
                    onClick={() => {
                      addSearch(gene);
                      setInput('');
                      setShowDropdown(false);
                      onSearchSubmit?.();
                      navigate(`/gene/${gene}`);
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full text-left px-4 py-2.5 font-mono text-sm flex items-center gap-3
                      transition-colors cursor-pointer border-none
                      ${i === selectedIndex ? 'bg-primary-light text-primary' : 'text-text-body hover:bg-ocean-50'}`}
                  >
                    <Dna className="w-3.5 h-3.5 text-text-muted" />
                    <span>{gene}</span>
                  </button>
                ))}
              </>
            )}

            {/* Categorized autocomplete results */}
            {!showHistory && Object.entries(grouped).map(([category, catItems]) => {
              const config = CATEGORY_CONFIG[category] || { icon: Search, color: 'text-text-muted', label: category };
              const CatIcon = config.icon;
              return (
                <div key={category}>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-body text-text-muted/60 uppercase tracking-widest flex items-center gap-1.5">
                    <CatIcon className={`w-3 h-3 ${config.color}`} />
                    {config.label}
                  </p>
                  {catItems.map((item) => {
                    const globalIndex = items.indexOf(item);
                    return (
                      <button
                        key={`${item.category}-${item.text}`}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3
                          transition-colors cursor-pointer border-none
                          ${globalIndex === selectedIndex ? 'bg-primary-light text-primary' : 'text-text-body hover:bg-ocean-50'}`}
                      >
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <span className="font-mono truncate">{item.text}</span>
                          {item.detail && (
                            <span className="text-[10px] font-body text-text-muted/50 truncate">
                              {item.detail}
                            </span>
                          )}
                        </div>
                        {item.resolved_to && item.resolved_to !== item.text && (
                          <span className="text-[10px] font-mono text-primary/60 flex items-center gap-1 shrink-0">
                            <ArrowRight className="w-2.5 h-2.5" />
                            {item.resolved_to}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Full search footer */}
            {input.trim() && items.length > 0 && (
              <button
                type="button"
                onClick={() => doNavigate(input)}
                className="w-full text-left px-4 py-2.5 text-xs font-body text-primary/70 hover:text-primary hover:bg-ocean-50
                  transition-colors cursor-pointer border-none border-t border-ocean-100 flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                Search all results for &quot;{input.trim()}&quot;
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
