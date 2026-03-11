import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, GitCompare } from 'lucide-react';

interface CompareLoadingPageProps {
  symbolA: string;
  symbolB: string;
}

const DATA_SOURCES = [
  { name: 'Ensembl', label: 'Querying genome database...', color: '#00d4ff' },
  { name: 'UniProt', label: 'Fetching protein data...', color: '#ffaa00' },
  { name: 'ClinVar', label: 'Loading clinical variants...', color: '#ff3366' },
  { name: 'gnomAD', label: 'Retrieving frequencies...', color: '#00ff88' },
  { name: 'PubMed', label: 'Searching literature...', color: '#00d4ff' },
];

export default function CompareLoadingPage({
  symbolA,
  symbolB,
}: CompareLoadingPageProps) {
  const [completedA, setCompletedA] = useState(0);
  const [completedB, setCompletedB] = useState(0);

  useEffect(() => {
    const timingsA = [500, 1000, 1500, 2000, 2500];
    const timingsB = [700, 1200, 1700, 2200, 2700];
    const timers = [
      ...timingsA.map((d, i) => setTimeout(() => setCompletedA(i + 1), d)),
      ...timingsB.map((d, i) => setTimeout(() => setCompletedB(i + 1), d)),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const totalProgress =
    ((completedA + completedB) / (DATA_SOURCES.length * 2)) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-space-900/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-6"
      >
        <GitCompare
          className="w-16 h-16 text-cyan"
          style={{ animation: 'spin-slow 3s linear infinite' }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow:
              '0 0 40px rgba(0,212,255,0.2), 0 0 80px rgba(0,212,255,0.1)',
            animation: 'glow-pulse 2s ease-in-out infinite',
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
          Comparing{' '}
          <span className="font-mono text-cyan">{symbolA}</span>
          <span className="text-text-muted mx-2">vs</span>
          <span className="font-mono text-magenta">{symbolB}</span>
        </h2>
        <p className="text-text-secondary text-sm font-body">
          Fetching data for both genes simultaneously
        </p>
      </motion.div>

      {/* Two-column source status */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-0 w-full max-w-lg">
        {/* Gene A column */}
        <div>
          <p className="text-xs font-mono text-cyan text-center mb-2">
            {symbolA}
          </p>
          {DATA_SOURCES.map((source, i) => {
            const done = i < completedA;
            const active = i === completedA;
            return (
              <motion.div
                key={`a-${source.name}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 ${
                  active ? 'bg-space-700/60 border border-cyan/20' : ''
                }`}
              >
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      <CheckCircle
                        className="w-3.5 h-3.5"
                        style={{ color: source.color }}
                      />
                    </motion.div>
                  ) : active ? (
                    <motion.div
                      key="spinner"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="w-3.5 h-3.5 rounded-full border-2 border-transparent shrink-0"
                      style={{
                        borderTopColor: source.color,
                        borderRightColor: source.color,
                      }}
                    />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-space-500/50 shrink-0" />
                  )}
                </AnimatePresence>
                <span
                  className={`text-xs font-body transition-colors ${
                    done
                      ? 'text-text-secondary'
                      : active
                        ? 'text-text-primary'
                        : 'text-text-muted'
                  }`}
                >
                  {source.name}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Gene B column */}
        <div>
          <p className="text-xs font-mono text-magenta text-center mb-2">
            {symbolB}
          </p>
          {DATA_SOURCES.map((source, i) => {
            const done = i < completedB;
            const active = i === completedB;
            return (
              <motion.div
                key={`b-${source.name}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.08 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 ${
                  active ? 'bg-space-700/60 border border-magenta/20' : ''
                }`}
              >
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      <CheckCircle
                        className="w-3.5 h-3.5"
                        style={{ color: source.color }}
                      />
                    </motion.div>
                  ) : active ? (
                    <motion.div
                      key="spinner"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                      className="w-3.5 h-3.5 rounded-full border-2 border-transparent shrink-0"
                      style={{
                        borderTopColor: source.color,
                        borderRightColor: source.color,
                      }}
                    />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-space-500/50 shrink-0" />
                  )}
                </AnimatePresence>
                <span
                  className={`text-xs font-body transition-colors ${
                    done
                      ? 'text-text-secondary'
                      : active
                        ? 'text-text-primary'
                        : 'text-text-muted'
                  }`}
                >
                  {source.name}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-lg mt-6"
      >
        <div className="h-1 rounded-full bg-space-700 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan via-purple-400 to-magenta"
            initial={{ width: '0%' }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
