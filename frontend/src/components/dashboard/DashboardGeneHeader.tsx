import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ExternalLink, BookOpen, GitCompare, Download, ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { EnsemblGeneData, ResponseMetadata } from '../../lib/api';
import DecodeText from '../ui/DecodeText';
import GlowBadge from '../ui/GlowBadge';
import WatchButton from '../gene/WatchButton';

interface DashboardGeneHeaderProps {
  gene: EnsemblGeneData;
  metadata: ResponseMetadata;
  aiSummary?: string;
  onToast?: (type: 'success' | 'error' | 'info', message: string) => void;
  onExport?: (format: string) => void;
}

export default function DashboardGeneHeader({ gene, metadata, aiSummary, onToast, onExport }: DashboardGeneHeaderProps) {
  const navigate = useNavigate();
  const [showExport, setShowExport] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const upperSymbol = gene.gene_symbol;
  const sources = metadata.data_sources;
  const activeSources = Object.entries(sources).filter(([, ok]) => ok);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-14 z-30 border-b border-cyan/[0.06] px-4 md:px-6 py-3"
      style={{
        background: 'rgba(10, 14, 26, 0.92)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-[1600px] mx-auto">
        {/* Main row */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          {/* Gene symbol + name */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-2xl md:text-4xl font-heading font-bold shrink-0">
              <DecodeText text={upperSymbol} className="font-mono text-cyan" speed={35} />
            </h1>
            <WatchButton symbol={upperSymbol} onToast={onToast} />
          </div>

          {/* Badges */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <GlowBadge color="cyan">Chr {gene.chromosome}</GlowBadge>
            <GlowBadge color={gene.strand === 1 ? 'green' : 'amber'}>
              {gene.strand === 1 ? '+' : '-'} strand
            </GlowBadge>
            <GlowBadge color="muted">{gene.biotype.replace(/_/g, ' ')}</GlowBadge>
            <span className="font-mono text-text-muted text-xs hidden lg:inline">
              chr{gene.chromosome}:{gene.start.toLocaleString()}-{gene.end.toLocaleString()}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/gene/${upperSymbol}/story`}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body
                text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
                border border-space-600/40 hover:border-cyan/20 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Story Mode
            </Link>

            <button
              onClick={() => navigate(`/compare?gene=${upperSymbol}`)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body
                text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
                border border-space-600/40 hover:border-cyan/20 transition-all cursor-pointer bg-transparent"
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare
            </button>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body
                  text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]
                  border border-space-600/40 hover:border-cyan/20 transition-all cursor-pointer bg-transparent"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden
                    bg-[rgba(15,22,40,0.95)] backdrop-blur-xl border border-space-500/40
                    shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50">
                    {['CSV', 'PDF', 'Export Reports', 'JSON', 'Markdown'].map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => { onExport?.(fmt); setShowExport(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-body
                          text-text-secondary hover:bg-space-700/60 hover:text-text-primary
                          transition-colors cursor-pointer border-none"
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Data source dots */}
            <div className="hidden lg:flex items-center gap-1.5 ml-2">
              {activeSources.map(([source]) => (
                <span key={source} title={source} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-helix-green" />
                  <span className="text-text-muted text-[10px] font-mono capitalize">{source}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Gene name row */}
        <p className="text-text-secondary font-body text-sm mt-1 hidden md:block">
          {gene.gene_name || gene.description}
          <a
            href={`https://ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensembl_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-3 text-cyan/60 hover:text-cyan transition-colors font-mono text-[11px]"
          >
            {gene.ensembl_id}
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </p>

        {/* Collapsible AI Summary */}
        {aiSummary && (
          <div className="mt-2 hidden md:block">
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-body text-text-muted hover:text-text-secondary
                transition-colors cursor-pointer bg-transparent border-none"
            >
              <GlowBadge color="cyan" className="text-[9px]">AI</GlowBadge>
              <span className={summaryExpanded ? '' : 'line-clamp-1'}>
                {aiSummary}
              </span>
              {summaryExpanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
