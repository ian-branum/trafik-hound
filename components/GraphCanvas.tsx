'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

type GraphNode = {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
};

type GraphLink = { from: string; to: string; type: string };
type FGInstance = { zoomToFit: (ms: number, padding: number) => void };

type Props = {
  nodes: GraphNode[];
  relationships: GraphLink[];
  focusId?: string;
  depth?: number;
};

const TYPE_COLORS: Record<string, string> = {
  Person:       '#60a5fa',  // blue
  Organization: '#34d399',  // emerald
  Agent:        '#a78bfa',  // violet
  Transaction:  '#fbbf24',  // amber
  Interaction:  '#fb923c',  // orange
  Agreement:    '#f472b6',  // pink
  Record:       '#94a3b8',  // slate
  Asset:        '#e879f9',  // fuchsia (distinct from all others)
};

function nodeColor(type: string) {
  return TYPE_COLORS[type] ?? '#e2e8f0';
}

export default function GraphCanvas({ nodes, relationships, focusId, depth = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  // Track real container dimensions via ResizeObserver — handles both
  // initial layout and fullscreen transitions correctly
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setDims({ width: r.width, height: r.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    router.push(`/nodes/${node.id}`);
  }, [router]);

  // Rebuild the graph whenever data or dimensions change
  useEffect(() => {
    if (!dims || !containerRef.current || nodes.length === 0) return;

    // Tear down any previous graph instance
    cleanupRef.current?.();
    cleanupRef.current = null;

    let cancelled = false;

    Promise.all([
      import('react-force-graph-2d'),
      import('react-dom/client'),
    ]).then(([fgMod, rdMod]) => {
      if (cancelled || !containerRef.current) return;

      const ForceGraph2D = fgMod.default;
      const { createRoot } = rdMod;

      const graphNodes = nodes.map(n => ({ ...n }));
      const graphLinks = relationships.map(r => ({
        source: r.from,
        target: r.to,
        type: r.type,
      }));

      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      containerRef.current.appendChild(el);

      let fgInstance: FGInstance | null = null;

      const root = createRoot(el);
      root.render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        React.createElement(ForceGraph2D as any, {
          ref: (inst: FGInstance | null) => { fgInstance = inst; },
          graphData: { nodes: graphNodes, links: graphLinks },
          nodeId: 'id',
          nodeLabel: 'label',
          nodeColor: (n: GraphNode) => n.id === focusId ? '#ef4444' : nodeColor(n.type),
          nodeVal: () => 3,
          linkLabel: (l: { type: string }) => l.type,
          linkDirectionalArrowLength: 6,
          linkDirectionalArrowRelPos: 1,
          linkColor: () => '#475569',
          linkWidth: 1.5,
          backgroundColor: '#0f172a',
          width: dims.width,
          height: dims.height,
          onNodeClick: handleNodeClick,
          // Scale cooldown by depth: depth1=30, depth2=60, depth3=90 ticks
          cooldownTicks: depth * 30,
          // Cap zoom so labels on small graphs don't fly off the canvas
          maxZoom: 4,
          onEngineStop: () => { fgInstance?.zoomToFit(400, 40); },
          nodeCanvasObjectMode: () => 'after',
          nodeCanvasObject: (node: GraphNode, ctx: CanvasRenderingContext2D) => {
            const label = (node.label as string) ?? '';
            const short = label.length > 20 ? label.slice(0, 18) + '…' : label;
            ctx.font = '5px Inter, sans-serif';
            ctx.fillStyle = '#f1f5f9';
            ctx.textAlign = 'center';
            ctx.fillText(short, node.x ?? 0, (node.y ?? 0) + 9);
          },
        })
      );

      cleanupRef.current = () => { root.unmount(); el.remove(); };
    }).catch(err => {
      console.error('[GraphCanvas] Failed to load graph library:', err);
    });

    return () => { cancelled = true; };
  }, [dims, nodes, relationships, focusId, handleNodeClick]);

  // Final cleanup on unmount
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm">
        No connected nodes
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#0f172a' }}
    />
  );
}
