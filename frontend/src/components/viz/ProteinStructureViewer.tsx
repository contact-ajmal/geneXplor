import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Eye,
  Palette,
  RotateCcw,
  Camera,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import type { StructureData, VariantResidue } from '../../lib/api';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';

/* ── significance → color ── */
const SIG_COLORS: Record<string, string> = {
  pathogenic: '#ff3366',
  'likely pathogenic': '#ff8c00',
  'uncertain significance': '#ffaa00',
  'likely benign': '#4a9eff',
  benign: '#00ff88',
  population: '#94a3b8',
};

const CONFIDENCE_LEGEND = [
  { label: 'Very high (>90)', color: '#0053d6' },
  { label: 'Confident (70-90)', color: '#65cbf3' },
  { label: 'Low (50-70)', color: '#ffdb13' },
  { label: 'Very low (<50)', color: '#ff7d45' },
];

type ViewMode = 'confidence' | 'variants';
type RepMode = 'cartoon' | 'surface' | 'ball-and-stick';

interface ProteinStructureViewerProps {
  structure: StructureData;
  geneSymbol: string;
  onVariantClick?: (variantId: string) => void;
  delay?: number;
}

/* ── Load PDBe-Molstar script + CSS lazily ── */
let loadPromise: Promise<void> | null = null;

function loadPdbeMolstar(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded
    if ((window as any).PDBeMolstarPlugin) {
      resolve();
      return;
    }

    // Load CSS
    if (!document.querySelector('link[href*="pdbe-molstar.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/molstar/pdbe-molstar.css';
      document.head.appendChild(link);
    }

    // Load JS
    const script = document.createElement('script');
    script.src = '/molstar/pdbe-molstar-plugin.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PDBe-Molstar script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export default function ProteinStructureViewer({
  structure,
  geneSymbol,
  onVariantClick,
  delay = 0,
}: ProteinStructureViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('confidence');
  const [repMode, setRepMode] = useState<RepMode>('cartoon');
  const [isInView, setIsInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection observer — only init viewer when section scrolls into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observerRef.current.observe(el);
    return () => observerRef.current?.disconnect();
  }, []);

  // Initialize PDBe-Molstar when in viewport
  useEffect(() => {
    if (!isInView || !structure.structure_available || !containerRef.current) return;

    let disposed = false;
    let viewer: any = null;

    const init = async () => {
      try {
        await loadPdbeMolstar();
        if (disposed) return;

        const PDBeMolstarPlugin = (window as any).PDBeMolstarPlugin;
        if (!PDBeMolstarPlugin) throw new Error('PDBeMolstarPlugin not available');

        const target = containerRef.current;
        if (!target || disposed) return;

        viewer = new PDBeMolstarPlugin();
        viewerRef.current = viewer;

        const url = structure.structure_url;
        const isCif = url.endsWith('.cif');

        const options: any = {
          customData: {
            url,
            format: isCif ? 'cif' : 'pdb',
            binary: false,
          },
          alphafoldView: structure.source === 'alphafold',
          bgColor: { r: 10, g: 14, b: 26 }, // #0a0e1a
          hideControls: false,
          hideCanvasControls: ['expand'],
          sequencePanel: false,
          landscape: true,
          reactive: false,
          subscribeEvents: true,
        };

        await viewer.render(target, options);

        // Wait for load to complete
        if (viewer.events?.loadComplete) {
          await new Promise<void>((resolve) => {
            const sub = viewer.events.loadComplete.subscribe(() => {
              sub.unsubscribe();
              resolve();
            });
            // Timeout fallback
            setTimeout(resolve, 15000);
          });
        } else {
          // Fallback: wait a bit for render
          await new Promise((r) => setTimeout(r, 3000));
        }

        if (disposed) return;
        setLoading(false);
      } catch (err: any) {
        if (!disposed) {
          const msg = err?.message || String(err);
          console.error('PDBe-Molstar init failed:', msg, err);
          setError(`Failed to load 3D structure viewer: ${msg.slice(0, 120)}`);
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (viewer) {
        try { viewer.clear(); } catch { /* ignore */ }
      }
      viewerRef.current = null;
    };
  }, [isInView, structure.structure_available, structure.structure_url, structure.source]);

  // Apply visual style changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;

    try {
      const repMap: Record<RepMode, string> = {
        'cartoon': 'cartoon',
        'surface': 'molecular-surface',
        'ball-and-stick': 'ball-and-stick',
      };
      viewer.visual?.update({
        visualStyle: repMap[repMode],
        alphafoldView: viewMode === 'confidence' && structure.source === 'alphafold',
      });
    } catch {
      /* viewer may not support this yet */
    }
  }, [viewMode, repMode, loading, structure.source]);

  // Highlight variant residues when in variants mode
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading || viewMode !== 'variants') return;

    try {
      viewer.visual?.clearSelection();

      const residueGroups: Record<string, { struct_asym_id: string; start_residue_number: number; end_residue_number: number }[]> = {};

      for (const v of structure.variant_residues) {
        const sig = v.clinical_significance.toLowerCase();
        const color = SIG_COLORS[sig] || SIG_COLORS.population;
        if (!residueGroups[color]) residueGroups[color] = [];
        residueGroups[color].push({
          struct_asym_id: 'A',
          start_residue_number: v.residue_number,
          end_residue_number: v.residue_number,
        });
      }

      const selectData = Object.entries(residueGroups).map(([color, residues]) => ({
        struct_asym_id: 'A',
        color: { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) },
        focus: false,
        data: residues,
      }));

      if (selectData.length > 0) {
        viewer.visual?.select({ data: selectData });
      }
    } catch {
      /* selection API may vary */
    }
  }, [viewMode, loading, structure.variant_residues]);

  // Clear variant highlights when switching to confidence mode
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading || viewMode !== 'confidence') return;
    try { viewer.visual?.clearSelection(); } catch { /* ignore */ }
  }, [viewMode, loading]);

  const handleResetView = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try { viewer.visual?.reset({ camera: true }); } catch { /* ignore */ }
  }, []);

  const handleScreenshot = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      const canvas = containerRef.current?.querySelector('canvas');
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${geneSymbol}_structure.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch { /* ignore */ }
  }, [geneSymbol]);

  if (!structure.structure_available) {
    return (
      <GlassCard delay={delay}>
        <h2 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider">
          3D Protein Structure
        </h2>
        <div className="text-center py-12">
          <Box className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
          <p className="text-text-secondary text-sm font-body mb-2">
            No predicted structure available for{' '}
            <span className="font-mono text-cyan">{geneSymbol}</span>
          </p>
          <p className="text-text-muted text-xs font-body mb-4">
            AlphaFold coverage is expanding — check back later
          </p>
          <a
            href={`https://alphafold.ebi.ac.uk/search/text/${geneSymbol}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-cyan text-xs font-body hover:underline"
          >
            Search AlphaFold DB
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </GlassCard>
    );
  }

  const mappedCount = structure.variant_residues.length;

  return (
    <GlassCard delay={delay} className="overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider">
            3D Protein Structure
          </h2>
          <p className="text-text-muted text-xs font-body mt-0.5">
            {structure.source === 'alphafold'
              ? 'AlphaFold predicted structure'
              : 'Experimental PDB structure'}
            {structure.mean_confidence > 0 &&
              ` — mean pLDDT: ${structure.mean_confidence.toFixed(1)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {structure.source === 'alphafold' && (
            <GlowBadge color="cyan" className="text-[10px]">
              AlphaFold v{structure.model_version}
            </GlowBadge>
          )}
        </div>
      </div>

      {/* Viewer container */}
      <div className="relative rounded-xl overflow-hidden border border-space-600/30 bg-space-900">
        <div
          ref={containerRef}
          className="w-full h-[350px] md:h-[450px] lg:h-[600px] bg-space-900"
          style={{ position: 'relative' }}
        />

        {/* Loading overlay */}
        {loading && isInView && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-900/90 z-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-10 h-10 text-cyan" />
            </motion.div>
            <p className="text-text-secondary text-sm font-body mt-3">
              Loading 3D structure...
            </p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-900/90 z-10">
            <Box className="w-10 h-10 text-magenta/50 mb-3" />
            <p className="text-text-secondary text-sm font-body text-center px-4">{error}</p>
          </div>
        )}
      </div>

      {/* Controls bar */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-space-600/40">
            <ControlButton
              active={viewMode === 'confidence'}
              onClick={() => setViewMode('confidence')}
              title="Color by pLDDT confidence"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Confidence</span>
            </ControlButton>
            <ControlButton
              active={viewMode === 'variants'}
              onClick={() => setViewMode('variants')}
              title="Color by variant significance"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Variants</span>
            </ControlButton>
          </div>

          {/* Representation toggle */}
          <div className="flex rounded-lg overflow-hidden border border-space-600/40">
            <ControlButton
              active={repMode === 'cartoon'}
              onClick={() => setRepMode('cartoon')}
              title="Cartoon representation"
            >
              Cartoon
            </ControlButton>
            <ControlButton
              active={repMode === 'surface'}
              onClick={() => setRepMode('surface')}
              title="Surface representation"
            >
              Surface
            </ControlButton>
            <ControlButton
              active={repMode === 'ball-and-stick'}
              onClick={() => setRepMode('ball-and-stick')}
              title="Ball and stick"
            >
              B&amp;S
            </ControlButton>
          </div>

          <div className="flex-1" />

          {/* Action buttons */}
          <ControlButton onClick={handleResetView} title="Reset camera view">
            <RotateCcw className="w-3.5 h-3.5" />
          </ControlButton>
          <ControlButton onClick={handleScreenshot} title="Save screenshot">
            <Camera className="w-3.5 h-3.5" />
          </ControlButton>
          <a
            href={structure.alphafold_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body
              text-text-secondary hover:text-cyan hover:bg-cyan/[0.05] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {structure.source === 'alphafold' ? 'AlphaFold DB' : 'RCSB PDB'}
            </span>
          </a>
        </motion.div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 pt-3 border-t border-space-600/20"
        >
          {viewMode === 'confidence' ? (
            <div>
              <p className="text-text-muted text-[10px] font-body uppercase tracking-wider mb-2">
                pLDDT Confidence Score
              </p>
              <div className="flex flex-wrap gap-3">
                {CONFIDENCE_LEGEND.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-text-secondary text-[11px] font-body">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-text-muted text-[10px] font-body uppercase tracking-wider">
                  Variant Clinical Significance
                </p>
                <span className="text-text-muted text-[10px] font-mono">
                  {mappedCount} variant{mappedCount !== 1 ? 's' : ''} mapped to structure
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(SIG_COLORS).map(([sig, color]) => (
                  <div key={sig} className="flex items-center gap-1.5">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-text-secondary text-[11px] font-body capitalize">
                      {sig}
                    </span>
                  </div>
                ))}
              </div>
              {/* Mapped variant residues list (collapsible) */}
              {mappedCount > 0 && (
                <VariantResidueList
                  residues={structure.variant_residues}
                  onVariantClick={onVariantClick}
                />
              )}
            </div>
          )}
        </motion.div>
      )}
    </GlassCard>
  );
}

/* ── Helper sub-components ── */

function ControlButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-body transition-colors
        cursor-pointer border-none
        ${
          active
            ? 'bg-cyan/15 text-cyan'
            : 'bg-transparent text-text-secondary hover:text-cyan hover:bg-cyan/[0.05]'
        }`}
    >
      {children}
    </button>
  );
}

function VariantResidueList({
  residues,
  onVariantClick,
}: {
  residues: VariantResidue[];
  onVariantClick?: (variantId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? residues : residues.slice(0, 6);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {shown.map((r) => {
          const sigLower = r.clinical_significance.toLowerCase();
          const color = SIG_COLORS[sigLower] || SIG_COLORS.population;
          return (
            <button
              key={r.residue_number}
              onClick={() => r.variant_id && onVariantClick?.(r.variant_id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono
                transition-colors cursor-pointer border-none"
              style={{
                backgroundColor: `${color}15`,
                color,
                border: `1px solid ${color}30`,
              }}
              title={`${r.amino_acid_change} — ${r.clinical_significance}${
                r.allele_frequency != null ? ` (AF: ${r.allele_frequency.toExponential(2)})` : ''
              }`}
            >
              {r.amino_acid_change}
            </button>
          );
        })}
      </div>
      {residues.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-text-muted hover:text-cyan text-[10px] font-body mt-1.5
            cursor-pointer bg-transparent border-none transition-colors"
        >
          {expanded ? 'Show less' : `+${residues.length - 6} more`}
        </button>
      )}
    </div>
  );
}
