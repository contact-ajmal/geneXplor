import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Table, FileText, FileJson, FileCode, Link2, ClipboardList,
  Download, Database, AlertTriangle, Activity, Dna,
} from 'lucide-react';
import type { DashboardOutletContext } from '../../components/dashboard/DashboardLayout';
import ExportToolbar from '../../components/gene/ExportToolbar';
import GlassCard from '../../components/ui/GlassCard';

export default function ReportTab() {
  const { data, symbol, showToast } = useOutletContext<DashboardOutletContext>();
  const { gene, variants, allele_frequencies, protein, metadata, publications, reconciliation } = data;

  const stats = useMemo(() => {
    const clinvarCount = variants?.variants.length || 0;
    const pathogenic = variants?.variants.filter(v =>
      v.clinical_significance.toLowerCase().includes('pathogenic') &&
      !v.clinical_significance.toLowerCase().includes('benign')
    ).length || 0;
    const diseaseCount = variants?.diseases.length || 0;
    const sourcesAvailable = Object.values(metadata.data_sources).filter(Boolean).length;

    return { clinvarCount, pathogenic, diseaseCount, sourcesAvailable };
  }, [variants, metadata]);

  const EXPORT_FORMATS = [
    {
      icon: Table,
      name: 'CSV Export',
      desc: 'Download all variant data as a spreadsheet-compatible CSV file. Includes variant IDs, clinical significance, allele frequencies, population data, and conditions.',
      color: 'text-success',
    },
    {
      icon: FileText,
      name: 'PDF Report',
      desc: 'Generate a multi-page PDF report with cover page, gene overview, protein structure, variant analytics, disease associations, and publication references.',
      color: 'text-primary',
    },
    {
      icon: ClipboardList,
      name: 'Clinical Report (ACMG)',
      desc: 'Generate an ACMG-formatted clinical gene report with customizable sections. Choose variant filters, select sections, and preview before downloading.',
      color: 'text-danger',
    },
    {
      icon: FileJson,
      name: 'JSON Export',
      desc: 'Export structured clinical report data as JSON for programmatic analysis. Includes gene summary, variant classifications, disease associations, and methodology.',
      color: 'text-warning',
    },
    {
      icon: FileCode,
      name: 'Markdown Export',
      desc: 'Export the clinical report as a Markdown document. Ideal for documentation, research notes, or embedding in publications and reports.',
      color: 'text-purple-400',
    },
    {
      icon: Link2,
      name: 'Share Link',
      desc: 'Copy a direct link to this gene dashboard. Share with collaborators for instant access to the same data view.',
      color: 'text-text-secondary',
    },
  ];

  const DATA_INCLUDED = [
    'Gene summary & coordinates',
    'Protein function & domain structure',
    'All ClinVar variant classifications',
    'gnomAD population allele frequencies',
    'Disease associations with variant counts',
    'Cross-database reconciliation conflicts',
    'PubMed research publications',
    'Biological pathway memberships',
    'Protein-protein interaction partners',
    'Data source metadata & access dates',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-heading font-bold text-text-heading flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Export Reports
        </h2>
        <p className="text-sm text-text-secondary font-body mt-1">
          Export <span className="font-mono text-primary">{symbol}</span> data in multiple formats for analysis, reporting, and sharing.
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Variants', value: stats.clinvarCount, color: 'text-primary', icon: Dna },
          { label: 'Pathogenic', value: stats.pathogenic, color: 'text-danger', icon: AlertTriangle },
          { label: 'Data Sources', value: stats.sourcesAvailable, color: 'text-success', icon: Database },
          { label: 'Diseases', value: stats.diseaseCount, color: 'text-warning', icon: Activity },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <GlassCard key={stat.label}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-ocean-50 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-heading font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] text-text-muted font-body">{stat.label}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Export Actions */}
      <GlassCard>
        <h3 className="text-sm font-heading font-semibold text-text-heading mb-4 uppercase tracking-wider">
          Quick Export
        </h3>
        <ExportToolbar
          gene={gene}
          clinvarVariants={variants?.variants || []}
          gnomadVariants={allele_frequencies?.variants || []}
          protein={protein}
          metadata={metadata}
          filteredVariantIds={null}
          onToast={showToast}
        />
      </GlassCard>

      {/* Export Formats Guide */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-heading mb-4 uppercase tracking-wider">
          Available Formats
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXPORT_FORMATS.map((fmt, i) => {
            const Icon = fmt.icon;
            return (
              <motion.div
                key={fmt.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard>
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-ocean-50 flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${fmt.color}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-heading font-semibold text-text-heading mb-1">{fmt.name}</h4>
                      <p className="text-xs text-text-secondary font-body leading-relaxed">{fmt.desc}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* What's Included */}
      <GlassCard>
        <h3 className="text-sm font-heading font-semibold text-text-heading mb-4 uppercase tracking-wider">
          Data Included in Reports
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {DATA_INCLUDED.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-sm text-text-secondary font-body">{item}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Research Disclaimer */}
      <div className="p-4 rounded-xl border border-danger/20 bg-danger-light">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-heading font-semibold text-danger mb-1">Research Use Only</p>
            <p className="text-xs text-danger/70 font-body leading-relaxed">
              All exported reports and data are auto-generated from public databases (ClinVar, gnomAD, UniProt, PubMed, Ensembl).
              They have not been reviewed by a certified clinical geneticist and are not intended for clinical decision-making,
              diagnostic use, or patient care. Always consult qualified healthcare professionals for clinical interpretation.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
