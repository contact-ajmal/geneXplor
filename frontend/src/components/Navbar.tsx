import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dna, GitCompare, TrendingUp, Star } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useWatchlist } from '../hooks/useWatchlist';
import SmartSearch from './SmartSearch';

export default function Navbar() {
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
      className="fixed top-0 left-0 right-0 z-50 border-b border-ocean-700 bg-ocean-800"
      style={{ height: '56px' }}
    >
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-none shrink-0"
        >
          <Dna className="w-6 h-6 text-white" />
          <span className="font-heading font-bold text-lg text-white tracking-tight hidden sm:inline">
            Gene<span className="text-ocean-200">Xplor</span>
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
            className="p-2 rounded-lg text-ocean-200 hover:text-white hover:bg-white/10
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
            className="p-2 rounded-lg text-ocean-200 hover:text-white hover:bg-white/10
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
            className="p-2 rounded-lg text-ocean-200 hover:text-white hover:bg-white/10
              transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5 relative"
            aria-label="Watchlist"
            title="Watchlist"
          >
            <Star className={`w-4 h-4 ${watchlistCount > 0 ? 'fill-warning text-warning' : ''}`} />
            <span className="hidden lg:inline text-xs font-body">Watchlist</span>
            {watchlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center
                px-1 rounded-full text-[9px] font-mono font-bold bg-danger text-white">
                {watchlistCount}
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
}
