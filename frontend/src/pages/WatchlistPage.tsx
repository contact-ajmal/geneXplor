import { useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Search, Dna, ArrowUpDown, Tag, Download, Upload, Trash2,
  LayoutDashboard, BookOpen, Pencil, X, RefreshCw, ChevronDown,
  BarChart3, Table2, LayoutGrid, Bell, ArrowRight,
} from 'lucide-react';
import { fetchGene } from '../lib/api';
import type { GeneDashboardResponse } from '../lib/api';
import { useWatchlist } from '../hooks/useWatchlist';
import type { WatchlistEntry } from '../hooks/useWatchlist';
import GlassCard from '../components/ui/GlassCard';
import GlowBadge from '../components/ui/GlowBadge';
import DecodeText from '../components/ui/DecodeText';
import AnimatedButton from '../components/ui/AnimatedButton';
import CountUp from '../components/ui/CountUp';

// Sparkline (inline mini chart)
function MiniSparkline({ data, color = '#1B4965' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ViewMode = 'cards' | 'table' | 'compare';
type SortKey = 'name' | 'added' | 'variants' | 'diseases';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function WatchlistPage() {
  const navigate = useNavigate();
  const {
    watchlist, count, allTags, removeGene, updateNote, updateTags,
    exportWatchlist, importWatchlist,
  } = useWatchlist();

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortKey, setSortKey] = useState<SortKey>('added');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch summary data for all watched genes
  const geneQueries = useQueries({
    queries: watchlist.map((entry) => ({
      queryKey: ['gene', entry.gene_symbol],
      queryFn: () => fetchGene(entry.gene_symbol),
      staleTime: 10 * 60 * 1000,
      retry: 1,
    })),
  });

  const geneDataMap = useMemo(() => {
    const map = new Map<string, GeneDashboardResponse>();
    watchlist.forEach((entry, i) => {
      const q = geneQueries[i];
      if (q.data) map.set(entry.gene_symbol, q.data);
    });
    return map;
  }, [watchlist, geneQueries]);

  // Filter & sort
  const filteredWatchlist = useMemo(() => {
    let list = [...watchlist];
    if (tagFilter) {
      list = list.filter((e) => e.tags.includes(tagFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(
        (e) =>
          e.gene_symbol.includes(q) ||
          e.user_note.toUpperCase().includes(q) ||
          e.tags.some((t) => t.toUpperCase().includes(q)),
      );
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.gene_symbol.localeCompare(b.gene_symbol);
        case 'added':
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        case 'variants': {
          const av = geneDataMap.get(a.gene_symbol)?.variants?.variants.length || 0;
          const bv = geneDataMap.get(b.gene_symbol)?.variants?.variants.length || 0;
          return bv - av;
        }
        case 'diseases': {
          const ad = geneDataMap.get(a.gene_symbol)?.variants?.diseases.length || 0;
          const bd = geneDataMap.get(b.gene_symbol)?.variants?.diseases.length || 0;
          return bd - ad;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [watchlist, tagFilter, searchQuery, sortKey, geneDataMap]);

  const toggleSelect = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filteredWatchlist.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredWatchlist.map((e) => e.gene_symbol)));
    }
  };

  const handleBatchRemove = () => {
    selected.forEach((s) => removeGene(s));
    setSelected(new Set());
  };

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const added = await importWatchlist(file);
      setImportStatus(`Imported ${added} gene${added !== 1 ? 's' : ''}`);
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(`Error: ${(err as Error).message}`);
      setTimeout(() => setImportStatus(null), 3000);
    }
    e.target.value = '';
  }, [importWatchlist]);

  const startEditNote = (entry: WatchlistEntry) => {
    setEditingNote(entry.gene_symbol);
    setEditNoteText(entry.user_note);
  };

  const saveEditNote = () => {
    if (editingNote) {
      updateNote(editingNote, editNoteText);
      setEditingNote(null);
    }
  };

  const startEditTags = (entry: WatchlistEntry) => {
    setEditingTags(entry.gene_symbol);
    setEditTags([...entry.tags]);
    setEditTagInput('');
  };

  const saveEditTags = () => {
    if (editingTags) {
      updateTags(editingTags, editTags);
      setEditingTags(null);
    }
  };

  // -- Empty State --
  if (count === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Dna className="w-20 h-20 text-primary/30 mx-auto mb-6" />
          <h1 className="text-3xl font-heading font-bold text-text-heading mb-3">
            <DecodeText text="Your Watchlist" speed={35} />
          </h1>
          <p className="text-text-secondary font-body text-lg mb-2">
            Your watchlist is empty
          </p>
          <p className="text-text-muted font-body text-sm mb-8">
            Search for a gene and click ★ to start tracking
          </p>

          <div className="mb-6">
            <p className="text-text-muted text-xs font-body uppercase tracking-widest mb-3">
              Popular genes to get started
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['TP53', 'BRCA1', 'EGFR', 'CFTR', 'BRAF', 'APOE'].map((gene) => (
                <GlowBadge
                  key={gene}
                  color="cyan"
                  onClick={() => navigate(`/gene/${gene}`)}
                >
                  {gene}
                </GlowBadge>
              ))}
            </div>
          </div>

          {/* Import button for empty state */}
          <div className="flex items-center justify-center gap-3">
            <Link to="/">
              <AnimatedButton variant="primary">
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search genes
                </span>
              </AnimatedButton>
            </Link>
            <AnimatedButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import
              </span>
            </AnimatedButton>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-text-heading mb-2">
          <DecodeText text="Your Gene Watchlist" speed={35} />
        </h1>
        <p className="text-text-secondary font-body text-lg">
          <span className="font-mono text-primary">{count}</span> gene{count !== 1 ? 's' : ''} tracked
        </p>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap items-center gap-3 mb-6"
      >
        {/* Search within watchlist */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search watchlist..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm font-body
              bg-ocean-50 border border-ocean-200 text-text-heading
              placeholder:text-text-muted/50
              focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20
              transition-all"
          />
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body
                bg-ocean-50 border border-ocean-200 text-text-secondary
                hover:border-primary/30 transition-colors cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              {tagFilter || 'All tags'}
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute top-full left-0 mt-1 w-40 rounded-xl overflow-hidden
              bg-white border border-ocean-200
              shadow-lg z-50
              hidden group-hover:block">
              <button
                onClick={() => setTagFilter(null)}
                className={`w-full text-left px-3 py-2 text-xs font-body transition-colors cursor-pointer border-none
                  ${!tagFilter ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-ocean-50'}`}
              >
                All tags
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(t === tagFilter ? null : t)}
                  className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors cursor-pointer border-none
                    ${t === tagFilter ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-ocean-50'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort */}
        <div className="relative group">
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body
              bg-ocean-50 border border-ocean-200 text-text-secondary
              hover:border-primary/30 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort
            <ChevronDown className="w-3 h-3" />
          </button>
          <div className="absolute top-full left-0 mt-1 w-40 rounded-xl overflow-hidden
            bg-white border border-ocean-200
            shadow-lg z-50
            hidden group-hover:block">
            {([['added', 'Date added'], ['name', 'Gene name'], ['variants', 'Variant count'], ['diseases', 'Disease count']] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`w-full text-left px-3 py-2 text-xs font-body transition-colors cursor-pointer border-none
                  ${sortKey === key ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-ocean-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-ocean-200 p-0.5 bg-ocean-50">
          {([['cards', LayoutGrid], ['table', Table2], ['compare', BarChart3]] as [ViewMode, typeof LayoutGrid][]).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-1.5 rounded-md transition-colors cursor-pointer border-none
                ${viewMode === mode ? 'bg-primary-light text-primary' : 'text-text-muted hover:text-text-secondary'}`}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Export/Import */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={exportWatchlist}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body
              bg-ocean-50 border border-ocean-200 text-text-secondary
              hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
            title="Export watchlist as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body
              bg-ocean-50 border border-ocean-200 text-text-secondary
              hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
            title="Import watchlist from JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </motion.div>

      {/* Import status */}
      <AnimatePresence>
        {importStatus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-4 px-4 py-2 rounded-lg text-sm font-body ${
              importStatus.startsWith('Error')
                ? 'bg-danger-light text-danger border border-danger/20'
                : 'bg-success-light text-success border border-success/20'
            }`}
          >
            {importStatus}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch actions bar */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl
            bg-primary-light border border-primary/10"
        >
          <span className="text-xs font-body text-text-secondary">
            {selected.size} selected
          </span>
          <button
            onClick={() => {
              const symbols = Array.from(selected);
              if (symbols.length >= 2) {
                navigate(`/compare/${symbols[0]}/${symbols[1]}`);
              }
            }}
            disabled={selected.size < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body
              bg-primary-light text-primary border border-primary/20
              hover:bg-primary/10 transition-colors cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BarChart3 className="w-3 h-3" />
            Compare Selected
          </button>
          <button
            onClick={handleBatchRemove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body
              bg-danger-light text-danger border border-danger/20
              hover:bg-danger/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            Remove Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-text-muted text-xs font-body hover:text-text-secondary transition-colors cursor-pointer"
          >
            Clear
          </button>
        </motion.div>
      )}

      {/* -- CARDS VIEW -- */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredWatchlist.map((entry, i) => {
            const geneData = geneDataMap.get(entry.gene_symbol);
            const queryState = geneQueries[watchlist.findIndex((w) => w.gene_symbol === entry.gene_symbol)];
            const variantCount = geneData?.variants?.variants.length || 0;
            const diseaseCount = geneData?.variants?.diseases.length || 0;
            const geneName = geneData?.gene?.gene_name || geneData?.gene?.description || '';
            const isLoading = queryState?.isLoading;
            const isError = queryState?.isError;

            return (
              <motion.div
                key={entry.gene_symbol}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <GlassCard hover delay={0}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.gene_symbol)}
                        onChange={() => toggleSelect(entry.gene_symbol)}
                        className="rounded border-ocean-200 bg-ocean-50 text-primary focus:ring-primary/30 cursor-pointer"
                      />
                      <Link
                        to={`/gene/${entry.gene_symbol}`}
                        className="text-xl font-mono font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        {entry.gene_symbol}
                      </Link>
                    </div>
                    <Star className="w-4 h-4 text-warning fill-warning" />
                  </div>

                  {geneName && (
                    <p className="text-text-secondary text-xs font-body mb-2 line-clamp-1">
                      {geneName}
                    </p>
                  )}

                  {entry.user_note && (
                    <p className="text-text-muted text-xs font-body italic mb-2 line-clamp-2">
                      &ldquo;{entry.user_note}&rdquo;
                    </p>
                  )}

                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {entry.tags.map((t) => (
                        <GlowBadge key={t} color="cyan" onClick={() => setTagFilter(t)}>
                          {t}
                        </GlowBadge>
                      ))}
                    </div>
                  )}

                  {/* Quick stats */}
                  {isLoading ? (
                    <div className="space-y-2 mb-3">
                      <div className="h-3 w-2/3 rounded skeleton-shimmer" />
                      <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                    </div>
                  ) : isError ? (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-danger text-xs font-body">Failed to load</span>
                      <button
                        onClick={() => queryState?.refetch()}
                        className="text-primary text-xs font-body hover:underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 inline" /> Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 mb-3 text-xs font-mono">
                      <span className="text-text-secondary">
                        <span className="text-text-heading font-semibold">
                          <CountUp end={variantCount} duration={600} />
                        </span>{' '}
                        variants
                      </span>
                      <span className="text-text-secondary">
                        <span className="text-text-heading font-semibold">
                          <CountUp end={diseaseCount} duration={600} />
                        </span>{' '}
                        diseases
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 border-t border-ocean-100 pt-3">
                    <Link
                      to={`/gene/${entry.gene_symbol}`}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-body
                        text-text-muted hover:text-primary hover:bg-primary-light transition-colors"
                    >
                      <LayoutDashboard className="w-3 h-3" />
                      Dashboard
                    </Link>
                    <Link
                      to={`/gene/${entry.gene_symbol}/story`}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-body
                        text-text-muted hover:text-primary hover:bg-primary-light transition-colors"
                    >
                      <BookOpen className="w-3 h-3" />
                      Story
                    </Link>
                    <button
                      onClick={() => startEditNote(entry)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-body
                        text-text-muted hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Note
                    </button>
                    <button
                      onClick={() => startEditTags(entry)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-body
                        text-text-muted hover:text-primary hover:bg-primary-light transition-colors cursor-pointer"
                    >
                      <Tag className="w-3 h-3" />
                      Tags
                    </button>
                    <button
                      onClick={() => setConfirmRemove(entry.gene_symbol)}
                      className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-body
                        text-text-muted hover:text-danger hover:bg-danger-light transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-text-muted/50 text-[9px] font-mono mt-2">
                    Added {timeAgo(entry.added_at)}
                  </p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* -- TABLE VIEW -- */}
      {viewMode === 'table' && (
        <div className="rounded-2xl border border-ocean-100 bg-white overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ocean-100">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filteredWatchlist.length && filteredWatchlist.length > 0}
                    onChange={selectAll}
                    className="rounded border-ocean-200 bg-ocean-50 text-primary focus:ring-primary/30 cursor-pointer"
                  />
                </th>
                {['Gene', 'Variants', 'Diseases', 'Note', 'Tags', 'Added'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-heading font-semibold text-text-muted uppercase tracking-wider">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredWatchlist.map((entry) => {
                const geneData = geneDataMap.get(entry.gene_symbol);
                const variantCount = geneData?.variants?.variants.length || 0;
                const diseaseCount = geneData?.variants?.diseases.length || 0;

                return (
                  <tr
                    key={entry.gene_symbol}
                    className="border-b border-ocean-50 hover:bg-ocean-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.gene_symbol)}
                        onChange={() => toggleSelect(entry.gene_symbol)}
                        className="rounded border-ocean-200 bg-ocean-50 text-primary focus:ring-primary/30 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/gene/${entry.gene_symbol}`}
                        className="font-mono font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        {entry.gene_symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-text-heading">{variantCount}</td>
                    <td className="px-4 py-3 font-mono text-sm text-text-heading">{diseaseCount}</td>
                    <td className="px-4 py-3 text-xs font-body text-text-muted max-w-[200px] truncate italic">
                      {entry.user_note || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-primary-light text-primary border border-primary/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-text-muted whitespace-nowrap">
                      {timeAgo(entry.added_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfirmRemove(entry.gene_symbol)}
                        className="p-1 rounded text-text-muted hover:text-danger transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* -- COMPARE VIEW -- */}
      {viewMode === 'compare' && (
        <div className="space-y-6">
          {/* Variant count comparison bar chart */}
          <GlassCard hover={false}>
            <h3 className="text-sm font-heading font-semibold text-text-heading mb-4">
              Variant Counts Comparison
            </h3>
            <div className="space-y-3">
              {filteredWatchlist.map((entry) => {
                const geneData = geneDataMap.get(entry.gene_symbol);
                const variantCount = geneData?.variants?.variants.length || 0;
                const maxVariants = Math.max(
                  ...filteredWatchlist.map(
                    (e) => geneDataMap.get(e.gene_symbol)?.variants?.variants.length || 0,
                  ),
                  1,
                );
                const pct = (variantCount / maxVariants) * 100;

                return (
                  <div key={entry.gene_symbol} className="flex items-center gap-3">
                    <Link
                      to={`/gene/${entry.gene_symbol}`}
                      className="w-16 text-xs font-mono text-primary hover:text-primary/80 transition-colors shrink-0"
                    >
                      {entry.gene_symbol}
                    </Link>
                    <div className="flex-1 h-5 rounded-full bg-ocean-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-mono text-text-heading">
                      {variantCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Disease overlap */}
          <GlassCard hover={false}>
            <h3 className="text-sm font-heading font-semibold text-text-heading mb-4">
              Disease Associations
            </h3>
            <div className="space-y-3">
              {filteredWatchlist.map((entry) => {
                const geneData = geneDataMap.get(entry.gene_symbol);
                const diseases = geneData?.variants?.diseases || [];
                const maxDiseases = Math.max(
                  ...filteredWatchlist.map(
                    (e) => geneDataMap.get(e.gene_symbol)?.variants?.diseases.length || 0,
                  ),
                  1,
                );
                const pct = (diseases.length / maxDiseases) * 100;

                return (
                  <div key={entry.gene_symbol} className="flex items-center gap-3">
                    <Link
                      to={`/gene/${entry.gene_symbol}`}
                      className="w-16 text-xs font-mono text-primary hover:text-primary/80 transition-colors shrink-0"
                    >
                      {entry.gene_symbol}
                    </Link>
                    <div className="flex-1 h-5 rounded-full bg-ocean-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-danger/60 to-danger"
                      />
                    </div>
                    <span className="w-12 text-right text-xs font-mono text-text-heading">
                      {diseases.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Notifications teaser */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 rounded-2xl border border-ocean-100 p-5 bg-ocean-50 text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Bell className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-heading font-semibold text-text-muted">
            Get notified when new variants are reported
          </span>
          <GlowBadge color="muted">Coming Soon</GlowBadge>
        </div>
        <p className="text-text-muted text-xs font-body">
          Email and push notification preferences will be available in a future update.
        </p>
      </motion.div>

      {/* -- Edit Note Modal -- */}
      <AnimatePresence>
        {editingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30"
            onClick={() => setEditingNote(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-ocean-100 p-6 bg-white shadow-xl"
            >
              <h3 className="text-sm font-heading font-semibold text-text-heading mb-3">
                Edit note for <span className="font-mono text-primary">{editingNote}</span>
              </h3>
              <textarea
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value.slice(0, 200))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm font-body
                  bg-ocean-50 border border-ocean-200 text-text-heading
                  placeholder:text-text-muted/50
                  focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20
                  transition-all resize-none mb-1"
              />
              <p className="text-text-muted text-[10px] font-mono text-right mb-3">{editNoteText.length}/200</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEditNote}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body font-semibold
                    bg-primary text-white
                    hover:bg-primary/90
                    transition-all cursor-pointer border-none"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 rounded-lg text-sm font-body text-text-secondary
                    border border-ocean-200 hover:border-ocean-300 transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Edit Tags Modal -- */}
      <AnimatePresence>
        {editingTags && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30"
            onClick={() => setEditingTags(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-ocean-100 p-6 bg-white shadow-xl"
            >
              <h3 className="text-sm font-heading font-semibold text-text-heading mb-3">
                Edit tags for <span className="font-mono text-primary">{editingTags}</span>
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const t = editTagInput.trim().toLowerCase();
                      if (t && !editTags.includes(t) && editTags.length < 5) {
                        setEditTags([...editTags, t]);
                        setEditTagInput('');
                      }
                    }
                  }}
                  placeholder="Add a tag"
                  list="watchlist-edit-tags"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono
                    bg-ocean-50 border border-ocean-200 text-text-heading
                    placeholder:text-text-muted/50
                    focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20
                    transition-all"
                />
                <datalist id="watchlist-edit-tags">
                  {allTags.filter((t) => !editTags.includes(t)).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {editTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
                      bg-primary-light text-primary border border-primary/20"
                  >
                    {t}
                    <button
                      onClick={() => setEditTags(editTags.filter((x) => x !== t))}
                      className="hover:text-danger transition-colors cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {editTags.length === 0 && (
                  <span className="text-text-muted text-xs font-body">No tags</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEditTags}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body font-semibold
                    bg-primary text-white
                    hover:bg-primary/90
                    transition-all cursor-pointer border-none"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingTags(null)}
                  className="px-4 py-2 rounded-lg text-sm font-body text-text-secondary
                    border border-ocean-200 hover:border-ocean-300 transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- Confirm Remove -- */}
      <AnimatePresence>
        {confirmRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30"
            onClick={() => setConfirmRemove(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl border border-danger/10 p-5 bg-white shadow-xl text-center"
            >
              <p className="text-sm font-body text-text-heading mb-4">
                Remove <span className="font-mono text-primary">{confirmRemove}</span> from watchlist?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    removeGene(confirmRemove);
                    setConfirmRemove(null);
                    setSelected((prev) => {
                      const next = new Set(prev);
                      next.delete(confirmRemove);
                      return next;
                    });
                  }}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body font-semibold
                    bg-danger-light text-danger border border-danger/20
                    hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  Remove
                </button>
                <button
                  onClick={() => setConfirmRemove(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body text-text-secondary
                    border border-ocean-200 hover:border-ocean-300 transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
