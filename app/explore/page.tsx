'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import NodeCard from '@/components/NodeCard';

const TYPES = ['Person', 'Organization', 'Agent', 'Transaction', 'Interaction', 'Agreement', 'Record', 'Asset'];

type GraphNode = Record<string, unknown>;

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [type, setType] = useState(searchParams.get('type') ?? '');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async (t: string, query: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (t) params.set('type', t);
    if (query) params.set('q', query);
    const res = await fetch(`/api/nodes?${params}`);
    const data = await res.json();
    setNodes(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch_(type, q);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    router.replace(`/explore?${params}`);
    fetch_(type, q);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Explore</h1>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-8">
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

      {loading && <p className="text-slate-500 text-sm">Loading…</p>}

      {!loading && nodes.length === 0 && (
        <p className="text-slate-500 text-sm">No results. Try a different search or add some nodes.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {nodes.map(n => (
          <NodeCard key={n.id as string} node={n} />
        ))}
      </div>
    </div>
  );
}
