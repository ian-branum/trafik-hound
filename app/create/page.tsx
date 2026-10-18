'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function CreatePage() {
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
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Add Node</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Type *</label>
          <select
            value={type}
            onChange={e => { setType(e.target.value); setSubtype(''); }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
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
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-blue-500 resize-none"
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
    </div>
  );
}
