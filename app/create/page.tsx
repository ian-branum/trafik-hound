'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NodeSearch from '@/components/NodeSearch';
import { relationshipType, type RelationshipType } from '@/lib/schemas/relationships';

const TYPES = ['Person', 'Organization', 'Agent', 'Transaction', 'Interaction', 'Agreement', 'Record', 'Asset'];

const SUBTYPES: Record<string, string[]> = {
  Organization: ['company', 'government', 'ngo', 'family', 'club', 'team', 'committee', 'other'],
  Agent:        ['ai', 'automated', 'software', 'other'],
  Transaction:  ['financial', 'sale', 'barter', 'gift', 'service', 'rights-transfer', 'obligation-transfer'],
  Interaction:  ['meeting', 'negotiation', 'communication', 'attack', 'arrest', 'detention', 'inspection', 'other'],
  Agreement:    ['contract', 'deed', 'treaty', 'mou', 'other'],
  Record:       ['filing', 'report', 'registry-entry', 'other'],
  Asset:        ['account', 'real-property', 'personal-property', 'location', 'intellectual-property', 'other'],
};

const RELATIONSHIP_TYPES = relationshipType.options;

const INPUT_CLASS =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500';

type Tab = 'node' | 'relationship';

/** `<input type="date">` yields YYYY-MM-DD; the API expects an ISO datetime. */
function toIsoDate(value: string, endOfDay = false): string {
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}

export default function CreatePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('node');

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">
        {tab === 'node' ? 'Add Node' : 'Add Relationship'}
      </h1>

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

      {tab === 'node' ? <NodeForm /> : <RelationshipForm />}
    </div>
  );
}

function NodeForm() {
  const router = useRouter();
  const [type, setType] = useState('Person');
  const [label, setLabel] = useState('');
  const [subtype, setSubtype] = useState('');
  const [notes, setNotes] = useState('');
  const [extra, setExtra] = useState(''); // JSON blob for extra fields
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const subtypes = SUBTYPES[type] ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    let extraFields = {};
    if (extra.trim()) {
      try {
        extraFields = JSON.parse(extra);
      } catch {
        setError('Extra fields must be valid JSON');
        return;
      }
    }

    const payload = {
      type,
      label,
      ...(subtype ? { subtype } : {}),
      ...(notes ? { notes } : {}),
      ...extraFields,
    };

    setSaving(true);
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
      } else {
        router.push(`/nodes/${data.id}`);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Type *</label>
        <select
          value={type}
          onChange={e => { setType(e.target.value); setSubtype(''); }}
          className={INPUT_CLASS}
        >
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Subtype */}
      {subtypes.length > 0 && (
        <div>
          <label className="block text-sm text-slate-400 mb-1">Subtype</label>
          <select
            value={subtype}
            onChange={e => setSubtype(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">— select —</option>
            {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Label */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Label *</label>
        <input
          required
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={type === 'Person' ? 'Full name' : 'Display name'}
          className={INPUT_CLASS}
        />
      </div>

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

      {/* Extra fields */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Extra fields <span className="text-slate-600">(JSON)</span>
        </label>
        <textarea
          value={extra}
          onChange={e => setExtra(e.target.value)}
          rows={3}
          placeholder={'{"firstName": "Stannis", "nationality": "Westerosi"}'}
          className={`${INPUT_CLASS} placeholder-slate-600 font-mono text-sm resize-none`}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {saving ? 'Saving…' : 'Create Node'}
      </button>
    </form>
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
