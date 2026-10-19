'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type GraphNode = {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
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
  Person:       '#60a5fa',
  Organization: '#34d399',
  Agent:        '#a78bfa',
  Transaction:  '#fbbf24',
  Interaction:  '#fb923c',
  Agreement:    '#f472b6',
  Record:       '#94a3b8',
  Asset:        '#2dd4bf',
};

function nodeColor(type: string) {
  return TYPE_COLORS[type] ?? '#e2e8f0';
}

export default function GraphCanvas({ nodes, relationships, focusId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleNodeClick = useCallback((node: GraphNode) => {
    router.push(`/nodes/${node.id}`);
  }, [router]);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    let cancelled = false;

    // Dynamically import both ForceGraph2D and ReactDOM together
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

      const width = containerRef.current.clientWidth || 600;
      const height = containerRef.current.clientHeight || 456;

      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      containerRef.current.appendChild(el);

      const root = createRoot(el);
      root.render(
          <ForceGraph2D
          graphData={{ nodes: graphNodes, links: graphLinks }}
          nodeId="id"
          nodeLabel="label"
          nodeColor={(n: GraphNode) => nodeColor(n.type)}
          nodeVal={(n: GraphNode) => (n.id === focusId ? 6 : 3)}
          linkLabel={(l: { type: string }) => l.type}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkColor={() => '#475569'}
          linkWidth={1.5}
          backgroundColor="#0f172a"
          width={width}
          height={height}
          onNodeClick={handleNodeClick}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D) => {
            const label = (node.label as string) ?? '';
            const short = label.length > 20 ? label.slice(0, 18) + '…' : label;
            ctx.font = '5px Inter, sans-serif';
            ctx.fillStyle = '#f1f5f9';
            ctx.textAlign = 'center';
            ctx.fillText(short, node.x ?? 0, (node.y ?? 0) + 9);
          }}
        />
      );

      cleanupRef.current = () => {
        root.unmount();
        el.remove();
      };
    }).catch(err => {
      console.error('[GraphCanvas] Failed to load graph library:', err);
    });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [nodes, relationships, focusId, handleNodeClick]);

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
