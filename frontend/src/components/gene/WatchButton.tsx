import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { useWatchlist } from '../../hooks/useWatchlist';

interface WatchButtonProps {
  symbol: string;
  size?: 'sm' | 'md';
  onToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function WatchButton({ symbol, size = 'md', onToast }: WatchButtonProps) {
  const { isWatched, addGene, removeGene, count, maxSize, allTags } = useWatchlist();
  const watched = isWatched(symbol);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleClick = () => {
    if (watched) {
      setShowConfirm(true);
    } else {
      if (count >= maxSize) {
        onToast?.('error', `Watchlist full (max ${maxSize} genes)`);
        return;
      }
      setShowNoteModal(true);
    }
  };

  const handleAdd = () => {
    const added = addGene(symbol, note, tags);
    if (added) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
      onToast?.('success', `${symbol} added to watchlist`);
    }
    setShowNoteModal(false);
    setNote('');
    setTags([]);
    setTagInput('');
  };

  const handleRemove = () => {
    removeGene(symbol);
    setShowConfirm(false);
    onToast?.('info', `${symbol} removed from watchlist`);
  };

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const isSm = size === 'sm';

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        className={`relative inline-flex items-center gap-1.5 rounded-lg font-body font-medium
          transition-all cursor-pointer border
          ${watched
            ? 'bg-amber/10 border-amber/30 text-amber hover:bg-amber/20'
            : 'bg-space-700/60 border-space-600/60 text-text-secondary hover:border-cyan/30 hover:text-cyan'
          }
          ${isSm ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}
        `}
        title={watched ? `Unwatch ${symbol}` : `Watch ${symbol}`}
      >
        <Star
          className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${watched ? 'fill-amber' : ''}`}
        />
        {!isSm && <span>{watched ? 'Watching' : 'Watch'}</span>}

        {/* Confetti burst */}
        <AnimatePresence>
          {showConfetti && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: 0,
                    scale: 1,
                    x: (Math.random() - 0.5) * 60,
                    y: (Math.random() - 0.5) * 60,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute text-amber pointer-events-none"
                  style={{ fontSize: 10 + Math.random() * 6 }}
                >
                  ★
                </motion.span>
              ))}
            </>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showNoteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNoteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-cyan/10 p-6 glass-bg backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-heading font-semibold text-text-primary">
                  Watch <span className="font-mono text-cyan">{symbol}</span>
                </h3>
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="p-1 rounded-md text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="block text-text-secondary text-xs font-body mb-1">
                Note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="Why are you watching this gene?"
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm font-body
                  bg-space-800/60 border border-space-600/60 text-text-primary
                  placeholder:text-text-muted/50
                  focus:outline-none focus:border-cyan/30 focus:ring-1 focus:ring-cyan/20
                  transition-all resize-none mb-1"
              />
              <p className="text-text-muted text-[10px] font-mono text-right mb-3">
                {note.length}/200
              </p>

              <label className="block text-text-secondary text-xs font-body mb-1">
                Tags
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g. cancer, cardiac"
                  list="watchlist-tags"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-mono
                    bg-space-800/60 border border-space-600/60 text-text-primary
                    placeholder:text-text-muted/50
                    focus:outline-none focus:border-cyan/30 focus:ring-1 focus:ring-cyan/20
                    transition-all"
                />
                <datalist id="watchlist-tags">
                  {allTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-body font-semibold
                    bg-cyan/10 text-cyan border border-cyan/20
                    hover:bg-cyan/20 transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono
                        bg-cyan/10 text-cyan border border-cyan/20"
                    >
                      {t}
                      <button
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        className="hover:text-magenta transition-colors cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleAdd}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body font-semibold
                    bg-gradient-to-r from-cyan to-cyan-dim text-space-900
                    hover:shadow-[0_0_24px_rgba(0,212,255,0.35)]
                    transition-all cursor-pointer border-none"
                >
                  Add to Watchlist
                </button>
                <button
                  onClick={() => { setShowNoteModal(false); handleAdd(); }}
                  className="px-4 py-2 rounded-lg text-sm font-body text-text-secondary
                    border border-space-600/60 hover:border-space-500 transition-colors cursor-pointer bg-transparent"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Remove Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl border border-magenta/10 p-5 glass-bg backdrop-blur-xl text-center"
            >
              <p className="text-sm font-body text-text-primary mb-4">
                Remove <span className="font-mono text-cyan">{symbol}</span> from watchlist?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRemove}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body font-semibold
                    bg-magenta/10 text-magenta border border-magenta/20
                    hover:bg-magenta/20 transition-colors cursor-pointer"
                >
                  Remove
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-body text-text-secondary
                    border border-space-600/60 hover:border-space-500 transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
