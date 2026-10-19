import { notFound } from 'next/navigation';
import Link from 'next/link';
import NeighborhoodGraph from './NeighborhoodGraph';
import { getNodeById } from '@/lib/graph/nodes';
import { getRelationshipsForNode } from '@/lib/graph/relationships';
import { getNeighborhood as getNeighborhoodData } from '@/lib/graph/queries';

export const instant = false;

type Rel = {
  type: string;
  direction: 'outgoing' | 'incoming';
  otherNode: Record<string, unknown>;
  props: Record<string, unknown>;
};

const SKIP_KEYS = new Set(['id', 'label', 'type', 'createdAt']);

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [node, relationships, neighborhood] = await Promise.all([
    getNodeById(id),
    getRelationshipsForNode(id),
    getNeighborhoodData(id, 2),
  ]);

  if (!node) notFound();
  const n = node as Record<string, unknown>;
  const extras = Object.entries(n).filter(([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== null && v !== '');

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <Link href="/explore" className="text-sm text-slate-500 hover:text-white transition-colors">
          ← Back to Explore
        </Link>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-3xl font-bold">{n.label as string}</h1>
            <span className="text-sm px-3 py-1 rounded-full bg-slate-800 text-slate-300">
              {n.subtype ? `${n.type} · ${n.subtype as string}` : n.type as string}
            </span>
          </div>
          <Link
            href={`/nodes/${id}/edit`}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
          >
            Edit
          </Link>
        </div>
        <p className="text-slate-500 text-xs mt-1">id: {id}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: properties + relationships */}
        <div className="space-y-6">
          {/* Properties */}
          {extras.length > 0 && (
            <div className="border border-slate-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Properties</h2>
              <dl className="space-y-2">
                {extras.map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-sm">
                    <dt className="text-slate-500 w-32 shrink-0">{k}</dt>
                    <dd className="text-slate-200 break-all">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Relationships */}
          <div className="border border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Relationships ({relationships.length})
            </h2>
            {relationships.length === 0 ? (
              <p className="text-slate-600 text-sm">None yet.</p>
            ) : (
              <ul className="space-y-3">
                {relationships.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 text-xs px-2 py-0.5 rounded font-mono ${
                      r.direction === 'outgoing' ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {r.direction === 'outgoing' ? '→' : '←'} {r.type}
                    </span>
                    <div>
                      <Link
                        href={`/nodes/${r.otherNode.id as string}`}
                        className="text-white hover:underline font-medium"
                      >
                        {r.otherNode.label as string}
                      </Link>
                      {r.props.role !== undefined && (
                        <span className="ml-2 text-slate-500">as {String(r.props.role)}</span>
                      )}
                      <span className="ml-2 text-xs text-slate-600">{r.otherNode.type as string}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: graph */}
        <div className="border border-slate-800 rounded-lg overflow-hidden" style={{ height: '500px' }}>
          <div className="px-4 py-3 border-b border-slate-800 text-sm text-slate-400">
            Neighborhood (depth 2)
          </div>
          {neighborhood ? (
            <NeighborhoodGraph
              nodes={neighborhood.nodes as Parameters<typeof NeighborhoodGraph>[0]['nodes']}
              relationships={neighborhood.relationships}
              focusId={id}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              No neighborhood data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
