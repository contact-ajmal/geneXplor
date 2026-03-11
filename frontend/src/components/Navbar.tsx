import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dna, Search, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Navbar({ darkMode, onToggleDarkMode }: NavbarProps) {
  const [navSearch, setNavSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const showSearch = location.pathname !== '/';

  const handleNavSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = navSearch.trim().toUpperCase();
    if (symbol) {
      navigate(`/gene/${symbol}`);
      setNavSearch('');
    }
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-cyan/[0.06]"
      style={{
        background: 'rgba(10, 14, 26, 0.8)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-none"
        >
          <Dna className="w-6 h-6 text-cyan" />
          <span className="font-heading font-bold text-lg text-text-primary tracking-tight">
            Gene<span className="text-cyan">Xplor</span>
          </span>
        </button>

        {/* Nav search — visible after navigating away from home */}
        {showSearch && (
          <motion.form
            onSubmit={handleNavSearch}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            transition={{ duration: 0.3 }}
            className="flex-1 max-w-md"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Search gene..."
                className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm font-mono
                           bg-space-700/60 border border-space-600/60 text-text-primary
                           placeholder:text-text-muted/50
                           focus:outline-none focus:border-cyan/30 focus:ring-1 focus:ring-cyan/20
                           transition-all"
              />
            </div>
          </motion.form>
        )}

        {/* Dark/light toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
                     transition-colors cursor-pointer bg-transparent border-none"
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
      </div>
    </motion.nav>
  );
}
