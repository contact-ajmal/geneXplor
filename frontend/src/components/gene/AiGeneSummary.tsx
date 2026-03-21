import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchGeneSummary } from '../../lib/api';
import type { GeneSummaryResponse } from '../../lib/api';
import GlowBadge from '../ui/GlowBadge';
import AnimatedButton from '../ui/AnimatedButton';

interface AiGeneSummaryProps {
  geneSymbol: string;
  delay?: number;
}

/** Highlight gene symbols (ALL-CAPS 2-10 chars) in text */
function highlightText(text: string): React.ReactNode[] {
  // Match gene symbols (2-10 uppercase letters/digits), common disease terms, and numbers with commas
  const parts = text.split(/((?<!\w)[A-Z][A-Z0-9]{1,9}(?!\w))/g);
  return parts.map((part, i) => {
    if (/^[A-Z][A-Z0-9]{1,9}$/.test(part) && part.length >= 2) {
      return (
        <span key={i} className="font-mono text-primary">
          {part}
        </span>
      );
    }
    return part;
  });
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AiGeneSummary({ geneSymbol, delay = 0 }: AiGeneSummaryProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const prevSummaryRef = useRef<string>('');

  const { data, isLoading, error, refetch, isFetching } = useQuery<GeneSummaryResponse, Error>({
    queryKey: ['gene-summary', geneSymbol],
    queryFn: () => fetchGeneSummary(geneSymbol),
    enabled: geneSymbol.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Typing animation effect
  useEffect(() => {
    if (!data?.summary) return;

    // If same summary as before (e.g. from cache), show immediately
    if (data.summary === prevSummaryRef.current) {
      setDisplayedText(data.summary);
      setTypingDone(true);
      return;
    }

    prevSummaryRef.current = data.summary;
    setTypingDone(false);
    setDisplayedText('');

    const text = data.summary;
    let idx = 0;
    const chunkSize = 3; // characters per tick
    const interval = setInterval(() => {
      idx += chunkSize;
      if (idx >= text.length) {
        setDisplayedText(text);
        setTypingDone(true);
        clearInterval(interval);
      } else {
        setDisplayedText(text.slice(0, idx));
      }
    }, 12);

    return () => clearInterval(interval);
  }, [data?.summary]);

  const handleRegenerate = useCallback(() => {
    prevSummaryRef.current = '';
    setDisplayedText('');
    setTypingDone(false);
    refetch();
  }, [refetch]);

  const paragraphs = useMemo(() => {
    if (!displayedText) return [];
    return displayedText.split('\n\n').filter(p => p.trim());
  }, [displayedText]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-ocean-100 bg-white p-5 relative overflow-hidden"
    >
      {/* Subtle gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <Sparkles className="w-4 h-4 text-[#a855f7]" />
          <h2 className="text-sm font-heading font-semibold text-text-heading uppercase tracking-wider">
            AI Gene Summary
          </h2>
          {isCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-colors" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-colors" />
          )}
        </button>
        <GlowBadge color="muted" className="text-[9px] px-1.5 py-0 bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/25">
          AI
        </GlowBadge>
      </div>

      {!isCollapsed && (
        <p className="text-text-muted text-xs font-body mb-4">
          Clinical overview generated from aggregated data
        </p>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Loading state */}
            {(isLoading || (isFetching && !data)) && (
              <div className="py-6 flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-text-muted text-xs font-body animate-pulse">
                  Generating clinical summary...
                </p>
              </div>
            )}

            {/* Error state */}
            {error && !data && (
              <div className="py-4 text-center">
                <AlertTriangle className="w-5 h-5 text-warning mx-auto mb-2" />
                <p className="text-text-muted text-xs font-body">
                  Insufficient data to generate summary
                </p>
              </div>
            )}

            {/* Summary text */}
            {displayedText && (
              <div className="space-y-3 mb-4">
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    className="text-text-secondary text-sm font-body leading-relaxed"
                  >
                    {typingDone ? highlightText(para) : para}
                  </p>
                ))}
                {!typingDone && (
                  <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            )}

            {/* Footer */}
            {data && typingDone && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-ocean-100">
                <div className="flex items-center gap-3">
                  <GlowBadge
                    color={data.source === 'ai' ? 'cyan' : 'muted'}
                    className="text-[9px] px-1.5 py-0"
                  >
                    {data.source === 'ai' ? 'AI-generated' : 'Template-generated'}
                  </GlowBadge>
                  <span className="text-text-muted text-[10px] font-mono">
                    Generated {timeAgo(data.generated_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AnimatedButton
                    variant="ghost"
                    onClick={handleRegenerate}
                    disabled={isFetching}
                    className="text-[10px]"
                  >
                    <span className="flex items-center gap-1">
                      <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
                      Regenerate
                    </span>
                  </AnimatedButton>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            {data && typingDone && (
              <p className="text-text-muted/60 text-[10px] font-body mt-2 leading-relaxed">
                This summary is auto-generated from public data sources and should not be used for clinical decision-making.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
