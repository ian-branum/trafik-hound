'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function AccessLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AuditAction | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

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
              <th className="px-4 py-3 font-medium whitespace-nowrap">Timestamp (UTC)</th>
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
                <tr key={entry.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-xs">
                    {formatDateTime(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 truncate max-w-[12rem]">
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
                    {entry.targetLabel ?? entry.targetId ?? (
                      <span className="text-slate-600">—</span>
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
  );
}
