import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Star, Globe, Zap } from 'lucide-react';
import type { ClinVarVariant, GnomADVariant, UniProtData, PopulationFrequency, DiseaseAssociation } from '../../lib/api';
import GlowBadge from '../ui/GlowBadge';
import AnimatedButton from '../ui/AnimatedButton';

const PopulationMap = lazy(() => import('../viz/PopulationMap'));
const VariantImpactSimulator = lazy(() => import('../viz/VariantImpactSimulator'));

interface VariantDetailModalProps {
  variantId: string | null;
  clinvarVariants: ClinVarVariant[];
  gnomadVariants: GnomADVariant[];
  protein: UniProtData | null;
  diseases?: DiseaseAssociation[];
  initialTab?: 'details' | 'impact' | 'population';
  onClose: () => void;
}

interface MergedVariant {
  variant_id: string;
  title: string;
  clinical_significance: string;
  condition: string;
  review_status: string;
  variant_type: string;
  position: number;
  consequence: string;
  hgvsc: string;
  hgvsp: string;
  allele_frequency: number;
  allele_count: number;
  allele_number: number;
  population_frequencies: PopulationFrequency[];
  hasClinvar: boolean;
  hasGnomad: boolean;
}

const POPULATION_LABELS: Record<string, string> = {
  afr: 'African / African American',
  amr: 'Latino / Admixed American',
  asj: 'Ashkenazi Jewish',
  eas: 'East Asian',
  fin: 'Finnish',
  nfe: 'Non-Finnish European',
  sas: 'South Asian',
  oth: 'Other',
  ami: 'Amish',
  mid: 'Middle Eastern',
};

const POPULATION_COLORS: Record<string, string> = {
  afr: '#D64045',
  amr: '#D4A843',
  asj: '#a855f7',
  eas: '#1B4965',
  fin: '#4a9eff',
  nfe: '#2B9F78',
  sas: '#ff8c00',
  oth: '#64748b',
  ami: '#e879f9',
  mid: '#f97316',
};

function getSignificanceBadgeColor(sig: string): 'magenta' | 'amber' | 'cyan' | 'green' | 'muted' {
  const normalized = sig.toLowerCase();
  if (normalized.includes('pathogenic') && !normalized.includes('likely')) return 'magenta';
  if (normalized.includes('likely pathogenic') || normalized.includes('likely_pathogenic')) return 'amber';
  if (normalized.includes('benign') && !normalized.includes('likely')) return 'green';
  if (normalized.includes('likely benign') || normalized.includes('likely_benign')) return 'cyan';
  if (normalized.includes('uncertain') || normalized.includes('vus')) return 'amber';
  return 'muted';
}

function formatConsequence(consequence: string): string {
  return consequence
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getReviewStars(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('practice guideline')) return 4;
  if (s.includes('reviewed by expert panel')) return 3;
  if (s.includes('criteria provided, multiple submitters')) return 2;
  if (s.includes('criteria provided, single submitter')) return 1;
  return 0;
}

function parseProteinChange(hgvsp: string): { from: string; position: number; to: string } | null {
  const match = hgvsp.match(/p\.([A-Za-z]{3})(\d+)([A-Za-z]{3})/);
  if (match) return { from: match[1], position: parseInt(match[2], 10), to: match[3] };
  const simple = hgvsp.match(/p\.(\D+)(\d+)(\D+)/);
  if (simple) return { from: simple[1], position: parseInt(simple[2], 10), to: simple[3] };
  return null;
}

function extractClinVarId(variantId: string): string | null {
  // ClinVar variant IDs are often numeric or like "VCV000012345"
  const match = variantId.match(/(\d{4,})/);
  return match ? match[1] : null;
}

function extractRsId(title: string, variantId: string): string | null {
  const combined = `${title} ${variantId}`;
  const match = combined.match(/(rs\d+)/i);
  return match ? match[1] : null;
}

// ACMG criteria definitions
const ACMG_PATHOGENIC_CRITERIA = [
  { code: 'PVS1', description: 'Null variant in gene where LOF is a known mechanism' },
  { code: 'PS1', description: 'Same amino acid change as established pathogenic variant' },
  { code: 'PS2', description: 'De novo (confirmed) in patient with disease' },
  { code: 'PS3', description: 'Well-established functional studies show deleterious effect' },
  { code: 'PM1', description: 'Located in mutational hot spot or functional domain' },
  { code: 'PM2', description: 'Absent from controls or extremely low frequency' },
  { code: 'PP3', description: 'Multiple computational evidence supports deleterious effect' },
  { code: 'PP5', description: 'Reputable source reports variant as pathogenic' },
];

const ACMG_BENIGN_CRITERIA = [
  { code: 'BA1', description: 'Allele frequency >5% in population databases' },
  { code: 'BS1', description: 'Allele frequency greater than expected for disorder' },
  { code: 'BS2', description: 'Observed in healthy adult with full penetrance expected' },
  { code: 'BP4', description: 'Multiple computational evidence suggests no impact' },
  { code: 'BP6', description: 'Reputable source reports variant as benign' },
  { code: 'BP7', description: 'Synonymous variant with no predicted splice impact' },
];

export default function VariantDetailModal({
  variantId,
  clinvarVariants,
  gnomadVariants,
  protein,
  diseases = [],
  initialTab,
  onClose,
}: VariantDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'population' | 'impact'>('details');

  // Reset tab when variant changes
  useEffect(() => {
    setActiveTab(initialTab || 'details');
  }, [variantId, initialTab]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (variantId) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [variantId, handleKeyDown]);

  // Merge ClinVar + gnomAD data for the selected variant
  const variant = useMemo((): MergedVariant | null => {
    if (!variantId) return null;

    const cv = clinvarVariants.find(v => v.variant_id === variantId);
    const gv = gnomadVariants.find(v => v.variant_id === variantId);

    if (!cv && !gv) return null;

    return {
      variant_id: variantId,
      title: cv?.title || variantId,
      clinical_significance: cv?.clinical_significance || 'Not in ClinVar',
      condition: cv?.condition || '',
      review_status: cv?.review_status || '',
      variant_type: cv?.variant_type || gv?.consequence || '',
      position: gv?.position || 0,
      consequence: gv?.consequence || cv?.variant_type || '',
      hgvsc: gv?.hgvsc || '',
      hgvsp: gv?.hgvsp || '',
      allele_frequency: gv?.allele_frequency || 0,
      allele_count: gv?.allele_count || 0,
      allele_number: gv?.allele_number || 0,
      population_frequencies: gv?.population_frequencies || [],
      hasClinvar: !!cv,
      hasGnomad: !!gv,
    };
  }, [variantId, clinvarVariants, gnomadVariants]);

  // Find which protein domain is affected
  const affectedDomain = useMemo(() => {
    if (!variant?.hgvsp || !protein) return null;
    const parsed = parseProteinChange(variant.hgvsp);
    if (!parsed) return null;
    return protein.domains.find(d => parsed.position >= d.start && parsed.position <= d.end) || null;
  }, [variant, protein]);

  const proteinChange = useMemo(() => {
    if (!variant?.hgvsp) return null;
    return parseProteinChange(variant.hgvsp);
  }, [variant]);

  const reviewStars = useMemo(() => {
    if (!variant?.review_status) return 0;
    return getReviewStars(variant.review_status);
  }, [variant]);

  const clinvarId = useMemo(() => {
    if (!variant) return null;
    return extractClinVarId(variant.variant_id);
  }, [variant]);

  const rsId = useMemo(() => {
    if (!variant) return null;
    return extractRsId(variant.title, variant.variant_id);
  }, [variant]);

  // Sort population frequencies by AF descending
  const sortedPopFreqs = useMemo(() => {
    if (!variant?.population_frequencies.length) return [];
    return [...variant.population_frequencies].sort((a, b) => b.af - a.af);
  }, [variant]);

  const maxPopAf = useMemo(() => {
    if (!sortedPopFreqs.length) return 0;
    return Math.max(...sortedPopFreqs.map(p => p.af));
  }, [sortedPopFreqs]);

  // Determine variant type label for badge
  const variantTypeLabel = useMemo(() => {
    if (!variant) return '';
    const vt = variant.variant_type.toLowerCase();
    if (vt.includes('single') || vt.includes('snv') || vt.includes('snp')) return 'SNV';
    if (vt.includes('deletion')) return 'Deletion';
    if (vt.includes('insertion')) return 'Insertion';
    if (vt.includes('indel')) return 'Indel';
    if (vt.includes('duplication')) return 'Duplication';
    if (vt.includes('missense')) return 'SNV';
    if (vt.includes('frameshift')) return 'Frameshift';
    if (vt.includes('synonymous')) return 'SNV';
    if (vt.includes('stop')) return 'SNV';
    return variant.variant_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }, [variant]);

  const isProteinAltering = useMemo(() => {
    if (!variant) return false;
    const c = variant.consequence.toLowerCase();
    return c.includes('missense') || c.includes('frameshift') || c.includes('stop') ||
      c.includes('inframe') || c.includes('start_lost') || c.includes('splice');
  }, [variant]);

  return (
    <AnimatePresence>
      {variant && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-[720px] max-h-[85vh] overflow-y-auto mx-4 rounded-2xl border border-ocean-100 bg-white shadow-xl"
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-1.5 rounded-lg bg-ocean-50 border border-ocean-100 text-text-secondary hover:text-text-heading hover:border-ocean-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 space-y-6">
              {/* -- Header -- */}
              <div>
                <h2 className="font-mono text-lg text-primary pr-8 break-all leading-relaxed">
                  {variant.variant_id}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <GlowBadge color={getSignificanceBadgeColor(variant.clinical_significance)}>
                    {variant.clinical_significance}
                  </GlowBadge>
                  {variantTypeLabel && (
                    <GlowBadge color="muted">{variantTypeLabel}</GlowBadge>
                  )}
                </div>
              </div>

              {/* -- Tab Bar -- */}
              <div className="flex gap-1 p-0.5 rounded-lg bg-ocean-50 border border-ocean-100">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-semibold transition-all cursor-pointer
                    ${activeTab === 'details'
                      ? 'bg-primary-light text-primary border border-ocean-200'
                      : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('impact')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-semibold transition-all cursor-pointer
                    ${activeTab === 'impact'
                      ? 'bg-primary-light text-primary border border-ocean-200'
                      : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
                >
                  <Zap className="w-3 h-3" />
                  Impact
                </button>
                <button
                  onClick={() => setActiveTab('population')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-semibold transition-all cursor-pointer
                    ${activeTab === 'population'
                      ? 'bg-primary-light text-primary border border-ocean-200'
                      : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
                >
                  <Globe className="w-3 h-3" />
                  Population
                </button>
              </div>

              {/* -- Impact Simulator Tab -- */}
              {activeTab === 'impact' && (
                <Suspense fallback={
                  <div className="h-[400px] rounded-xl skeleton-shimmer" />
                }>
                  <VariantImpactSimulator
                    variantId={variant.variant_id}
                    clinvarVariants={clinvarVariants}
                    gnomadVariants={gnomadVariants}
                    protein={protein}
                    diseases={diseases}
                    embedded
                  />
                </Suspense>
              )}

              {/* -- Population Map Tab -- */}
              {activeTab === 'population' && (
                <Suspense fallback={
                  <div className="h-[400px] rounded-xl skeleton-shimmer" />
                }>
                  <PopulationMap
                    gnomadVariants={gnomadVariants}
                    clinvarVariants={clinvarVariants}
                    initialVariantId={variant.variant_id}
                    geneSymbol=""
                    embedded
                  />
                </Suspense>
              )}

              {/* -- Details Tab -- */}
              {activeTab === 'details' && <>

              {/* -- Section A: Variant Identity -- */}
              <Section title="Variant Identity">
                <DataGrid>
                  {variant.hgvsc && (
                    <DataItem label="HGVS (coding)" value={variant.hgvsc} mono />
                  )}
                  {variant.hgvsp && (
                    <DataItem label="HGVS (protein)" value={variant.hgvsp} mono />
                  )}
                  {variant.position > 0 && (
                    <DataItem label="Chromosome Position" value={variant.position.toLocaleString()} mono />
                  )}
                  <DataItem label="Consequence" value={formatConsequence(variant.consequence)} />
                  <DataItem label="Variant Type" value={formatConsequence(variant.variant_type)} />
                  {variant.condition && (
                    <DataItem label="Condition" value={variant.condition} />
                  )}
                </DataGrid>
              </Section>

              {/* -- Section B: Clinical Significance Detail -- */}
              {variant.hasClinvar && (
                <Section title="Clinical Significance">
                  <DataGrid>
                    <div className="col-span-full">
                      <span className="text-text-muted text-xs font-body block mb-1">Review Status</span>
                      <div className="flex items-center gap-2">
                        <span className="flex gap-0.5">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Star
                              key={i}
                              className="w-3.5 h-3.5"
                              fill={i < reviewStars ? '#D4A843' : 'transparent'}
                              stroke={i < reviewStars ? '#D4A843' : '#64748b'}
                              strokeWidth={1.5}
                            />
                          ))}
                        </span>
                        <span className="text-text-secondary text-xs font-body">
                          {variant.review_status}
                        </span>
                      </div>
                    </div>
                    <DataItem
                      label="Significance"
                      value={variant.clinical_significance}
                      badge={getSignificanceBadgeColor(variant.clinical_significance)}
                    />
                    {clinvarId && (
                      <DataItem label="ClinVar Variation ID" value={clinvarId} mono />
                    )}
                  </DataGrid>
                </Section>
              )}

              {/* -- Section C: ACMG Criteria -- */}
              <Section title="ACMG Criteria Assessment">
                <p className="text-text-muted text-xs font-body mb-3">
                  ACMG criteria not available for this variant. Below is the general ACMG/AMP classification framework.
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-danger text-xs font-body font-semibold mb-1.5 uppercase tracking-wider">
                      Pathogenic Criteria
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ACMG_PATHOGENIC_CRITERIA.map(c => (
                        <div key={c.code} className="flex items-start gap-2 p-1.5 rounded bg-danger-light">
                          <span className="font-mono text-xs text-danger/70 shrink-0 w-8">{c.code}</span>
                          <span className="text-text-muted text-xs">{c.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-success text-xs font-body font-semibold mb-1.5 uppercase tracking-wider">
                      Benign Criteria
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ACMG_BENIGN_CRITERIA.map(c => (
                        <div key={c.code} className="flex items-start gap-2 p-1.5 rounded bg-success-light">
                          <span className="font-mono text-xs text-success/70 shrink-0 w-8">{c.code}</span>
                          <span className="text-text-muted text-xs">{c.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* -- Section D: Population Frequencies -- */}
              <Section title="Population Frequencies">
                {sortedPopFreqs.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-text-muted text-xs font-body">Overall AF:</span>
                      <span className="font-mono text-sm text-primary">
                        {variant.allele_frequency > 0 ? variant.allele_frequency.toExponential(3) : '—'}
                      </span>
                      {variant.allele_count > 0 && (
                        <span className="text-text-muted text-xs font-mono">
                          ({variant.allele_count} / {variant.allele_number.toLocaleString()})
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {sortedPopFreqs.map((pf, idx) => {
                        const barWidth = maxPopAf > 0 ? (pf.af / maxPopAf) * 100 : 0;
                        const popKey = pf.population.toLowerCase();
                        const isHighest = idx === 0 && pf.af > 0;
                        const isLowest = idx === sortedPopFreqs.length - 1 && sortedPopFreqs.length > 1;
                        const color = POPULATION_COLORS[popKey] || '#64748b';

                        return (
                          <div key={pf.population} className="flex items-center gap-3">
                            <span className="text-text-muted text-xs font-body w-44 shrink-0 truncate">
                              {POPULATION_LABELS[popKey] || pf.population.toUpperCase()}
                              {isHighest && <span className="text-warning ml-1 text-[10px]">highest</span>}
                              {isLowest && <span className="text-primary ml-1 text-[10px]">lowest</span>}
                            </span>
                            <div className="flex-1 h-3 bg-ocean-50 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(barWidth, pf.af > 0 ? 1 : 0)}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.03 }}
                              />
                            </div>
                            <span className="font-mono text-xs text-text-heading w-20 text-right shrink-0">
                              {pf.af > 0 ? pf.af.toExponential(2) : '0'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-text-muted text-xs font-body">
                    Population frequency data unavailable
                  </p>
                )}
              </Section>

              {/* -- Section E: Protein Impact -- */}
              {isProteinAltering && variant.hgvsp && proteinChange && protein && (
                <Section title="Protein Impact">
                  <DataGrid>
                    <DataItem label="Amino Acid Change" value={variant.hgvsp} mono />
                    {affectedDomain && (
                      <DataItem label="Domain Affected" value={`${affectedDomain.name} (${affectedDomain.start}–${affectedDomain.end})`} />
                    )}
                    <DataItem label="Position in Protein" value={`${proteinChange.position} / ${protein.protein_length}`} mono />
                  </DataGrid>
                  {/* Mini protein bar */}
                  {protein.protein_length > 0 && (
                    <div className="mt-3">
                      <div className="relative h-5 bg-ocean-50 rounded-full overflow-hidden border border-ocean-100">
                        {/* Domains */}
                        {protein.domains.map((d, i) => (
                          <div
                            key={i}
                            className="absolute top-0 h-full opacity-40 rounded"
                            style={{
                              left: `${(d.start / protein.protein_length) * 100}%`,
                              width: `${Math.max(((d.end - d.start) / protein.protein_length) * 100, 0.5)}%`,
                              backgroundColor: ['#1B4965', '#D64045', '#2B9F78', '#D4A843', '#a855f7'][i % 5],
                            }}
                          />
                        ))}
                        {/* Variant position marker */}
                        <div
                          className="absolute top-0 h-full w-0.5 bg-gray-800 shadow-sm"
                          style={{
                            left: `${(proteinChange.position / protein.protein_length) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-text-muted text-[9px] font-mono">1</span>
                        <span className="text-text-muted text-[9px] font-mono">{protein.protein_length}</span>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* -- Section F: External Links -- */}
              <Section title="External Links">
                <div className="flex flex-wrap gap-2">
                  {clinvarId && (
                    <ExternalLinkButton
                      href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${clinvarId}/`}
                      label="ClinVar"
                    />
                  )}
                  {variant.variant_id && (
                    <ExternalLinkButton
                      href={`https://gnomad.broadinstitute.org/variant/${variant.variant_id}`}
                      label="gnomAD"
                    />
                  )}
                  {rsId && (
                    <ExternalLinkButton
                      href={`https://www.ncbi.nlm.nih.gov/snp/${rsId}`}
                      label="dbSNP"
                    />
                  )}
                  {variant.variant_id && (
                    <ExternalLinkButton
                      href={`https://www.ensembl.org/Homo_sapiens/Tools/VEP/Results?v=${variant.variant_id}`}
                      label="Ensembl VEP"
                    />
                  )}
                </div>
              </Section>

              </>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// -- Sub-components --

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-ocean-100 pt-4">
      <h3 className="text-xs font-heading font-semibold text-text-heading uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {children}
    </div>
  );
}

function DataItem({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: 'magenta' | 'amber' | 'cyan' | 'green' | 'muted';
}) {
  return (
    <div>
      <span className="text-text-muted text-xs font-body block mb-0.5">{label}</span>
      {badge ? (
        <GlowBadge color={badge} className="text-[10px] px-2 py-0.5">
          {value}
        </GlowBadge>
      ) : (
        <span className={`text-text-heading text-sm ${mono ? 'font-mono' : 'font-body'} break-all`}>
          {value}
        </span>
      )}
    </div>
  );
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <AnimatedButton variant="secondary" className="text-xs">
        <span className="flex items-center gap-1.5">
          {label}
          <ExternalLink className="w-3 h-3" />
        </span>
      </AnimatedButton>
    </a>
  );
}
