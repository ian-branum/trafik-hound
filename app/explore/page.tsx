'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import NodeCard from '@/components/NodeCard';

const TYPES = ['Person', 'Organization', 'Agent', 'Transaction', 'Interaction', 'Agreement', 'Record', 'Asset'];
const PAGE_SIZE = 50;

type GraphNode = Record<string, unknown>;

function ExploreInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialType = searchParams.get('type') ?? '';
  const initialQ = searchParams.get('q') ?? '';
  const initialPage = parseInt(searchParams.get('page') ?? '1', 10);

  const [type, setType] = useState(initialType);
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(initialPage);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const doFetch = useCallback(async (t: string, query: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (t) params.set('type', t);
    if (query) params.set('q', query);
    params.set('limit', String(PAGE_SIZE));
    params.set('skip', String((p - 1) * PAGE_SIZE));
    const res = await fetch(`/api/nodes?${params}`);
    const data = await res.json();
    // Handle both new {nodes, total} shape and legacy plain array
    const nodeList = Array.isArray(data) ? data : (Array.isArray(data.nodes) ? data.nodes : []);
    const nodeTotal = typeof data.total === 'number' ? data.total : nodeList.length;
    setNodes(nodeList);
    setTotal(nodeTotal);
    setLoading(false);
  }, []);

  useEffect(() => {
    doFetch(initialType, initialQ, initialPage);
  }, [initialType, initialQ, initialPage]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    params.set('page', '1');
    router.replace(`/explore?${params}`);
    setPage(1);
    doFetch(type, q, 1);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    params.set('page', String(p));
    router.replace(`/explore?${params}`);
    setPage(p);
    doFetch(type, q, p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by label…"
          className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Search
        </button>
      </form>

      {/* Result count */}
      {!loading && total > 0 && (
        <p className="text-slate-500 text-sm mb-4">
          Showing {from}–{to} of <span className="text-slate-300 font-medium">{total}</span> results
        </p>
      )}

      {loading && <p className="text-slate-500 text-sm">Loading…</p>}

      {!loading && nodes.length === 0 && (
        <p className="text-slate-500 text-sm">No results. Try a different search or add some nodes.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {nodes.map(n => (
          <NodeCard key={n.id as string} node={n} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>

          {/* Page number pills — show up to 7 pages around current */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="text-slate-600 text-sm px-1">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p as number)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    p === page
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  {p}
                </button>
              )
            )}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}

export default function ExplorePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Explore</h1>
      <Suspense fallback={<p className="text-slate-500 text-sm">Loading…</p>}>
        <ExploreInner />
      </Suspense>
    </div>
  );
}
