'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type GraphNode = {
  id: string;
  label: string;
  type: string;
  [key: string]: unknown;
};

type GraphLink = {
  from: string;
  to: string;
  type: string;
};

type Props = {
  nodes: GraphNode[];
  relationships: GraphLink[];
  focusId?: string;
};

const TYPE_COLORS: Record<string, string> = {
  Person:       '#60a5fa', // blue
  Organization: '#34d399', // green
  Agent:        '#a78bfa', // purple
  Transaction:  '#fbbf24', // amber
  Interaction:  '#fb923c', // orange
  Agreement:    '#f472b6', // pink
  Record:       '#94a3b8', // slate
  Asset:        '#2dd4bf', // teal
};

function nodeColor(type: string) {
  return TYPE_COLORS[type] ?? '#e2e8f0';
}

export default function GraphCanvas({ nodes, relationships, focusId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleNodeClick = useCallback((node: GraphNode) => {
    router.push(`/nodes/${node.id}`);
  }, [router]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    let graph: { _destructor?: () => void } | null = null;
    let cancelled = false;

    import('react-force-graph-2d').then(mod => {
      if (cancelled || !containerRef.current) return;
      const ForceGraph2D = mod.default;
      const ReactDOM = require('react-dom/client');

      const graphNodes = nodes.map(n => ({
        ...n,
        // force-graph mutates node objects for position — spread to avoid polluting originals
      }));

      const graphLinks = relationships.map(r => ({
        source: r.from,
        target: r.to,
        type: r.type,
      }));

      const root = ReactDOM.createRoot(containerRef.current!);
      root.render(
        ForceGraph2D({
          graphData: { nodes: graphNodes, links: graphLinks },
          nodeId: 'id',
          nodeLabel: 'label',
          nodeColor: (n: GraphNode) => nodeColor(n.type as string),
          nodeVal: (n: GraphNode) => (n.id === focusId ? 6 : 3),
          linkLabel: (l: { type: string }) => l.type,
          linkDirectionalArrowLength: 6,
          linkDirectionalArrowRelPos: 1,
          linkColor: () => '#475569',
          linkWidth: 1.5,
          backgroundColor: '#0f172a',
          width: containerRef.current!.clientWidth,
          height: containerRef.current!.clientHeight,
          onNodeClick: handleNodeClick,
          nodeCanvasObjectMode: () => 'after',
          nodeCanvasObject: (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D) => {
            const label = (node.label as string) ?? '';
            const short = label.length > 20 ? label.slice(0, 18) + '…' : label;
            ctx.font = '5px Inter, sans-serif';
            ctx.fillStyle = '#f1f5f9';
            ctx.textAlign = 'center';
            ctx.fillText(short, node.x ?? 0, (node.y ?? 0) + 9);
          },
        })
      );

      // store root for cleanup
      (containerRef.current as HTMLElement & { _graphRoot?: ReturnType<typeof ReactDOM.createRoot> })._graphRoot = root;
    });

    return () => {
      cancelled = true;
      const el = containerRef.current as HTMLElement & { _graphRoot?: { unmount: () => void } } | null;
      el?._graphRoot?.unmount();
    };
  }, [nodes, relationships, focusId, handleNodeClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ background: '#0f172a' }}
    />
  );
}
