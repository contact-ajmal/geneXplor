import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        shortcuts['mod+k']?.(e);
      }

      if (e.key === 'Escape') {
        shortcuts['escape']?.(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
