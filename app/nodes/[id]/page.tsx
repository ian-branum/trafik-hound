import { notFound } from 'next/navigation';
import Link from 'next/link';
import NeighborhoodPanel from './NeighborhoodPanel';
import { getNodeById } from '@/lib/graph/nodes';
import { getRelationshipsForNode } from '@/lib/graph/relationships';

import { ALL_NODE_FIELD_KEYS, getNodeFields, type FieldDef } from '@/lib/schemas/nodeFields';

export const instant = false;

type Rel = {
  type: string;
  direction: 'outgoing' | 'incoming';
  otherNode: Record<string, unknown>;
  props: Record<string, unknown>;
};

const SKIP_KEYS = new Set([
  'id',
  'label',
  'type',
  'subtype',
  'createdAt',
  'marqueeUrl',
  'images',
  'documents',
  'passwordHash',
  // Type-specific fields get their own labelled section below.
  ...ALL_NODE_FIELD_KEYS,
]);

function formatDate(value: unknown): string {
  const raw = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateTime(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function hasValue(field: FieldDef, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  // Only show boolean fields when explicitly true — false is the default/unset state
  if (field.kind === 'boolean') return value === true || value === 'true';
  return true;
}

function displayValue(field: FieldDef, value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (field.kind === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  if (field.kind === 'date') return formatDate(value);
  if (field.kind === 'datetime') return formatDateTime(value);
  return String(value);
}

export default async function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [node, relationships] = await Promise.all([
    getNodeById(id),
    getRelationshipsForNode(id),
  ]);

  if (!node) notFound();
  const n = node as Record<string, unknown>;
  const extras = Object.entries(n).filter(
    ([k, v]) => !SKIP_KEYS.has(k) && v !== undefined && v !== null && v !== ''
  );
  const typeEntries = getNodeFields(n.type)
    .filter((field) => hasValue(field, n[field.key]))
    .map((field) => ({ field, display: displayValue(field, n[field.key]) }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <Link href="/explore" className="text-sm text-slate-500 hover:text-white transition-colors">
          ← Back to Explore
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <h1 className="text-3xl font-bold">{n.label as string}</h1>
            <span className="text-sm px-3 py-1 rounded-full bg-slate-800 text-slate-300">
              {n.subtype ? `${n.type} · ${n.subtype as string}` : n.type as string}
            </span>
          </div>
          <div className="flex items-start gap-3 shrink-0">
            {typeof n.marqueeUrl === 'string' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/download?url=${encodeURIComponent(n.marqueeUrl)}`}
                alt={n.label as string}
                className="h-20 w-20 object-cover rounded-lg border border-slate-700"
              />
            )}
            <Link
              href={`/nodes/${id}/edit`}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              Edit
            </Link>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-1">id: {id}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: properties + relationships */}
        <div className="space-y-6">
          {/* Type-specific properties */}
          {typeEntries.length > 0 && (
            <div className="border border-slate-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Properties
              </h2>
              <dl className="space-y-2">
                {typeEntries.map(({ field, display }) => (
                  <div key={field.key} className="flex gap-3 text-sm">
                    <dt className="text-slate-500 w-32 shrink-0">{field.label}</dt>
                    <dd className="text-slate-200 break-all">{display}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Anything not covered by the field registry */}
          {extras.length > 0 && (
            <div className="border border-slate-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Other properties
              </h2>
              <dl className="space-y-2">
                {extras.map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-sm">
                    <dt className="text-slate-500 w-32 shrink-0">{k}</dt>
                    <dd className="text-slate-200 break-all">
                      {Array.isArray(v) ? v.map(String).join(', ') : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Images */}
          {(() => {
            let images: { url: string; name: string; size: number }[] = [];
            try { images = JSON.parse(n.images as string ?? '[]'); } catch { images = []; }
            if (images.length === 0) return null;
            return (
              <div className="border border-slate-800 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Images ({images.length})
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img, i) => (
                    <a
                      key={i}
                      href={`/api/download?url=${encodeURIComponent(img.url)}`}
                      target="_blank"
                      rel="noreferrer"
                      title={img.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/download?url=${encodeURIComponent(img.url)}`}
                        alt={img.name}
                        className="h-20 w-20 object-cover rounded-lg border border-slate-700 hover:border-slate-500 transition-colors"
                      />
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Documents */}
          {(() => {
            let documents: { url: string; name: string; size: number; mimeType?: string }[] = [];
            try { documents = JSON.parse(n.documents as string ?? '[]'); } catch { documents = []; }
            if (documents.length === 0) return null;
            const fmt = (b: number) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
            return (
              <div className="border border-slate-800 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Documents ({documents.length})
                </h2>
                <ul className="space-y-2">
                  {documents.map((doc, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">📄</span>
                      <a
                        href={`/api/download?url=${encodeURIComponent(doc.url)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white hover:underline truncate"
                      >
                        {doc.name}
                      </a>
                      <span className="text-xs text-slate-500 shrink-0">{fmt(doc.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

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
        <NeighborhoodPanel nodeId={id} />
      </div>
    </div>
  );
}
