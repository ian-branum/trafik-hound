'use client';

import { useState, useEffect, useCallback } from 'react';
import GraphCanvas from '@/components/GraphCanvas';
import FindConnectionModal from '@/components/FindConnectionModal';

type GraphNode = { id: string; label: string; type: string; [key: string]: unknown };
type GraphRel = { from: string; to: string; type: string };

interface Props {
  nodeId: string;
  nodeLabel: string;
}

const DEPTHS = [1, 2, 3] as const;
type Depth = typeof DEPTHS[number];

export default function NeighborhoodPanel({ nodeId, nodeLabel }: Props) {
  const [depth, setDepth] = useState<Depth>(1);
  const [findOpen, setFindOpen] = useState(false);
  const [data, setData] = useState<{ nodes: GraphNode[]; relationships: GraphRel[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async (d: Depth) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/neighborhood?depth=${d}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => { void load(depth); }, [depth, load]);

  // Escape key collapses fullscreen
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  const titleBar = (
    <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400 shrink-0">Separation</span>
        {/* Depth chipset */}
        <div className="flex gap-1">
          {DEPTHS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDepth(d)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                depth === d
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {d}°
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-slate-600 animate-pulse">Loading…</span>}
      </div>

      <div className="flex items-center gap-2">
        {/* Find connection */}
        <button
          type="button"
          onClick={() => setFindOpen(true)}
          title="Find Connection"
          aria-label="Find Connection"
          className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        {/* Expand / Collapse button */}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse (Esc)' : 'Expand to fullscreen'}
          aria-label={expanded ? 'Collapse graph' : 'Expand graph'}
          className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        >
          {expanded ? (
            // Collapse icon
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
              <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
            </svg>
          ) : (
            // Expand icon
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8V3h5"/><path d="M21 8V3h-5"/>
              <path d="M3 16v5h5"/><path d="M21 16v5h-5"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  const graphContent = (
    <>
      {titleBar}
      <div className="w-full" style={{ height: expanded ? 'calc(100vh - 45px)' : '456px' }}>
        {data && data.nodes.length > 0 ? (
          <GraphCanvas nodes={data.nodes} relationships={data.relationships} focusId={nodeId} depth={depth} />
        ) : !loading ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            No connected nodes
          </div>
        ) : null}
      </div>

      {findOpen && (
        <FindConnectionModal
          sourceNode={{ id: nodeId, label: nodeLabel }}
          onClose={() => setFindOpen(false)}
        />
      )}
    </>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col border border-slate-800">
        {graphContent}
      </div>
    );
  }

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      {graphContent}
    </div>
  );
}
