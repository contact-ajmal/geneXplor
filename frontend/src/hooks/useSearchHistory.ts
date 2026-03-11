import { useState, useCallback } from 'react';

const STORAGE_KEY = 'genexplor_search_history';
const MAX_ITEMS = 10;

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addSearch = useCallback((symbol: string) => {
    const upper = symbol.trim().toUpperCase();
    if (!upper) return;

    setHistory(prev => {
      const filtered = prev.filter(s => s !== upper);
      const next = [upper, ...filtered].slice(0, MAX_ITEMS);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  return { history, addSearch, clearHistory };
}
