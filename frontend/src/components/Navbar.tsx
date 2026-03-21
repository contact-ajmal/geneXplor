import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dna, Moon, Sun, GitCompare, TrendingUp, Star } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useWatchlist } from '../hooks/useWatchlist';
import SmartSearch from './SmartSearch';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Navbar({ darkMode, onToggleDarkMode }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const { count: watchlistCount } = useWatchlist();

  const shortcuts = useMemo(() => ({
    'mod+k': () => {
      const input = document.querySelector<HTMLInputElement>('nav input[type="text"]');
      input?.focus();
    },
    'escape': () => {
      const input = document.querySelector<HTMLInputElement>('nav input[type="text"]');
      input?.blur();
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

        {/* Center: Smart Search (hidden on home page — hero has its own) */}
        {!isHome && (
          <SmartSearch variant="navbar" className="flex-1 max-w-lg" />
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
