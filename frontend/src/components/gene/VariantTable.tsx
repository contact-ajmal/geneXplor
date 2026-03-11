import { useState, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ClinVarVariant, GnomADVariant, PopulationFrequency } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';

interface VariantTableProps {
  clinvarVariants: ClinVarVariant[];
  gnomadVariants: GnomADVariant[];
  delay?: number;
  significanceFilter?: string;
}

interface TableVariant {
  variant_id: string;
  position: number;
  consequence: string;
  clinical_significance: string;
  allele_frequency: number;
  population_frequencies: PopulationFrequency[];
  title: string;
  condition: string;
}

function formatConsequence(consequence: string): string {
  return consequence
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getSignificanceBadgeColor(sig: string): 'magenta' | 'amber' | 'cyan' | 'green' | 'muted' {
  const normalized = sig.toLowerCase();
  if (normalized.includes('pathogenic') && !normalized.includes('likely')) return 'magenta';
  if (normalized.includes('likely pathogenic') || normalized.includes('likely_pathogenic')) return 'amber';
  if (normalized.includes('benign') && !normalized.includes('likely')) return 'green';
  if (normalized.includes('likely benign') || normalized.includes('likely_benign')) return 'cyan';
  if (normalized.includes('uncertain') || normalized.includes('vus')) return 'amber';
  return 'muted';
}

const columnHelper = createColumnHelper<TableVariant>();

const SIGNIFICANCE_OPTIONS = [
  'Pathogenic',
  'Likely pathogenic',
  'Uncertain significance',
  'Likely benign',
  'Benign',
];

const CONSEQUENCE_OPTIONS = [
  'Missense variant',
  'Synonymous variant',
  'Frameshift variant',
  'Stop gained',
  'Splice region variant',
  'Intron variant',
  'Inframe deletion',
  'Inframe insertion',
];

export default function VariantTable({ clinvarVariants, gnomadVariants, delay = 0, significanceFilter }: VariantTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sigFilter, setSigFilter] = useState<string[]>(significanceFilter ? [significanceFilter] : []);
  const [consequenceFilter, setConsequenceFilter] = useState<string[]>([]);
  const [afThreshold, setAfThreshold] = useState<number>(1);

  // Merge ClinVar + gnomAD data
  const tableData = useMemo(() => {
    const gnomadMap = new Map<string, GnomADVariant>();
    for (const gv of gnomadVariants) {
      gnomadMap.set(gv.variant_id, gv);
    }

    const result: TableVariant[] = clinvarVariants.map(cv => {
      const gv = gnomadMap.get(cv.variant_id);
      return {
        variant_id: cv.variant_id,
        position: gv?.position || 0,
        consequence: gv?.consequence || cv.variant_type,
        clinical_significance: cv.clinical_significance,
        allele_frequency: gv?.allele_frequency || 0,
        population_frequencies: gv?.population_frequencies || [],
        title: cv.title,
        condition: cv.condition,
      };
    });

    return result;
  }, [clinvarVariants, gnomadVariants]);

  // Apply filters
  const filteredData = useMemo(() => {
    let data = tableData;

    if (sigFilter.length > 0) {
      data = data.filter(v => {
        const normalized = v.clinical_significance.toLowerCase();
        return sigFilter.some(f => normalized.includes(f.toLowerCase()));
      });
    }

    if (consequenceFilter.length > 0) {
      data = data.filter(v => {
        const formatted = formatConsequence(v.consequence).toLowerCase();
        return consequenceFilter.some(f => formatted.toLowerCase().includes(f.toLowerCase()));
      });
    }

    if (afThreshold < 1) {
      data = data.filter(v => v.allele_frequency === 0 || v.allele_frequency <= afThreshold);
    }

    return data;
  }, [tableData, sigFilter, consequenceFilter, afThreshold]);

  // Update sigFilter when external filter changes
  useMemo(() => {
    if (significanceFilter) {
      setSigFilter([significanceFilter]);
    }
  }, [significanceFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor('variant_id', {
      header: 'Variant ID',
      cell: info => (
        <span className="font-mono text-cyan text-xs">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('position', {
      header: 'Position',
      cell: info => (
        <span className="font-mono text-xs text-text-primary">
          {info.getValue() > 0 ? info.getValue().toLocaleString() : '—'}
        </span>
      ),
    }),
    columnHelper.accessor('consequence', {
      header: 'Consequence',
      cell: info => (
        <span className="text-xs text-text-secondary">
          {formatConsequence(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('clinical_significance', {
      header: 'Significance',
      cell: info => (
        <GlowBadge color={getSignificanceBadgeColor(info.getValue())} className="text-[10px] px-2 py-0.5">
          {info.getValue()}
        </GlowBadge>
      ),
    }),
    columnHelper.accessor('allele_frequency', {
      header: 'Allele Freq',
      cell: info => {
        const af = info.getValue();
        return (
          <span className="font-mono text-xs text-text-primary">
            {af > 0 ? af.toExponential(2) : '—'}
          </span>
        );
      },
    }),
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  return (
    <GlassCard delay={delay}>
      <div className="mb-4">
        <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
          Variant Table
        </h2>
        <p className="text-text-muted text-xs font-body mt-1">
          {filteredData.length} of {tableData.length} variants shown
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-space-600/30">
        {/* Significance filter */}
        <div className="relative">
          <select
            multiple
            value={sigFilter}
            onChange={e => {
              const values = Array.from(e.target.selectedOptions, o => o.value);
              setSigFilter(values);
            }}
            className="bg-space-800/80 border border-space-600/50 rounded-lg px-3 py-1.5 text-xs text-text-secondary font-body min-w-[160px] appearance-none cursor-pointer focus:border-cyan/30 focus:outline-none"
            style={{ height: sigFilter.length > 0 ? 'auto' : '30px', maxHeight: '120px' }}
          >
            <option value="" disabled>Clinical Significance</option>
            {SIGNIFICANCE_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-space-800 text-text-secondary py-1">
                {opt}
              </option>
            ))}
          </select>
          {sigFilter.length > 0 && (
            <button
              onClick={() => setSigFilter([])}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-magenta text-space-900 text-[8px] flex items-center justify-center cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Consequence filter */}
        <div className="relative">
          <select
            multiple
            value={consequenceFilter}
            onChange={e => {
              const values = Array.from(e.target.selectedOptions, o => o.value);
              setConsequenceFilter(values);
            }}
            className="bg-space-800/80 border border-space-600/50 rounded-lg px-3 py-1.5 text-xs text-text-secondary font-body min-w-[160px] appearance-none cursor-pointer focus:border-cyan/30 focus:outline-none"
            style={{ height: consequenceFilter.length > 0 ? 'auto' : '30px', maxHeight: '120px' }}
          >
            <option value="" disabled>Consequence Type</option>
            {CONSEQUENCE_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-space-800 text-text-secondary py-1">
                {opt}
              </option>
            ))}
          </select>
          {consequenceFilter.length > 0 && (
            <button
              onClick={() => setConsequenceFilter([])}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-magenta text-space-900 text-[8px] flex items-center justify-center cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* AF threshold slider */}
        <div className="flex items-center gap-2">
          <label className="text-text-muted text-xs font-body whitespace-nowrap">
            Max AF:
          </label>
          <input
            type="range"
            min={-6}
            max={0}
            step={0.5}
            value={afThreshold < 1 ? Math.log10(afThreshold) : 0}
            onChange={e => {
              const val = parseFloat(e.target.value);
              setAfThreshold(val >= 0 ? 1 : Math.pow(10, val));
            }}
            className="w-24 accent-cyan h-1"
          />
          <span className="text-text-muted text-xs font-mono w-16">
            {afThreshold >= 1 ? 'All' : afThreshold.toExponential(0)}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full">
          <thead>
            <tr>
              {table.getHeaderGroups().map(headerGroup =>
                headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="text-left py-3 px-3 text-text-muted text-xs font-body font-semibold uppercase tracking-wider cursor-pointer hover:text-cyan transition-colors sticky top-0 bg-[rgba(20,27,45,0.95)] backdrop-blur-md z-10 border-b border-space-600/30"
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ChevronUp className="w-3 h-3 text-cyan" />,
                        desc: <ChevronDown className="w-3 h-3 text-cyan" />,
                      }[header.column.getIsSorted() as string] ?? (
                        <ChevronsUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <Fragment key={row.id}>
                <tr
                  onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                  className={`
                    cursor-pointer transition-colors duration-150
                    ${i % 2 === 0 ? 'bg-transparent' : 'bg-space-800/20'}
                    ${expandedRow === row.id ? 'bg-cyan/5' : 'hover:bg-cyan/[0.03]'}
                  `}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="py-2.5 px-3 border-b border-space-600/10">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>

                {/* Expanded row: population frequencies */}
                <AnimatePresence>
                  {expandedRow === row.id && row.original.population_frequencies.length > 0 && (
                    <tr key={`${row.id}-expanded`}>
                      <td colSpan={columns.length}>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 bg-space-800/30 rounded-lg mx-3 mb-2">
                            <p className="text-text-muted text-xs font-body mb-2 font-semibold">
                              Population Frequencies
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {row.original.population_frequencies.map(pf => (
                                <div key={pf.population} className="flex justify-between gap-2 text-xs">
                                  <span className="text-text-muted font-mono uppercase">{pf.population}</span>
                                  <span className="text-text-primary font-mono">
                                    {pf.af > 0 ? pf.af.toExponential(2) : '0'}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {row.original.condition && (
                              <p className="text-text-secondary text-xs mt-2">
                                Condition: {row.original.condition}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-space-600/30">
          <span className="text-text-muted text-xs font-body">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg bg-space-800/50 border border-space-600/30 text-text-secondary disabled:opacity-30 hover:border-cyan/20 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg bg-space-800/50 border border-space-600/30 text-text-secondary disabled:opacity-30 hover:border-cyan/20 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
