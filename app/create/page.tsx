'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NodeSearch from '@/components/NodeSearch';
import NodeEditor, { INPUT_CLASS, RELATIONSHIP_TYPES } from '@/components/NodeEditor';
import { type RelationshipType } from '@/lib/schemas/relationships';

type Tab = 'node' | 'relationship';

/** `<input type="date">` yields YYYY-MM-DD; the API expects an ISO datetime. */
function toIsoDate(value: string, endOfDay = false): string {
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}

export default function CreatePage() {
  const [tab, setTab] = useState<Tab>('node');

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex gap-2 mb-8">
        <button
          type="button"
          onClick={() => setTab('node')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            tab === 'node'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
          }`}
        >
          Node
        </button>
        <button
          type="button"
          onClick={() => setTab('relationship')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            tab === 'relationship'
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
          }`}
        >
          Relationship
        </button>
      </div>

      {tab === 'node' ? (
        <NodeEditor mode="create" />
      ) : (
        <div className="space-y-8">
          <h1 className="text-2xl font-bold">Add Relationship</h1>
          <RelationshipForm />
        </div>
      )}
    </div>
  );
}

function RelationshipForm() {
  const router = useRouter();
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [type, setType] = useState<RelationshipType>('PARTICIPATED_IN');
  const [role, setRole] = useState('');
  const [relationshipKind, setRelationshipKind] = useState('');
  const [notes, setNotes] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const showKind = type === 'IS_RELATED_TO' || type === 'KNOWS';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fromId || !toId) {
      setError('Select both a from node and a to node.');
      return;
    }
    if (fromId === toId) {
      setError('A relationship needs two different nodes.');
      return;
    }

    const payload = {
      fromId,
      toId,
      type,
      ...(role.trim() ? { role: role.trim() } : {}),
      ...(showKind && relationshipKind.trim() ? { relationshipKind: relationshipKind.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(validFrom ? { validFrom: toIsoDate(validFrom) } : {}),
      ...(validTo ? { validTo: toIsoDate(validTo, true) } : {}),
    };

    setSaving(true);
    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const issue = Array.isArray(data.issues) ? data.issues[0]?.message : undefined;
        setError(issue ?? data.error ?? 'Something went wrong');
      } else {
        router.push(`/nodes/${fromId}`);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* From */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">From node *</label>
        <NodeSearch
          value={fromId}
          onChange={(id) => setFromId(id || null)}
          placeholder="Search for the source node…"
        />
      </div>

      {/* To */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">To node *</label>
        <NodeSearch
          value={toId}
          onChange={(id) => setToId(id || null)}
          placeholder="Search for the target node…"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Type *</label>
        <select
          value={type}
          onChange={e => setType(e.target.value as RelationshipType)}
          className={INPUT_CLASS}
        >
          {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Role</label>
        <input
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="e.g. payer, witness, guarantor"
          className={INPUT_CLASS}
        />
      </div>

      {/* Relationship kind — only for person-to-person types */}
      {showKind && (
        <div>
          <label className="block text-sm text-slate-400 mb-1">Relationship kind</label>
          <input
            value={relationshipKind}
            onChange={e => setRelationshipKind(e.target.value)}
            placeholder="e.g. spouse, parent, colleague"
            className={INPUT_CLASS}
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className={`${INPUT_CLASS} resize-none`}
        />
      </div>

      {/* Validity */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Valid from</label>
          <input
            type="date"
            value={validFrom}
            onChange={e => setValidFrom(e.target.value)}
            className={`${INPUT_CLASS} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Valid to</label>
          <input
            type="date"
            value={validTo}
            onChange={e => setValidTo(e.target.value)}
            className={`${INPUT_CLASS} [color-scheme:dark]`}
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {saving ? 'Saving…' : 'Create Relationship'}
      </button>
    </form>
  );
}
