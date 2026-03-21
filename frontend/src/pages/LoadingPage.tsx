import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, CheckCircle } from 'lucide-react';

interface LoadingPageProps {
  symbol: string;
}

const DATA_SOURCES = [
  { name: 'Ensembl', label: 'Querying Ensembl genome database...', color: '#1A7FA0' },
  { name: 'UniProt', label: 'Fetching UniProt protein data...', color: '#D97706' },
  { name: 'ClinVar', label: 'Loading ClinVar clinical variants...', color: '#DC2626' },
  { name: 'gnomAD', label: 'Retrieving gnomAD frequencies...', color: '#059669' },
  { name: 'PubMed', label: 'Searching PubMed literature...', color: '#1A7FA0' },
];

export default function LoadingPage({ symbol }: LoadingPageProps) {
  const [completedSources, setCompletedSources] = useState<number>(0);

  useEffect(() => {
    // Simulate sequential data source completion with realistic timings
    const timings = [600, 1200, 1800, 2400, 3000];
    const timers = timings.map((delay, i) =>
      setTimeout(() => setCompletedSources(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/95">
      {/* DNA Spinner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative mb-8"
      >
        <Dna
          className="w-20 h-20 text-primary"
          style={{ animation: 'spin-slow 2s linear infinite' }}
        />
      </motion.div>

      {/* Gene symbol */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h2 className="text-3xl font-heading font-bold text-text-heading mb-2">
          Decoding <span className="font-mono text-primary">{symbol}</span>
        </h2>
        <p className="text-text-secondary text-sm font-body">
          Aggregating data from genomic databases
        </p>
      </motion.div>

      {/* Data source status list */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-sm space-y-3"
      >
        {DATA_SOURCES.map((source, i) => {
          const isCompleted = i < completedSources;
          const isActive = i === completedSources;

          return (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300
                ${isActive ? 'bg-ocean-50 border border-ocean-200' : 'bg-transparent'}
              `}
            >
              {/* Status indicator */}
              <AnimatePresence mode="wait">
                {isCompleted ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <CheckCircle className="w-4 h-4" style={{ color: source.color }} />
                  </motion.div>
                ) : isActive ? (
                  <motion.div
                    key="spinner"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2 border-transparent shrink-0"
                    style={{ borderTopColor: source.color, borderRightColor: source.color }}
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-ocean-200 shrink-0" />
                )}
              </AnimatePresence>

              <span
                className={`text-sm font-body transition-colors ${
                  isCompleted
                    ? 'text-text-secondary'
                    : isActive
                      ? 'text-text-heading'
                      : 'text-text-muted'
                }`}
              >
                {source.label}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-sm mt-8"
      >
        <div className="h-1 rounded-full bg-ocean-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
            initial={{ width: '0%' }}
            animate={{ width: `${(completedSources / DATA_SOURCES.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
