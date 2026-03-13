import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Download,
  FileJson,
  FileCode,
  Loader2,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
  Square,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import AnimatedButton from '../ui/AnimatedButton';
import GlassCard from '../ui/GlassCard';
import {
  fetchClinicalReport,
  downloadClinicalReportPdf,
  downloadClinicalReportMarkdown,
} from '../../lib/api';
import type { ClinicalReportResponse } from '../../lib/api';

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  geneSymbol: string;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type ReportFormat = 'pdf' | 'json' | 'markdown';
type VariantFilter = 'all' | 'pathogenic_lp' | 'pathogenic_lp_vus';
type Step = 'configure' | 'loading' | 'preview';

const SECTIONS = [
  { key: 'gene_summary', label: 'Gene Summary' },
  { key: 'variant_summary', label: 'Variant Summary Table' },
  { key: 'disease_associations', label: 'Disease Associations' },
  { key: 'variant_classification', label: 'Variant Classification Details' },
  { key: 'population_frequencies', label: 'Population Frequencies' },
  { key: 'protein_impact', label: 'Protein Impact Analysis' },
  { key: 'research_context', label: 'Research Context' },
  { key: 'methodology', label: 'Methodology' },
] as const;

const LOADING_STEPS = [
  'Compiling variant data...',
  'Analyzing classifications...',
  'Building disease associations...',
  'Generating report...',
];

function sigColor(sig: string): string {
  const s = sig.toLowerCase();
  if (s.includes('pathogenic') && !s.includes('likely') && !s.includes('benign'))
    return 'text-magenta';
  if (s.includes('likely pathogenic')) return 'text-amber';
  if (s.includes('uncertain')) return 'text-yellow-400';
  if (s.includes('likely benign')) return 'text-green-400';
  if (s.includes('benign')) return 'text-helix';
  return 'text-text-secondary';
}

export default function ClinicalReportModal({
  isOpen,
  onClose,
  geneSymbol,
  onToast,
}: ClinicalReportModalProps) {
  const [step, setStep] = useState<Step>('configure');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [variantFilter, setVariantFilter] = useState<VariantFilter>('all');
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.key, true])),
  );
  const [loadingStep, setLoadingStep] = useState(0);
  const [report, setReport] = useState<ClinicalReportResponse | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const enabledSections = Object.entries(selectedSections)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const toggleSection = useCallback((key: string) => {
    setSelectedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleGenerate = useCallback(async () => {
    setStep('loading');
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 800);

    try {
      const options = {
        variant_filter: variantFilter,
        sections: enabledSections,
      };

      // Always fetch JSON report for preview
      const reportData = await fetchClinicalReport(geneSymbol, options);
      setReport(reportData);

      if (format === 'markdown') {
        const md = await downloadClinicalReportMarkdown(geneSymbol, options);
        setMarkdownContent(md);
      }

      clearInterval(interval);
      setStep('preview');
    } catch (err) {
      clearInterval(interval);
      onToast('error', `Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('configure');
    }
  }, [geneSymbol, variantFilter, enabledSections, format, onToast]);

  const handleDownload = useCallback(async () => {
    try {
      const options = {
        variant_filter: variantFilter,
        sections: enabledSections,
      };

      if (format === 'pdf') {
        await downloadClinicalReportPdf(geneSymbol, options);
        onToast('success', 'Clinical report PDF downloaded');
      } else if (format === 'markdown') {
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${geneSymbol}_clinical_report.md`;
        link.click();
        URL.revokeObjectURL(url);
        onToast('success', 'Clinical report Markdown downloaded');
      } else {
        const json = JSON.stringify(report, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${geneSymbol}_clinical_report.json`;
        link.click();
        URL.revokeObjectURL(url);
        onToast('success', 'Clinical report JSON downloaded');
      }
    } catch (err) {
      onToast('error', `Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [format, geneSymbol, variantFilter, enabledSections, report, markdownContent, onToast]);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast('success', 'Markdown copied to clipboard');
    } catch {
      onToast('error', 'Failed to copy to clipboard');
    }
  }, [markdownContent, onToast]);

  const handleReset = useCallback(() => {
    setStep('configure');
    setReport(null);
    setMarkdownContent('');
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-cyan/10 bg-[#0f1628] shadow-2xl shadow-cyan/5"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-space-600/30">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-cyan" />
              <div>
                <h2 className="text-base font-heading font-semibold text-text-primary">
                  Generate Clinical Report
                </h2>
                <p className="text-xs text-text-muted font-body">
                  <span className="font-mono text-cyan">{geneSymbol}</span> — ACMG-formatted report
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-space-700/60 transition-colors"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-130px)] p-6">
            {step === 'configure' && (
              <ConfigureStep
                selectedSections={selectedSections}
                toggleSection={toggleSection}
                variantFilter={variantFilter}
                setVariantFilter={setVariantFilter}
                format={format}
                setFormat={setFormat}
                onGenerate={handleGenerate}
              />
            )}

            {step === 'loading' && (
              <LoadingStep loadingStep={loadingStep} geneSymbol={geneSymbol} />
            )}

            {step === 'preview' && report && (
              <PreviewStep
                report={report}
                format={format}
                markdownContent={markdownContent}
                copied={copied}
                onDownload={handleDownload}
                onCopyMarkdown={handleCopyMarkdown}
                onBack={handleReset}
              />
            )}
          </div>

          {/* Disclaimer footer */}
          <div className="px-6 py-3 border-t border-space-600/30 bg-magenta/5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-magenta shrink-0 mt-0.5" />
              <p className="text-[10px] text-magenta/80 font-body leading-tight">
                FOR RESEARCH USE ONLY — This report is auto-generated from public databases and has
                not been reviewed by a certified clinical geneticist. Not intended for clinical
                decision-making or diagnostic use.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Configure Step ──

function ConfigureStep({
  selectedSections,
  toggleSection,
  variantFilter,
  setVariantFilter,
  format,
  setFormat,
  onGenerate,
}: {
  selectedSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
  variantFilter: VariantFilter;
  setVariantFilter: (v: VariantFilter) => void;
  format: ReportFormat;
  setFormat: (f: ReportFormat) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Sections */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">
          Include Sections
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSection(s.key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all text-sm font-body ${
                selectedSections[s.key]
                  ? 'border-cyan/20 bg-cyan/5 text-text-primary'
                  : 'border-space-600/30 bg-space-800/30 text-text-muted'
              }`}
            >
              {selectedSections[s.key] ? (
                <CheckSquare className="w-4 h-4 text-cyan shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-text-muted shrink-0" />
              )}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Variant Filter */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">
          Variant Filter
        </h3>
        <div className="flex flex-col gap-2">
          {(
            [
              ['all', 'All variants'],
              ['pathogenic_lp', 'Pathogenic + Likely Pathogenic only'],
              ['pathogenic_lp_vus', 'Pathogenic + LP + VUS'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-body ${
                variantFilter === value
                  ? 'border-cyan/20 bg-cyan/5 text-text-primary'
                  : 'border-space-600/30 bg-space-800/30 text-text-muted hover:border-space-600/50'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  variantFilter === value ? 'border-cyan' : 'border-text-muted'
                }`}
              >
                {variantFilter === value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan" />
                )}
              </div>
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Format */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary mb-3">
          Output Format
        </h3>
        <div className="flex gap-2">
          {(
            [
              ['pdf', 'PDF', FileText],
              ['json', 'JSON', FileJson],
              ['markdown', 'Markdown', FileCode],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setFormat(value as ReportFormat)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-body transition-all ${
                format === value
                  ? 'border-cyan/30 bg-cyan/10 text-cyan'
                  : 'border-space-600/30 bg-space-800/30 text-text-muted hover:border-space-600/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer checkbox (always on) */}
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-magenta/20 bg-magenta/5">
        <CheckSquare className="w-4 h-4 text-magenta shrink-0" />
        <span className="text-sm text-magenta/80 font-body">
          Include disclaimer (required)
        </span>
      </div>

      {/* Generate button */}
      <AnimatedButton variant="primary" onClick={onGenerate} className="w-full">
        <span className="flex items-center justify-center gap-2">
          Generate Report
          <ChevronRight className="w-4 h-4" />
        </span>
      </AnimatedButton>
    </div>
  );
}

// ── Loading Step ──

function LoadingStep({
  loadingStep,
  geneSymbol,
}: {
  loadingStep: number;
  geneSymbol: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-cyan animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full bg-cyan/10 animate-ping" />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-heading font-semibold text-text-primary">
          Generating Clinical Report
        </h3>
        <p className="text-sm text-text-secondary font-body">
          <span className="font-mono text-cyan">{geneSymbol}</span>
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        {LOADING_STEPS.map((text, i) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, x: -10 }}
            animate={{
              opacity: i <= loadingStep ? 1 : 0.3,
              x: 0,
            }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className="flex items-center gap-2 text-sm font-body"
          >
            {i < loadingStep ? (
              <Check className="w-4 h-4 text-helix" />
            ) : i === loadingStep ? (
              <Loader2 className="w-4 h-4 text-cyan animate-spin" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-space-600" />
            )}
            <span className={i <= loadingStep ? 'text-text-primary' : 'text-text-muted'}>
              {text}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-text-muted font-body">Estimated time: ~10 seconds</p>
    </div>
  );
}

// ── Preview Step ──

function PreviewStep({
  report,
  format,
  markdownContent,
  copied,
  onDownload,
  onCopyMarkdown,
  onBack,
}: {
  report: ClinicalReportResponse;
  format: ReportFormat;
  markdownContent: string;
  copied: boolean;
  onDownload: () => void;
  onCopyMarkdown: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Edit & Regenerate
        </button>
        <div className="flex items-center gap-2">
          {format === 'markdown' && (
            <AnimatedButton variant="ghost" onClick={onCopyMarkdown}>
              <span className="flex items-center gap-1.5 text-xs">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Markdown'}
              </span>
            </AnimatedButton>
          )}
          <AnimatedButton variant="primary" onClick={onDownload}>
            <span className="flex items-center gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              Download {format.toUpperCase()}
            </span>
          </AnimatedButton>
        </div>
      </div>

      {/* Report Preview */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-6 space-y-6 max-h-[55vh] overflow-y-auto report-preview">
          {/* Header */}
          <div className="text-center space-y-2 pb-4 border-b border-space-600/30">
            <p className="text-xs text-text-muted font-body tracking-widest uppercase">
              GeneXplor Clinical Gene Report
            </p>
            <h2 className="text-3xl font-heading font-bold text-cyan">
              {report.gene_symbol}
            </h2>
            {report.gene_summary && (
              <p className="text-sm text-text-secondary font-body">
                {report.gene_summary.gene_name}
              </p>
            )}
            <p className="text-xs text-text-muted font-body">
              Generated: {report.generated_at.slice(0, 10)} | Filter:{' '}
              {report.variant_filter.replace(/_/g, ' ')}
            </p>
          </div>

          {/* Clinical Metrics */}
          {report.clinical_metrics && (
            <div className="grid grid-cols-3 gap-4">
              <MetricBox
                value={report.clinical_metrics.total_variants_analyzed}
                label="Total Variants"
                color="text-cyan"
              />
              <MetricBox
                value={`${report.clinical_metrics.pathogenic_variant_burden}%`}
                label="Pathogenic Burden"
                color="text-magenta"
              />
              <MetricBox
                value={report.clinical_metrics.vus_to_pathogenic_ratio}
                label="VUS:Path Ratio"
                color="text-amber"
              />
            </div>
          )}

          {/* Gene Summary */}
          {report.gene_summary && (
            <PreviewSection title="1. Gene Summary">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <InfoRow label="Symbol" value={report.gene_summary.gene_symbol} mono />
                <InfoRow label="Ensembl" value={report.gene_summary.ensembl_id} mono />
                <InfoRow label="Chromosome" value={report.gene_summary.chromosome} />
                <InfoRow label="Coordinates" value={report.gene_summary.coordinates} mono />
              </div>
              {report.gene_summary.function_summary && (
                <p className="text-xs text-text-secondary font-body mt-3 leading-relaxed">
                  {report.gene_summary.function_summary.slice(0, 300)}
                  {report.gene_summary.function_summary.length > 300 && '...'}
                </p>
              )}
            </PreviewSection>
          )}

          {/* Variant Summary */}
          {report.variant_summary && (
            <PreviewSection title="2. Variant Summary">
              <div className="flex flex-wrap gap-3 mb-3">
                <CountBadge label="Pathogenic" count={report.variant_summary.total_pathogenic} color="bg-red-500/10 text-red-400 border-red-500/20" />
                <CountBadge label="Likely Path." count={report.variant_summary.total_likely_pathogenic} color="bg-orange-500/10 text-orange-400 border-orange-500/20" />
                <CountBadge label="VUS" count={report.variant_summary.total_vus} color="bg-yellow-500/10 text-yellow-400 border-yellow-500/20" />
                <CountBadge label="Likely Benign" count={report.variant_summary.total_likely_benign} color="bg-green-500/10 text-green-400 border-green-500/20" />
                <CountBadge label="Benign" count={report.variant_summary.total_benign} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20" />
              </div>
              {report.variant_summary.variants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-space-600/40">
                        <th className="text-left py-1.5 px-2 text-cyan font-heading font-medium">Variant ID</th>
                        <th className="text-left py-1.5 px-2 text-cyan font-heading font-medium">HGVS</th>
                        <th className="text-left py-1.5 px-2 text-cyan font-heading font-medium">Significance</th>
                        <th className="text-left py-1.5 px-2 text-cyan font-heading font-medium">Stars</th>
                        <th className="text-right py-1.5 px-2 text-cyan font-heading font-medium">AF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.variant_summary.variants.slice(0, 15).map((v) => (
                        <tr key={v.variant_id} className="border-b border-space-700/30">
                          <td className="py-1 px-2 font-mono text-text-primary">{v.variant_id}</td>
                          <td className="py-1 px-2 font-mono text-text-secondary">
                            {(v.hgvs_protein || v.hgvs_coding || '—').slice(0, 25)}
                          </td>
                          <td className={`py-1 px-2 font-body ${sigColor(v.clinical_significance)}`}>
                            {v.clinical_significance}
                          </td>
                          <td className="py-1 px-2 text-amber">
                            {'★'.repeat(v.review_stars)}
                            {'☆'.repeat(4 - v.review_stars)}
                          </td>
                          <td className="py-1 px-2 text-right font-mono text-text-secondary">
                            {v.allele_frequency ? v.allele_frequency.toExponential(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.variant_summary.variants.length > 15 && (
                    <p className="text-xs text-text-muted mt-2 font-body">
                      Showing 15 of {report.variant_summary.variants.length} variants
                    </p>
                  )}
                </div>
              )}
            </PreviewSection>
          )}

          {/* Disease Associations */}
          {report.disease_associations.length > 0 && (
            <PreviewSection title="3. Disease Associations">
              <div className="space-y-2">
                {report.disease_associations.slice(0, 8).map((da) => (
                  <div
                    key={da.disease_name}
                    className="flex items-start justify-between py-1.5 border-b border-space-700/30 last:border-0"
                  >
                    <div>
                      <p className="text-sm text-text-primary font-body">{da.disease_name}</p>
                      {da.key_variants.length > 0 && (
                        <p className="text-xs text-text-muted font-mono mt-0.5">
                          {da.key_variants.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-magenta font-mono shrink-0 ml-2">
                      {da.pathogenic_variant_count} P/LP
                    </span>
                  </div>
                ))}
              </div>
            </PreviewSection>
          )}

          {/* Research Context */}
          {report.research_context && (
            <PreviewSection title="7. Research Context">
              <p className="text-sm text-text-secondary font-body">
                Publications (last 5 years): <span className="text-cyan font-mono">{report.research_context.total_publications_5yr}</span>
              </p>
              {report.research_context.key_references.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {report.research_context.key_references.slice(0, 3).map((ref) => (
                    <p key={ref.pmid} className="text-xs text-text-muted font-body">
                      {ref.authors} ({ref.year}). <em>{ref.title}</em>. {ref.journal}
                    </p>
                  ))}
                </div>
              )}
            </PreviewSection>
          )}

          {/* Methodology */}
          {report.methodology && (
            <PreviewSection title="8. Methodology">
              <p className="text-xs text-text-secondary font-body">
                Genome Build: <span className="font-mono">{report.methodology.genome_build}</span> |
                Access Date: <span className="font-mono">{report.methodology.access_date}</span>
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(report.methodology.data_sources).map(([src, ver]) => (
                  <span
                    key={src}
                    className="px-2 py-0.5 text-[10px] rounded border border-space-600/40 bg-space-800/40 text-text-muted font-body"
                  >
                    {src}: {ver}
                  </span>
                ))}
              </div>
            </PreviewSection>
          )}

          {/* Disclaimer */}
          <div className="p-3 rounded-lg border border-magenta/20 bg-magenta/5 text-center">
            <p className="text-xs text-magenta font-body font-semibold">{report.disclaimer}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ── Helper Components ──

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-heading font-semibold text-cyan mb-2">{title}</h3>
      {children}
    </div>
  );
}

function MetricBox({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="text-center p-3 rounded-lg border border-space-600/30 bg-space-800/30">
      <p className={`text-xl font-heading font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-text-muted font-body mt-0.5">{label}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-text-muted text-xs font-body">{label}:</span>
      <span className={`text-text-primary text-xs ${mono ? 'font-mono' : 'font-body'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function CountBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border font-body ${color}`}>
      {label}: {count}
    </span>
  );
}
