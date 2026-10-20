'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { typeColorClass } from '@/lib/typeColors';

type SearchNode = { id: string; label: string; type?: string };

type PathNode = Record<string, unknown>;
type PathRel = { from: string; to: string; type: string; props: Record<string, unknown> };
type PathResult = { nodes: PathNode[]; relationships: PathRel[] };

type DepthResult = { paths: PathResult[]; capped: boolean };

interface Props {
  sourceNode: { id: string; label: string };
  onClose: () => void;
}

function truncate(value: string, max = 20): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** One node in the chain — a type-coloured pill linking to the node page. */
function NodePill({ node, endpoint }: { node: PathNode; endpoint: boolean }) {
  const label = typeof node.label === 'string' ? node.label : 'Untitled';
  return (
    <Link
      href={`/nodes/${String(node.id)}`}
      target="_blank"
      rel="noreferrer"
      title={label}
      className={`inline-block max-w-[180px] truncate rounded-full border transition hover:brightness-125 ${typeColorClass(
        node.type
      )} ${endpoint ? 'px-3 py-1.5 text-sm font-bold' : 'px-2.5 py-1 text-xs'}`}
    >
      {truncate(label)}
    </Link>
  );
}

/** The connector between two nodes: rel type label + direction arrow. */
function Edge({ rel, fromId }: { rel: PathRel; fromId: string }) {
  const outgoing = rel.from === fromId;

  return (
    <div className="flex items-center gap-1 md:flex-col md:gap-0.5 px-1 py-0.5 md:py-0">
      <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">{rel.type}</span>
      <div className="flex items-center gap-0.5 text-slate-600">
        <span className="hidden md:block h-px w-3 bg-slate-700" />
        <span className="text-[10px] leading-none">{outgoing ? '▶' : '◀'}</span>
        <span className="hidden md:block h-px w-3 bg-slate-700" />
      </div>
    </div>
  );
}

function PathChain({
  path,
  index,
  total,
}: {
  path: PathResult;
  index: number;
  total: number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      {total > 1 && (
        <p className="text-xs text-slate-500 mb-2">
          Path {index + 1} of {total}
        </p>
      )}
      <div className="flex flex-col md:flex-row md:flex-wrap items-center gap-1">
        {path.nodes.map((node, i) => (
          <div
            key={`${String(node.id)}-${i}`}
            className="flex flex-col md:flex-row items-center gap-1"
          >
            <NodePill
              node={node}
              endpoint={i === 0 || i === path.nodes.length - 1}
            />
            {i < path.relationships.length && (
              <Edge rel={path.relationships[i]} fromId={String(node.id)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FindConnectionModal({ sourceNode, onClose }: Props) {
  // ── Target search ────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchNode[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<SearchNode | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Path discovery ───────────────────────────────────────────────────────
  const [minHops, setMinHops] = useState<number | null>(null);
  const [minHopsDone, setMinHopsDone] = useState(false);
  const [activeDepth, setActiveDepth] = useState<number | null>(null);
  const [cache, setCache] = useState<Record<number, DepthResult>>({});
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState('');

  // Debounced type-ahead (3+ characters).
  useEffect(() => {
    const term = query.trim();

    // Don't re-open the dropdown for the label we just picked.
    if (term.length < 3 || (target && term === selectedLabel)) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/nodes?q=${encodeURIComponent(term)}&limit=10`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        const nodes = (Array.isArray(json) ? json : json?.nodes ?? []) as SearchNode[];
        setResults(nodes.filter((node) => node.id !== sourceNode.id));
        setSearchOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedLabel, sourceNode.id, target]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as globalThis.Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Escape closes the modal.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const loadDepth = useCallback(
    async (depth: number, toId: string) => {
      setActiveDepth(depth);
      setTimedOut(false);
      setError('');

      if (cache[depth]) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/path?from=${encodeURIComponent(sourceNode.id)}&to=${encodeURIComponent(
            toId
          )}&depth=${depth}`,
          { cache: 'no-store' }
        );

        if (res.status === 408) {
          setTimedOut(true);
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Could not load paths.');
          return;
        }

        setCache((prev) => ({
          ...prev,
          [depth]: { paths: data.paths ?? [], capped: Boolean(data.capped) },
        }));
      } catch {
        setError('Network error.');
      } finally {
        setLoading(false);
      }
    },
    [cache, sourceNode.id]
  );

  async function selectTarget(node: SearchNode) {
    setTarget(node);
    setSelectedLabel(node.label);
    setQuery(node.label);
    setSearchOpen(false);
    setResults([]);

    setMinHops(null);
    setMinHopsDone(false);
    setCache({});
    setActiveDepth(null);
    setTimedOut(false);
    setError('');
    setLoading(true);

    try {
      const res = await fetch(
        `/api/path?from=${encodeURIComponent(sourceNode.id)}&to=${encodeURIComponent(
          node.id
        )}&mode=minhops`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not check the connection.');
        return;
      }

      const hops = typeof data.minHops === 'number' ? data.minHops : null;
      setMinHops(hops);
      if (hops !== null) {
        setLoading(false);
        await loadDepth(hops, node.id);
      }
    } catch {
      setError('Network error.');
    } finally {
      setMinHopsDone(true);
      setLoading(false);
    }
  }

  const chips =
    minHops === null
      ? []
      : [minHops, minHops + 1, minHops + 2];

  const current = activeDepth !== null ? cache[activeDepth] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Find connection"
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Find Connection</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paths from <span className="text-slate-300">{sourceNode.label}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-slate-700 px-2 py-1 text-sm text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Target search */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm text-slate-400 mb-1">Connect to…</label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
                setTarget(null);
                setSelectedLabel('');
                setMinHops(null);
                setMinHopsDone(false);
                setCache({});
                setActiveDepth(null);
                setTimedOut(false);
                setError('');
              }}
              placeholder="Search nodes (3+ characters)…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searching && (
              <span className="absolute right-3 top-9 text-xs text-slate-600 animate-pulse">
                Searching…
              </span>
            )}

            {searchOpen && query.trim().length >= 3 && results.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                {results.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => void selectTarget(node)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors"
                    >
                      <span className="truncate text-slate-200">{node.label}</span>
                      {node.type && (
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${typeColorClass(
                            node.type
                          )}`}
                        >
                          {node.type}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {searchOpen && query.trim().length >= 3 && !searching && results.length === 0 && (
              <p className="mt-1 text-xs text-slate-600">No matching nodes.</p>
            )}
          </div>

          {/* Result area */}
          {target && minHopsDone && minHops === null && (
            <p className="text-sm text-slate-400">
              No connection found within 9 degrees.
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {target && minHops !== null && (
            <div className="space-y-4">
              {/* Degree chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-400">Degrees</span>
                <div className="flex gap-1">
                  {chips.map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => void loadDepth(depth, target.id)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        activeDepth === depth
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                      }`}
                    >
                      {depth}°
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-600">
                  shortest: {minHops}° to {truncate(target.label, 28)}
                </span>
              </div>

              {/* Paths */}
              {timedOut ? (
                <p className="text-sm text-amber-400">
                  Query timed out — too many paths at this degree.
                </p>
              ) : current && current.paths.length > 0 ? (
                <div className="space-y-3 divide-y divide-slate-800">
                  {current.paths.map((path, index) => (
                    <div key={index} className={index > 0 ? 'pt-3' : undefined}>
                      <PathChain path={path} index={index} total={current.paths.length} />
                    </div>
                  ))}
                  {current.capped && (
                    <p className="pt-3 text-xs text-amber-400">
                      Showing 20 of many paths at this degree. Results may be incomplete.
                    </p>
                  )}
                </div>
              ) : current ? (
                <p className="text-sm text-slate-500">No paths at this degree.</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Loading overlay (modal content only) */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl bg-slate-950/70 backdrop-blur-sm">
            <svg
              className="h-8 w-8 animate-spin text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
              />
            </svg>
            <span className="text-sm text-slate-400">Searching paths…</span>
          </div>
        )}
      </div>
    </div>
  );
}
