import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only handle Escape in inputs
        if (e.key === 'Escape') {
          shortcuts['escape']?.(e);
        }
        // Allow mod+k even in inputs
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          shortcuts['mod+k']?.(e);
        }
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'k') {
        e.preventDefault();
        shortcuts['mod+k']?.(e);
      }

      if (e.key === 'Escape') {
        shortcuts['escape']?.(e);
      }

      // Number keys 1-9 for tab switching
      if (!isMod && !e.altKey && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          shortcuts[`tab-${num}`]?.(e);
        }

        // [ and ] for prev/next tab
        if (e.key === '[') {
          shortcuts['prev-tab']?.(e);
        }
        if (e.key === ']') {
          shortcuts['next-tab']?.(e);
        }

        // w for watch toggle
        if (e.key === 'w' || e.key === 'W') {
          shortcuts['watch']?.(e);
        }

        // e for export
        if (e.key === 'e' || e.key === 'E') {
          shortcuts['export']?.(e);
        }

        // s for story mode
        if (e.key === 's' || e.key === 'S') {
          shortcuts['story']?.(e);
        }

        // ? for help
        if (e.key === '?') {
          shortcuts['help']?.(e);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
