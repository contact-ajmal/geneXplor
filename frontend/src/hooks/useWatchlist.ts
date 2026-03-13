import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'genexplor_watchlist';
const MAX_WATCHLIST_SIZE = 50;

export interface WatchlistEntry {
  gene_symbol: string;
  added_at: string;
  user_note: string;
  last_viewed: string;
  tags: string[];
}

function loadWatchlist(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveWatchlist(entries: WatchlistEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* quota exceeded — silent */ }
}

// Cross-tab synchronization via storage events
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      listeners.forEach((fn) => fn());
    }
  });
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(loadWatchlist);

  // Re-sync from localStorage when other tabs change it
  useEffect(() => {
    const sync = () => setWatchlist(loadWatchlist());
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);

  const persist = useCallback((next: WatchlistEntry[]) => {
    setWatchlist(next);
    saveWatchlist(next);
  }, []);

  const isWatched = useCallback(
    (symbol: string) => watchlist.some((e) => e.gene_symbol === symbol),
    [watchlist],
  );

  const addGene = useCallback(
    (symbol: string, note = '', tags: string[] = []) => {
      if (watchlist.length >= MAX_WATCHLIST_SIZE) return false;
      if (isWatched(symbol)) return false;
      const entry: WatchlistEntry = {
        gene_symbol: symbol.toUpperCase(),
        added_at: new Date().toISOString(),
        user_note: note.slice(0, 200),
        last_viewed: new Date().toISOString(),
        tags,
      };
      persist([entry, ...watchlist]);
      return true;
    },
    [watchlist, isWatched, persist],
  );

  const removeGene = useCallback(
    (symbol: string) => {
      persist(watchlist.filter((e) => e.gene_symbol !== symbol));
    },
    [watchlist, persist],
  );

  const updateNote = useCallback(
    (symbol: string, note: string) => {
      persist(
        watchlist.map((e) =>
          e.gene_symbol === symbol ? { ...e, user_note: note.slice(0, 200) } : e,
        ),
      );
    },
    [watchlist, persist],
  );

  const updateTags = useCallback(
    (symbol: string, tags: string[]) => {
      persist(
        watchlist.map((e) =>
          e.gene_symbol === symbol ? { ...e, tags } : e,
        ),
      );
    },
    [watchlist, persist],
  );

  const touchLastViewed = useCallback(
    (symbol: string) => {
      persist(
        watchlist.map((e) =>
          e.gene_symbol === symbol
            ? { ...e, last_viewed: new Date().toISOString() }
            : e,
        ),
      );
    },
    [watchlist, persist],
  );

  const exportWatchlist = useCallback(() => {
    const blob = new Blob([JSON.stringify(watchlist, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genexplor-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [watchlist]);

  const importWatchlist = useCallback(
    (file: File): Promise<number> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const imported = JSON.parse(reader.result as string);
            if (!Array.isArray(imported)) {
              reject(new Error('Invalid watchlist format'));
              return;
            }
            const existingSymbols = new Set(watchlist.map((e) => e.gene_symbol));
            const valid = imported.filter(
              (e: WatchlistEntry) =>
                e.gene_symbol &&
                typeof e.gene_symbol === 'string' &&
                !existingSymbols.has(e.gene_symbol),
            );
            const merged = [...watchlist, ...valid].slice(0, MAX_WATCHLIST_SIZE);
            persist(merged);
            resolve(valid.length);
          } catch {
            reject(new Error('Failed to parse watchlist file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    },
    [watchlist, persist],
  );

  const allTags = Array.from(
    new Set(watchlist.flatMap((e) => e.tags)),
  ).sort();

  return {
    watchlist,
    count: watchlist.length,
    maxSize: MAX_WATCHLIST_SIZE,
    allTags,
    isWatched,
    addGene,
    removeGene,
    updateNote,
    updateTags,
    touchLastViewed,
    exportWatchlist,
    importWatchlist,
  };
}
