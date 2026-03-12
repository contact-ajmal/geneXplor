import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  ExternalLink,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronUp,
  Beaker,
  Database,
  BookOpen,
  Activity,
} from 'lucide-react';
import * as d3 from 'd3';
import GlassCard from '../ui/GlassCard';
import GlowBadge from '../ui/GlowBadge';
import type { InteractionData, InteractionEdge, EnrichmentTerm } from '../../lib/api';

interface InteractionNetworkProps {
  interactions: InteractionData;
  geneSymbol: string;
  delay?: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  isCenter: boolean;
  interactionCount: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  edge: InteractionEdge;
}

const EVIDENCE_FILTERS = [
  { key: 'experimental', label: 'Experimental', icon: Beaker },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'textmining', label: 'Textmining', icon: BookOpen },
  { key: 'coexpression', label: 'Coexpression', icon: Activity },
] as const;

type EvidenceKey = (typeof EVIDENCE_FILTERS)[number]['key'];

export default function InteractionNetwork({
  interactions,
  geneSymbol,
  delay = 0,
}: InteractionNetworkProps) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const hoveredNodeRef = useRef<SimNode | null>(null);
  const hoveredEdgeRef = useRef<SimLink | null>(null);
  const dragNodeRef = useRef<SimNode | null>(null);
  const tooltipRef = useRef<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  const [threshold, setThreshold] = useState(0.7);
  const [evidenceFilters, setEvidenceFilters] = useState<Set<EvidenceKey>>(
    new Set(['experimental', 'database', 'textmining', 'coexpression']),
  );
  const [layout, setLayout] = useState<'force' | 'radial' | 'grid'>('force');
  const [tooltipState, setTooltipState] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);
  const [enrichmentTab, setEnrichmentTab] = useState<'BP' | 'MF' | 'CC'>('BP');
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [, forceRender] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Filter interactions based on threshold and evidence filters
  const filteredInteractions = useMemo(() => {
    return interactions.interactions.filter((ix) => {
      if (ix.combined_score < threshold) return false;

      // If all filters are active, don't filter by evidence
      if (evidenceFilters.size === EVIDENCE_FILTERS.length) return true;

      // Check if interaction has any of the selected evidence types
      for (const key of evidenceFilters) {
        const score = ix[`${key}_score` as keyof InteractionEdge] as number;
        if (score > 0) return true;
      }
      return evidenceFilters.size === 0;
    });
  }, [interactions.interactions, threshold, evidenceFilters]);

  const filteredNodeCount = useMemo(() => {
    const genes = new Set<string>();
    for (const ix of filteredInteractions) {
      genes.add(ix.gene_a);
      genes.add(ix.gene_b);
    }
    return genes.size;
  }, [filteredInteractions]);

  // Enrichment data by category
  const enrichmentByCategory = useMemo(() => {
    const map: Record<string, EnrichmentTerm[]> = { BP: [], MF: [], CC: [] };
    for (const term of interactions.enrichment) {
      if (map[term.category]) {
        map[term.category].push(term);
      }
    }
    return map;
  }, [interactions.enrichment]);

  // Build + run D3 force simulation on canvas
  const buildSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = 500;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Build nodes
    const nodeMap = new Map<string, SimNode>();
    const centerNode: SimNode = {
      id: geneSymbol,
      isCenter: true,
      interactionCount: filteredInteractions.length,
    };
    nodeMap.set(geneSymbol, centerNode);

    for (const ix of filteredInteractions) {
      for (const gene of [ix.gene_a, ix.gene_b]) {
        if (!nodeMap.has(gene)) {
          const nodeData = interactions.nodes.find((n) => n.gene_symbol === gene);
          nodeMap.set(gene, {
            id: gene,
            isCenter: gene === geneSymbol,
            interactionCount: nodeData?.interaction_count || 1,
          });
        }
      }
    }

    const nodes = Array.from(nodeMap.values());
    const links: SimLink[] = filteredInteractions.map((ix) => ({
      source: nodeMap.get(ix.gene_a)!,
      target: nodeMap.get(ix.gene_b)!,
      edge: ix,
    }));

    nodesRef.current = nodes;
    linksRef.current = links;

    // Kill existing sim
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => 100 + (1 - d.edge.combined_score) * 80),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(35))
      .alphaDecay(0.02);

    // Pin center node
    const center = nodeMap.get(geneSymbol);
    if (center) {
      center.fx = width / 2;
      center.fy = height / 2;
    }

    // Apply layout variants
    if (layout === 'radial') {
      sim.force('center', null);
      sim.force(
        'radial',
        d3
          .forceRadial<SimNode>(
            (d) => (d.isCenter ? 0 : 160),
            width / 2,
            height / 2,
          )
          .strength(0.8),
      );
    } else if (layout === 'grid') {
      sim.force('center', null);
      const nonCenter = nodes.filter((n) => !n.isCenter);
      const cols = Math.ceil(Math.sqrt(nonCenter.length));
      nonCenter.forEach((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        n.fx = width / 2 - ((cols - 1) * 60) / 2 + col * 60;
        n.fy = height / 2 - 80 + row * 60 + 80;
      });
    }

    simulationRef.current = sim;

    // Render loop
    const draw = () => {
      const t = transformRef.current;
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Draw edges
      for (const link of links) {
        const src = link.source as SimNode;
        const tgt = link.target as SimNode;
        if (
          src.x == null ||
          src.y == null ||
          tgt.x == null ||
          tgt.y == null
        )
          continue;

        const isHovered = hoveredEdgeRef.current === link;
        const lineWidth = 1 + link.edge.combined_score * 3;
        const hasExperimental =
          link.edge.experimental_score > 0 || link.edge.database_score > 0;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = isHovered
          ? '#00d4ff'
          : hasExperimental
            ? `rgba(0, 212, 255, ${0.15 + link.edge.combined_score * 0.35})`
            : `rgba(148, 163, 184, ${0.1 + link.edge.combined_score * 0.2})`;
        ctx.lineWidth = isHovered ? lineWidth + 1 : lineWidth;

        if (!hasExperimental) {
          ctx.setLineDash([4, 4]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const isHovered = hoveredNodeRef.current === node;
        const radius = node.isCenter
          ? 20
          : 10 + Math.min(node.interactionCount, 10) * 1;

        // Glow for center node
        if (node.isCenter) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            node.x,
            node.y,
            radius,
            node.x,
            node.y,
            radius + 8,
          );
          gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
          gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? radius + 2 : radius, 0, Math.PI * 2);

        if (node.isCenter) {
          ctx.fillStyle = '#00d4ff';
        } else {
          // Color by score — find the max score edge to this node
          const maxScore = links
            .filter(
              (l) =>
                (l.source as SimNode).id === node.id ||
                (l.target as SimNode).id === node.id,
            )
            .reduce((max, l) => Math.max(max, l.edge.combined_score), 0);

          const t = (maxScore - 0.4) / 0.6; // normalize 0.4-1.0 to 0-1
          const r = Math.round(20 + (1 - t) * 128);
          const g = Math.round(27 + t * 185);
          const b = Math.round(45 + t * 210);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        }
        ctx.fill();
        ctx.strokeStyle = isHovered
          ? '#00d4ff'
          : 'rgba(0, 212, 255, 0.3)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = node.isCenter ? '#ffffff' : '#e2e8f0';
        ctx.font = `${node.isCenter ? 'bold ' : ''}${node.isCenter ? 11 : 9}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (radius > 14) {
          ctx.fillText(node.id, node.x, node.y);
        } else {
          ctx.fillText(node.id, node.x, node.y + radius + 12);
        }
      }

      ctx.restore();
    };

    sim.on('tick', draw);

    // ── Mouse interaction ──
    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      return {
        x: (e.clientX - rect.left - t.x) / t.k,
        y: (e.clientY - rect.top - t.y) / t.k,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      };
    };

    const findNode = (mx: number, my: number) => {
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const r = node.isCenter ? 20 : 10 + Math.min(node.interactionCount, 10);
        const dx = mx - node.x;
        const dy = my - node.y;
        if (dx * dx + dy * dy < (r + 4) * (r + 4)) return node;
      }
      return null;
    };

    const findEdge = (mx: number, my: number) => {
      for (const link of links) {
        const src = link.source as SimNode;
        const tgt = link.target as SimNode;
        if (
          src.x == null ||
          src.y == null ||
          tgt.x == null ||
          tgt.y == null
        )
          continue;
        // Point-to-line distance
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;
        const t = Math.max(
          0,
          Math.min(1, ((mx - src.x) * dx + (my - src.y) * dy) / (len * len)),
        );
        const px = src.x + t * dx;
        const py = src.y + t * dy;
        const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
        if (dist < 6) return link;
      }
      return null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y, screenX, screenY } = getMousePos(e);

      if (dragNodeRef.current) {
        dragNodeRef.current.fx = x;
        dragNodeRef.current.fy = y;
        sim.alpha(0.3).restart();
        return;
      }

      const node = findNode(x, y);
      hoveredNodeRef.current = node;

      if (node) {
        canvas.style.cursor = 'pointer';
        const maxEdge = links
          .filter(
            (l) =>
              (l.source as SimNode).id === node.id ||
              (l.target as SimNode).id === node.id,
          )
          .reduce(
            (best, l) => (l.edge.combined_score > (best?.edge.combined_score || 0) ? l : best),
            null as SimLink | null,
          );

        tooltipRef.current = {
          x: screenX,
          y: screenY,
          content: (
            <div className="text-xs">
              <p className="font-mono text-cyan font-semibold text-sm mb-1">
                {node.id}
              </p>
              {!node.isCenter && maxEdge && (
                <p className="text-text-secondary">
                  Score: <span className="font-mono text-cyan">{maxEdge.edge.combined_score.toFixed(3)}</span>
                </p>
              )}
              <p className="text-text-secondary">
                {node.interactionCount} interaction{node.interactionCount !== 1 ? 's' : ''}
              </p>
              {!node.isCenter && (
                <p className="text-text-muted mt-1 text-[10px]">
                  Click to explore
                </p>
              )}
            </div>
          ),
        };
        setTooltipState(tooltipRef.current);
        hoveredEdgeRef.current = null;
        draw();
        return;
      }

      const edge = findEdge(x, y);
      hoveredEdgeRef.current = edge;

      if (edge) {
        canvas.style.cursor = 'crosshair';
        const e = edge.edge;
        tooltipRef.current = {
          x: screenX,
          y: screenY,
          content: (
            <div className="text-xs">
              <p className="font-mono text-cyan font-semibold mb-1">
                {e.gene_a} — {e.gene_b}
              </p>
              <p>Combined: <span className="font-mono">{e.combined_score.toFixed(3)}</span></p>
              {e.experimental_score > 0 && (
                <p>Experimental: <span className="font-mono">{e.experimental_score.toFixed(3)}</span></p>
              )}
              {e.database_score > 0 && (
                <p>Database: <span className="font-mono">{e.database_score.toFixed(3)}</span></p>
              )}
              {e.textmining_score > 0 && (
                <p>Textmining: <span className="font-mono">{e.textmining_score.toFixed(3)}</span></p>
              )}
              {e.coexpression_score > 0 && (
                <p>Coexpression: <span className="font-mono">{e.coexpression_score.toFixed(3)}</span></p>
              )}
            </div>
          ),
        };
        setTooltipState(tooltipRef.current);
        draw();
        return;
      }

      canvas.style.cursor = 'grab';
      tooltipRef.current = null;
      setTooltipState(null);
      draw();
    };

    const handleMouseDown = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);
      const node = findNode(x, y);
      if (node && !node.isCenter) {
        dragNodeRef.current = node;
        node.fx = node.x;
        node.fy = node.y;
        canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseUp = () => {
      if (dragNodeRef.current) {
        if (!dragNodeRef.current.isCenter) {
          dragNodeRef.current.fx = null;
          dragNodeRef.current.fy = null;
        }
        dragNodeRef.current = null;
      }
    };

    const handleClick = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);
      const node = findNode(x, y);
      if (node && !node.isCenter) {
        navigate(`/gene/${node.id}`);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const { x, y } = getMousePos(e);
      const node = findNode(x, y);
      if (node && !node.isCenter) {
        navigate(`/compare/${geneSymbol}/${node.id}`);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);

    // Zoom + Pan
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        draw();
      });

    d3.select(canvas).call(zoom);

    return () => {
      sim.stop();
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [filteredInteractions, interactions.nodes, geneSymbol, layout, navigate]);

  // Debounced rebuild on threshold/filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      buildSimulation();
      forceRender((c) => c + 1);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buildSimulation]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => buildSimulation();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [buildSimulation]);

  const handleReset = () => {
    transformRef.current = d3.zoomIdentity;
    if (canvasRef.current) {
      d3.select(canvasRef.current).call(
        d3.zoom<HTMLCanvasElement, unknown>().transform,
        d3.zoomIdentity,
      );
    }
    buildSimulation();
  };

  const toggleEvidence = (key: EvidenceKey) => {
    setEvidenceFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Empty state
  if (interactions.interactions.length === 0) {
    return (
      <GlassCard delay={delay}>
        <h2 className="text-sm font-heading font-semibold text-text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan" />
          Gene Interaction Network
        </h2>
        <div className="text-center py-12">
          <Network className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-secondary text-sm font-body mb-1">
            No high-confidence interactions found for{' '}
            <span className="font-mono text-cyan">{geneSymbol}</span> in STRING DB
          </p>
          <p className="text-text-muted text-xs font-body mb-3">
            Try lowering the confidence threshold
          </p>
          <a
            href={`https://string-db.org/network/${geneSymbol}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan/10 border border-cyan/20 text-cyan text-sm font-body hover:bg-cyan/20 transition-colors"
          >
            View on STRING DB
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={delay}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-heading font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Network className="w-4 h-4 text-cyan" />
            Gene Interaction Network
          </h2>
          <p className="text-text-muted text-xs font-body mt-0.5">
            Protein-protein interactions from STRING DB (confidence ≥{' '}
            {threshold.toFixed(2)})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlowBadge color="cyan">
            {filteredNodeCount} interactor{filteredNodeCount !== 1 ? 's' : ''}
          </GlowBadge>
          <a
            href={`https://string-db.org/network/${geneSymbol}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-cyan transition-colors"
            title="View on STRING DB"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-space-600/20">
        {/* Threshold slider */}
        <div className="flex items-center gap-2">
          <label className="text-text-muted text-xs font-body whitespace-nowrap">
            Score ≥
          </label>
          <input
            type="range"
            min={0.4}
            max={0.99}
            step={0.01}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-24 accent-cyan h-1"
          />
          <span className="font-mono text-cyan text-xs w-8">
            {threshold.toFixed(2)}
          </span>
        </div>

        {/* Evidence filters */}
        <div className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-text-muted" />
          {EVIDENCE_FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => toggleEvidence(key)}
              className={`px-2 py-0.5 rounded text-[10px] font-body border transition-all flex items-center gap-1 ${
                evidenceFilters.has(key)
                  ? 'bg-cyan/15 border-cyan/30 text-cyan'
                  : 'bg-space-800/50 border-space-600/30 text-text-muted hover:border-space-600/50'
              }`}
            >
              <Icon className="w-2.5 h-2.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Layout toggle */}
        <div className="flex items-center gap-1">
          {(['force', 'radial', 'grid'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2 py-0.5 rounded text-[10px] font-body border transition-all capitalize ${
                layout === l
                  ? 'bg-cyan/15 border-cyan/30 text-cyan'
                  : 'bg-space-800/50 border-space-600/30 text-text-muted hover:border-space-600/50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-body border border-space-600/30 text-text-muted hover:border-cyan/30 hover:text-cyan transition-all bg-space-800/50"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden bg-space-900/50">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '500px' }}
          className="block"
        />

        {/* Tooltip */}
        <AnimatePresence>
          {tooltipState && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.1 }}
              className="absolute pointer-events-none z-10 px-3 py-2 rounded-lg bg-space-700/95 border border-cyan/20 backdrop-blur-sm shadow-lg"
              style={{
                left: Math.min(tooltipState.x + 12, (containerRef.current?.clientWidth || 600) - 180),
                top: tooltipState.y - 10,
              }}
            >
              {tooltipState.content}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interaction hints */}
        <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] text-text-muted font-body">
          <span>Click: explore gene</span>
          <span>Right-click: compare</span>
          <span>Drag: reposition</span>
          <span>Scroll: zoom</span>
        </div>

        {/* Legend */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 text-[10px] text-text-muted font-body">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan inline-block" />
            Center gene
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-[2px] bg-cyan/50 inline-block" />
            Validated
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-6 h-[2px] inline-block"
              style={{
                background:
                  'repeating-linear-gradient(90deg, rgba(148,163,184,0.4) 0 3px, transparent 3px 6px)',
              }}
            />
            Text-only
          </div>
        </div>
      </div>

      {/* Functional Enrichment */}
      {interactions.enrichment.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowEnrichment(!showEnrichment)}
            className="flex items-center gap-2 text-sm font-heading font-semibold text-text-primary uppercase tracking-wider hover:text-cyan transition-colors"
          >
            Functional Enrichment
            {showEnrichment ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <AnimatePresence>
            {showEnrichment && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {/* Tabs */}
                <div className="flex gap-1 mt-3 mb-2">
                  {(
                    [
                      ['BP', 'Biological Process'],
                      ['MF', 'Molecular Function'],
                      ['CC', 'Cellular Component'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setEnrichmentTab(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-body border transition-all ${
                        enrichmentTab === key
                          ? 'bg-cyan/15 border-cyan/30 text-cyan'
                          : 'bg-space-800/50 border-space-600/30 text-text-muted hover:border-space-600/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Terms */}
                <div className="space-y-1.5">
                  {enrichmentByCategory[enrichmentTab]?.length > 0 ? (
                    enrichmentByCategory[enrichmentTab].map((term, i) => {
                      const logP = -Math.log10(
                        Math.max(term.p_value, 1e-16),
                      );
                      const maxLogP = 16;
                      const barWidth = Math.min(
                        (logP / maxLogP) * 100,
                        100,
                      );

                      return (
                        <div
                          key={term.term + i}
                          className="rounded-lg bg-space-800/40 border border-space-600/20 p-2.5 flex items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-xs font-body truncate">
                              {term.description}
                            </p>
                            <p className="text-text-muted text-[10px] font-mono">
                              {term.p_value.toExponential(2)}
                            </p>
                          </div>
                          <div className="w-24 shrink-0">
                            <div className="h-1.5 rounded-full bg-space-700 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: 0.5, delay: i * 0.05 }}
                                className={`h-full rounded-full ${
                                  enrichmentTab === 'BP'
                                    ? 'bg-cyan'
                                    : enrichmentTab === 'MF'
                                      ? 'bg-helix-green'
                                      : 'bg-amber'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-text-muted text-xs font-body py-3 text-center">
                      No {enrichmentTab === 'BP' ? 'biological process' : enrichmentTab === 'MF' ? 'molecular function' : 'cellular component'} terms found
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </GlassCard>
  );
}
