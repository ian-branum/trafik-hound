'use client';

import { useState } from 'react';
import type { AppUser, UserRole } from '@/lib/auth/types';

interface UsersTableProps {
  initialUsers: AppUser[];
  currentUserId: string;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function UsersTable({ initialUsers, currentUserId }: UsersTableProps) {
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchUser(id: string, patch: { enabled?: boolean; role?: UserRole }) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = (await res.json().catch(() => ({}))) as { user?: AppUser; error?: string };

      if (!res.ok || !data.user) {
        setError(data.error ?? 'Could not update user.');
        return;
      }

      const updated = data.user;
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Joined</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No users yet.
                </td>
              </tr>
            )}

            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyId === user.id;

              return (
                <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.image}
                          alt=""
                          className="h-8 w-8 rounded-full border border-slate-700"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-400">
                          {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-slate-200 truncate">
                          {user.name ?? '—'}
                          {isSelf && <span className="ml-2 text-[11px] text-blue-400">you</span>}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300 capitalize">
                      {user.provider}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={busy || isSelf}
                      onChange={(e) => void patchUser(user.id, { role: e.target.value as UserRole })}
                      className="rounded-md bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-blue-500"
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs border ${
                        user.enabled
                          ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
                          : 'border-amber-900 bg-amber-950/40 text-amber-300'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${user.enabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      {user.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(user.lastLoginAt)}</td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy || (isSelf && user.enabled)}
                      onClick={() => void patchUser(user.id, { enabled: !user.enabled })}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        user.enabled
                          ? 'border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {busy ? '…' : user.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600">
        {users.filter((u) => !u.enabled).length} of {users.length} account
        {users.length === 1 ? '' : 's'} awaiting approval.
      </p>
    </div>
  );
}
