'use client';

import Link from 'next/link';

type Props = {
  node: Record<string, unknown>;
  compact?: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  Person:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Organization: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Agent:        'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Transaction:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Interaction:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Agreement:    'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Record:       'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Asset:        'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
};

const SKIP_KEYS = new Set(['id', 'label', 'type', 'createdAt', 'marqueeUrl', 'images', 'documents']);

export default function NodeCard({ node, compact = false }: Props) {
  const type = node.type as string;
  const label = node.label as string;
  const id = node.id as string;
  const colorClass = TYPE_COLORS[type] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  const marqueeUrl = typeof node.marqueeUrl === 'string' ? node.marqueeUrl : null;

  const extras = Object.entries(node).filter(([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== null && v !== '');

  return (
    <Link href={`/nodes/${id}`} className="block group">
      <div className={`border rounded-lg p-4 transition-all hover:scale-[1.01] hover:shadow-lg ${colorClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white group-hover:underline">{label}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border mt-1 inline-block ${colorClass}`}>
              {node.subtype ? `${type} · ${node.subtype}` : type}
            </span>
          </div>
          {marqueeUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/download?url=${encodeURIComponent(marqueeUrl)}`}
              alt={label}
              className="h-16 w-16 object-contain rounded-lg border border-slate-700 bg-slate-900 shrink-0"
            />
          )}
        </div>
        {!compact && extras.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
            {extras.slice(0, 6).map(([k, v]) => (
              <div key={k} className="col-span-1 truncate">
                <dt className="inline text-slate-500">{k}: </dt>
                <dd className="inline">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Link>
  );
}
