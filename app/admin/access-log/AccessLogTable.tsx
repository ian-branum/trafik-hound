'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import type { AuditAction, AuditEntry } from '@/lib/audit/log';

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'auth_login', label: 'Auth: Login' },
  { value: 'node_create', label: 'Node: Create' },
  { value: 'node_edit', label: 'Node: Edit' },
  { value: 'node_delete', label: 'Node: Delete' },
  { value: 'edge_create', label: 'Edge: Create' },
  { value: 'edge_delete', label: 'Edge: Delete' },
  { value: 'graph_query', label: 'Graph: Query' },
];

const ACTION_COLORS: Record<string, string> = {
  auth_login: 'bg-emerald-950/40 border-emerald-900 text-emerald-300',
  node_create: 'bg-blue-950/40 border-blue-900 text-blue-300',
  node_edit: 'bg-amber-950/40 border-amber-900 text-amber-300',
  node_delete: 'bg-red-950/40 border-red-900 text-red-300',
  edge_create: 'bg-violet-950/40 border-violet-900 text-violet-300',
  edge_delete: 'bg-pink-950/40 border-pink-900 text-pink-300',
  graph_query: 'bg-slate-800 border-slate-700 text-slate-300',
};

const PAGE_SIZE = 50;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Neo4j node ids in this app are cuid2 (24 chars), not UUIDs.
const CUID_RE = /^[a-z0-9]{20,32}$/i;

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  });
}

/** Resolves a node ID to a label — cached in module scope to avoid refetching. */
const nodeCache = new Map<string, string | null>();

async function resolveNodeLabel(id: string): Promise<string | null> {
  if (nodeCache.has(id)) return nodeCache.get(id) ?? null;
  try {
    const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`);
    if (!res.ok) {
      nodeCache.set(id, null);
      return null;
    }
    const data = (await res.json()) as { node?: { label?: string } };
    const label = data.node?.label ?? null;
    nodeCache.set(id, label);
    return label;
  } catch {
    nodeCache.set(id, null);
    return null;
  }
}

/** True when this key/value pair looks like a reference to a graph node. */
function looksLikeNodeId(key: string, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (UUID_RE.test(value)) return true;
  return /id$/i.test(key) && CUID_RE.test(value) && /[a-z]/i.test(value);
}

/** A single detail value — node ids resolve to labelled links. */
function DetailValue({ valueKey, value }: { valueKey: string; value: unknown }) {
  const isNodeId = looksLikeNodeId(valueKey, value);
  const id = isNodeId ? (value as string) : '';
  const [label, setLabel] = useState<string | null>(null);
  const [resolved, setResolved] = useState(!isNodeId);

  useEffect(() => {
    if (!isNodeId) return;
    let alive = true;
    resolveNodeLabel(id)
      .then((l) => {
        if (alive) {
          setLabel(l);
          setResolved(true);
        }
      })
      .catch(() => {
        if (alive) setResolved(true);
      });
    return () => {
      alive = false;
    };
  }, [isNodeId, id]);

  if (isNodeId) {
    if (!resolved) {
      return <span className="text-slate-500 animate-pulse">{id.slice(0, 8)}…</span>;
    }
    return (
      <Link
        href={`/nodes/${id}`}
        target="_blank"
        className={
          label
            ? 'text-blue-400 hover:underline'
            : 'text-blue-400/60 hover:underline font-mono text-xs'
        }
      >
        {label ?? id}
      </Link>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className={value ? 'text-emerald-300' : 'text-slate-400'}>
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return <span className="text-amber-300">{String(value)}</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-slate-600">null</span>;
  }
  return <span className="text-slate-200 break-all">{String(value)}</span>;
}

/** Renders the detail field: parsed JSON as key/value rows, else raw <pre>. */
function DetailSection({ detail }: { detail: string | null | undefined }) {
  if (!detail) return null;

  let parsed: Record<string, unknown> | null = null;
  try {
    const p: unknown = JSON.parse(detail);
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      parsed = p as Record<string, unknown>;
    }
  } catch {
    // Not JSON — fall through to the <pre> renderer.
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Detail
      </p>
      {parsed ? (
        <dl className="space-y-2">
          {Object.entries(parsed).map(([key, value]) => (
            <div key={key} className="flex gap-3 text-sm">
              <dt className="text-slate-500 w-28 shrink-0">{key}</dt>
              <dd className="min-w-0">
                <DetailValue valueKey={key} value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all">
          {detail}
        </pre>
      )}
    </div>
  );
}

/** Entry detail modal. */
function EntryModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                ACTION_COLORS[entry.action] ??
                'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {entry.action}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {formatDateTime(entry.timestamp)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <dl className="space-y-3">
            <div className="flex gap-3 text-sm">
              <dt className="text-slate-500 w-24 shrink-0">User</dt>
              <dd className="text-slate-200 break-all">
                {entry.userEmail ?? <span className="text-slate-600">—</span>}
              </dd>
            </div>
            {entry.userId && (
              <div className="flex gap-3 text-sm">
                <dt className="text-slate-500 w-24 shrink-0">User ID</dt>
                <dd className="text-slate-500 font-mono text-xs break-all">
                  {entry.userId}
                </dd>
              </div>
            )}
            {(entry.targetId || entry.targetLabel) && (
              <div className="flex gap-3 text-sm">
                <dt className="text-slate-500 w-24 shrink-0">Target</dt>
                <dd className="min-w-0 break-all">
                  {entry.targetId ? (
                    <Link
                      href={`/nodes/${entry.targetId}`}
                      target="_blank"
                      className="text-blue-400 hover:underline"
                    >
                      {entry.targetLabel ?? entry.targetId}
                    </Link>
                  ) : (
                    <span className="text-slate-200">{entry.targetLabel}</span>
                  )}
                </dd>
              </div>
            )}
            <div className="flex gap-3 text-sm">
              <dt className="text-slate-500 w-24 shrink-0">Entry ID</dt>
              <dd className="text-slate-600 font-mono text-xs break-all">{entry.id}</dd>
            </div>
          </dl>

          <DetailSection detail={entry.detail} />
        </div>
      </div>
    </div>
  );
}

export default function AccessLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change goes back to the first page.
  useEffect(() => {
    setPage(0);
  }, [action, debouncedSearch]);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('limit', String(PAGE_SIZE));
      params.set('skip', String(page * PAGE_SIZE));

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        entries?: AuditEntry[];
        total?: number;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Failed to load the audit log.');
        return;
      }

      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('Network error while loading the audit log.');
    } finally {
      setLoading(false);
    }
  }, [action, debouncedSearch, page]);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      {selectedEntry && (
        <EntryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as AuditAction | '')}
            className="rounded-md bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="search"
            placeholder="Search user, target, detail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-md bg-slate-950 border border-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />

          <button
            type="button"
            onClick={() => void fetchLog()}
            className="rounded-md border border-slate-800 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">
                  Timestamp (UTC)
                </th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No entries found.
                  </td>
                </tr>
              )}
              {!loading &&
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-xs">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs truncate max-w-[12rem]">
                      {entry.userEmail ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          ACTION_COLORS[entry.action] ??
                          'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {entry.targetLabel ?? (
                        entry.targetId ? (
                          <span className="font-mono text-slate-500">
                            {entry.targetId.slice(0, 8)}…
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[16rem] truncate">
                      {entry.detail ?? '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{total} total entries</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-md border border-slate-800 disabled:opacity-40 hover:text-white hover:border-slate-600 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-md border border-slate-800 disabled:opacity-40 hover:text-white hover:border-slate-600 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
