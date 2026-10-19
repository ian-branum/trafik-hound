'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NodeSearch from '@/components/NodeSearch';
import NodeFieldInput from '@/components/NodeFieldInput';
import { getNodeFields } from '@/lib/schemas/nodeFields';
import { relationshipType, type RelationshipType } from '@/lib/schemas/relationships';

export const NODE_TYPES = [
  'Person',
  'Organization',
  'Agent',
  'Transaction',
  'Interaction',
  'Agreement',
  'Record',
  'Asset',
];

export const SUBTYPES: Record<string, string[]> = {
  Organization: ['company', 'government', 'ngo', 'family', 'club', 'team', 'committee', 'other'],
  Agent:        ['ai', 'automated', 'software', 'other'],
  Transaction:  ['financial', 'sale', 'barter', 'gift', 'service', 'rights-transfer', 'obligation-transfer'],
  Interaction:  ['meeting', 'negotiation', 'communication', 'attack', 'arrest', 'detention', 'inspection', 'other'],
  Agreement:    ['contract', 'deed', 'treaty', 'mou', 'other'],
  Record:       ['filing', 'report', 'registry-entry', 'other'],
  Asset:        ['account', 'real-property', 'personal-property', 'location', 'intellectual-property', 'other'],
};

export const RELATIONSHIP_TYPES = relationshipType.options;

export const INPUT_CLASS =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500';

type GraphNode = Record<string, unknown> & {
  id: string;
  label: string;
  type: string;
  subtype?: string;
  notes?: string;
};

interface GraphRelationship {
  type: string;
  direction: 'outgoing' | 'incoming';
  otherNode: Record<string, unknown>;
  props: Record<string, unknown>;
}

type AttachmentKind = 'image' | 'document';

interface Attachment {
  url: string;
  name: string;
  size: number;
  mimeType?: string;
}

/** Attachments live on the node as JSON strings; tolerate both shapes. */
function parseAttachments(raw: unknown): Attachment[] {
  if (Array.isArray(raw)) return raw as Attachment[];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type TypeFieldValues = Record<string, string | number | boolean | null>;

/** Seed the type-specific field state from a loaded node. */
function initialTypeFields(node: Record<string, unknown>): TypeFieldValues {
  const values: TypeFieldValues = {};
  for (const field of getNodeFields(node.type)) {
    const raw = node[field.key];

    if (field.kind === 'boolean') {
      values[field.key] = raw === true || raw === 'true';
    } else if (field.kind === 'number') {
      const num = typeof raw === 'number' ? raw : Number(raw);
      values[field.key] = raw === null || raw === undefined || raw === '' || Number.isNaN(num)
        ? null
        : num;
    } else if (Array.isArray(raw)) {
      values[field.key] = raw.map(String).join(', ');
    } else {
      values[field.key] = raw === null || raw === undefined ? '' : String(raw);
    }
  }
  return values;
}

/**
 * Build the PATCH fragment for type-specific fields.
 * Empty values are sent as `null`, which removes the property in Neo4j.
 */
function buildTypeFieldPatch(type: unknown, values: TypeFieldValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of getNodeFields(type)) {
    const value = values[field.key];

    if (field.kind === 'boolean') {
      patch[field.key] = value === true || value === 'true';
      continue;
    }

    const text = typeof value === 'string' ? value.trim() : value;

    if (field.kind === 'number') {
      const num = text === null || text === undefined || text === '' ? NaN : Number(text);
      patch[field.key] = Number.isNaN(num) ? null : num;
      continue;
    }

    if (field.key === 'aliases') {
      // Stored as a string array in Neo4j.
      const list =
        typeof text === 'string'
          ? text.split(',').map((item) => item.trim()).filter(Boolean)
          : [];
      patch[field.key] = list.length > 0 ? list : null;
      continue;
    }

    patch[field.key] = text === null || text === undefined || text === '' ? null : String(text);
  }

  return patch;
}

export interface NodeEditorProps {
  mode: 'create' | 'edit';
  /** Required in edit mode — the node id. */
  id?: string;
  /** Set to false to suppress the built-in h1 (e.g. when the parent renders its own heading). */
  showHeading?: boolean;
}

/** `<input type="date">` yields YYYY-MM-DD; the API expects an ISO datetime. */
function toIsoDate(value: string, endOfDay = false): string {
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString();
}

export default function NodeEditor({ mode, id, showHeading = true }: NodeEditorProps) {
  const router = useRouter();
  const isEdit = mode === 'edit';

  // ── Node fields ──────────────────────────────────────────────────────────
  const [type, setType] = useState('Person');
  const [label, setLabel] = useState('');
  const [subtype, setSubtype] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Edit mode: load state ────────────────────────────────────────────────
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [node, setNode] = useState<GraphNode | null>(null);
  const [relationships, setRelationships] = useState<GraphRelationship[]>([]);

  // ── Edit mode: inline add-relationship form ──────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [relType, setRelType] = useState<RelationshipType>('PARTICIPATED_IN');
  const [role, setRole] = useState('');
  const [relNotes, setRelNotes] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [relSaving, setRelSaving] = useState(false);
  const [relError, setRelError] = useState('');

  const [deleting, setDeleting] = useState(false);

  // ── Edit mode: type-specific fields ──────────────────────────────────────
  const [typeFields, setTypeFields] = useState<TypeFieldValues>({});

  // ── Edit mode: attachments ───────────────────────────────────────────────
  const [images, setImages] = useState<Attachment[]>([]);
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<AttachmentKind | null>(null);
  const [attachError, setAttachError] = useState('');
  const [marqueeUrl, setMarqueeUrl] = useState<string | null>(null);
  const [marqueeUpdating, setMarqueeUpdating] = useState(false);

  const loadRelationships = useCallback(async () => {
    const res = await fetch(`/api/nodes/${encodeURIComponent(id ?? '')}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { relationships?: GraphRelationship[] };
    setRelationships(Array.isArray(data.relationships) ? data.relationships : []);
  }, [id]);

  useEffect(() => {
    if (!isEdit) return;
    if (!id) {
      setLoading(false);
      setLoadError('Missing node id.');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(id!)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!cancelled) setLoadError(data.error ?? 'Could not load this node.');
          return;
        }

        const loaded = data.node as GraphNode;
        if (cancelled) return;
        setNode(loaded);
        setType(loaded.type ?? 'Person');
        setLabel(loaded.label ?? '');
        setSubtype(loaded.subtype ?? '');
        setNotes(loaded.notes ?? '');
        setRelationships(Array.isArray(data.relationships) ? data.relationships : []);
        setImages(parseAttachments(loaded.images));
        setDocuments(parseAttachments(loaded.documents));
        setTypeFields(initialTypeFields(loaded as Record<string, unknown>));
        setMarqueeUrl(typeof loaded.marqueeUrl === 'string' ? loaded.marqueeUrl : null);
      } catch {
        if (!cancelled) setLoadError('Network error.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  // ── Create ───────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!label.trim()) {
      setError('Label is required.');
      return;
    }

    const payload = {
      type,
      label: label.trim(),
      ...(subtype ? { subtype } : {}),
      ...(notes ? { notes } : {}),
    };

    setSaving(true);
    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }

      router.push(`/nodes/${data.id}/edit`);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  // ── Edit: save node fields ───────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (!id) return;
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          subtype: subtype.trim() || null,
          notes: notes.trim() || null,
          ...buildTypeFieldPatch(node?.type, typeFields),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Could not save changes.');
        return;
      }

      setNode(data as GraphNode);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  // ── Edit: relationships ──────────────────────────────────────────────────
  async function handleDeleteRelationship(rel: GraphRelationship) {
    if (!id) return;
    const other = rel.otherNode as { id: string; label: string; type?: string };
    const fromId = rel.direction === 'outgoing' ? id : other.id;
    const toId = rel.direction === 'outgoing' ? other.id : id;
    const roleValue = typeof rel.props.role === 'string' ? rel.props.role : undefined;

    const ok = window.confirm(
      `Delete this relationship?\n\n${rel.direction === 'outgoing' ? '→' : '←'} ${rel.type} ${
        rel.direction === 'outgoing' ? 'to' : 'from'
      } ${other.label}${roleValue ? ` (role: ${roleValue})` : ''}`
    );
    if (!ok) return;

    try {
      const res = await fetch('/api/relationships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId,
          toId,
          type: rel.type,
          ...(roleValue !== undefined ? { role: roleValue } : {}),
        }),
      });

      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? 'Could not delete the relationship.');
        return;
      }

      setRelationships((prev) => prev.filter((r) => r !== rel));
    } catch {
      window.alert('Network error.');
    }
  }

  async function handleAddRelationship(e: React.FormEvent) {
    e.preventDefault();
    setRelError('');

    if (!id) return;
    if (!otherId) {
      setRelError('Select the other node.');
      return;
    }

    const fromId = direction === 'out' ? id : otherId;
    const toId = direction === 'out' ? otherId : id;

    setRelSaving(true);
    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId,
          toId,
          type: relType,
          ...(role.trim() ? { role: role.trim() } : {}),
          ...(relNotes.trim() ? { notes: relNotes.trim() } : {}),
          ...(validFrom ? { validFrom: toIsoDate(validFrom) } : {}),
          ...(validTo ? { validTo: toIsoDate(validTo, true) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const issue = Array.isArray(data.issues) ? data.issues[0]?.message : undefined;
        setRelError(issue ?? data.error ?? 'Could not create the relationship.');
        return;
      }

      await loadRelationships();
      resetRelForm();
    } catch {
      setRelError('Network error.');
    } finally {
      setRelSaving(false);
    }
  }

  function resetRelForm() {
    setShowForm(false);
    setOtherId(null);
    setDirection('out');
    setRelType('PARTICIPATED_IN');
    setRole('');
    setRelNotes('');
    setValidFrom('');
    setValidTo('');
    setRelError('');
  }

  // ── Edit: delete node ────────────────────────────────────────────────────
  async function handleDeleteNode() {
    if (!id) return;

    const ok = window.confirm(
      'Delete this node and all its relationships? This cannot be undone.'
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? 'Could not delete the node.');
        return;
      }
      router.push('/explore');
    } catch {
      window.alert('Network error.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit mode: attachments ───────────────────────────────────────────────
  async function handleUpload(kind: AttachmentKind, file: File) {
    if (!id) return;
    setUploading(kind);
    setAttachError('');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('nodeId', id);
      form.append('kind', kind);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAttachError(data.error ?? 'Upload failed.');
        return;
      }

      const attachment = data as Attachment;
      if (kind === 'image') {
        setImages((prev) => [...prev, attachment]);
      } else {
        setDocuments((prev) => [...prev, attachment]);
      }
    } catch {
      setAttachError('Network error while uploading.');
    } finally {
      setUploading(null);
    }
  }

  async function handleSetMarquee(url: string) {
    if (!id || marqueeUpdating) return;
    const newUrl = marqueeUrl === url ? null : url; // toggle off if already marquee
    setMarqueeUpdating(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marqueeUrl: newUrl }),
      });
      if (res.ok) setMarqueeUrl(newUrl);
    } catch {
      // silently ignore — marquee is non-critical
    } finally {
      setMarqueeUpdating(false);
    }
  }

  async function handleRemoveAttachment(kind: AttachmentKind, attachment: Attachment) {
    if (!id) return;

    const ok = window.confirm(`Delete “${attachment.name}”?`);
    if (!ok) return;

    setAttachError('');
    try {
      const res = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: id, url: attachment.url, kind }),
      });

      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setAttachError(data.error ?? 'Could not delete the attachment.');
        return;
      }

      if (kind === 'image') {
        setImages((prev) => prev.filter((item) => item.url !== attachment.url));
      } else {
        setDocuments((prev) => prev.filter((item) => item.url !== attachment.url));
      }
    } catch {
      setAttachError('Network error while deleting.');
    }
  }

  // ── Edit mode: loading / error states ────────────────────────────────────
  if (isEdit && loading) {
    return <p className="text-slate-400 text-sm">Loading node…</p>;
  }

  if (isEdit && (loadError || !node)) {
    return (
      <div>
        <Link href="/explore" className="text-sm text-slate-500 hover:text-white transition-colors">
          ← Back to Explore
        </Link>
        <p className="mt-4 text-red-400 text-sm">{loadError || 'Node not found.'}</p>
      </div>
    );
  }

  const subtypes = SUBTYPES[isEdit ? (node?.type ?? '') : type] ?? [];
  const editFieldDefs = isEdit ? getNodeFields(node?.type) : [];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        {isEdit && id && (
          <Link
            href={`/nodes/${id}`}
            className="text-sm text-slate-500 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        )}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {showHeading && <h1 className="text-2xl font-bold">{isEdit ? 'Edit node' : 'Add Node'}</h1>}
          {isEdit && node && (
            <span className="text-sm px-3 py-1 rounded-full bg-slate-800 text-slate-300">
              {node.subtype ? `${node.type} · ${node.subtype}` : node.type}
            </span>
          )}
        </div>
        {isEdit && id && <p className="text-slate-500 text-xs mt-1">id: {id}</p>}
      </div>

      {/* Node fields */}
      <form onSubmit={isEdit ? handleSave : handleCreate} className="space-y-5">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Type *</label>
          {isEdit ? (
            <>
              <div className="inline-block rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
                {node?.type}
              </div>
              <p className="text-xs text-slate-600 mt-1">The node type can’t be changed.</p>
            </>
          ) : (
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setSubtype('');
              }}
              className={INPUT_CLASS}
            >
              {NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        {subtypes.length > 0 && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subtype</label>
            <select
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">— select —</option>
              {subtypes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Label *</label>
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={type === 'Person' ? 'Full name' : 'Display name'}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        {isEdit && editFieldDefs.length > 0 && (
          <div className="border-t border-slate-800 pt-5 space-y-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {node?.type} fields
            </h2>
            {editFieldDefs.map((field) => (
              <NodeFieldInput
                key={field.key}
                field={field}
                value={typeFields[field.key] ?? ''}
                onChange={(key, value) =>
                  setTypeFields((prev) => ({ ...prev, [key]: value }))
                }
              />
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className={
              isEdit
                ? 'px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors'
                : 'w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors'
            }
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create Node'}
          </button>
          {isEdit && saved && <span className="text-emerald-400 text-sm">Saved ✓</span>}
        </div>
      </form>

      {/* Relationships (edit only) */}
      {isEdit && (
        <div className="border-t border-slate-800 pt-8">
          <h2 className="text-lg font-semibold mb-4">Relationships ({relationships.length})</h2>

          {relationships.length === 0 ? (
            <p className="text-slate-600 text-sm mb-4">None yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {relationships.map((rel, index) => {
                const other = rel.otherNode as { id: string; label: string; type?: string };
                return (
                  <li
                    key={`${rel.type}-${rel.direction}-${other.id}-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                  >
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono ${
                        rel.direction === 'outgoing'
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rel.direction === 'outgoing' ? '→' : '←'} {rel.type}
                    </span>
                    <Link
                      href={`/nodes/${other.id}`}
                      className="text-sm text-white hover:underline truncate"
                    >
                      {other.label}
                    </Link>
                    {typeof rel.props.role === 'string' && (
                      <span className="text-xs text-slate-500">as {rel.props.role}</span>
                    )}
                    <span className="text-xs text-slate-600">{other.type}</span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteRelationship(rel)}
                      title="Delete relationship"
                      aria-label="Delete relationship"
                      className="ml-auto shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:border-red-800 transition-colors"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              + Add relationship
            </button>
          ) : (
            <form
              onSubmit={handleAddRelationship}
              className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
            >
              <div>
                <label className="block text-sm text-slate-400 mb-1">Other node *</label>
                <NodeSearch
                  value={otherId}
                  onChange={(nextId) => setOtherId(nextId || null)}
                  placeholder="Search for a node…"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Direction</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('out')}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      direction === 'out'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    This node → Other
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('in')}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      direction === 'in'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    Other → This node
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Type *</label>
                <select
                  value={relType}
                  onChange={(e) => setRelType(e.target.value as RelationshipType)}
                  className={INPUT_CLASS}
                >
                  {RELATIONSHIP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Role</label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. payer, witness, guarantor"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={relNotes}
                  onChange={(e) => setRelNotes(e.target.value)}
                  rows={2}
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Valid from</label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className={`${INPUT_CLASS} [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Valid to</label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className={`${INPUT_CLASS} [color-scheme:dark]`}
                  />
                </div>
              </div>

              {relError && <p className="text-red-400 text-sm">{relError}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={relSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {relSaving ? 'Adding…' : 'Add relationship'}
                </button>
                <button
                  type="button"
                  onClick={resetRelForm}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Attachments (edit only) */}
      {isEdit && (
        <div className="border-t border-slate-800 pt-8">
          <h2 className="text-lg font-semibold mb-4">Attachments</h2>

          {attachError && <p className="text-red-400 text-sm mb-3">{attachError}</p>}

          {/* Images */}
          <div className="mb-6">
            <h3 className="text-sm text-slate-400 mb-2">
              Images {images.length > 0 && <span className="text-slate-600">({images.length})</span>}
            </h3>

            {images.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                {images.map((image) => (
                  <div key={image.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/download?url=${encodeURIComponent(image.url)}`}
                      alt={image.name}
                      className={`h-24 w-24 object-cover rounded-lg border-2 ${marqueeUrl === image.url ? 'border-yellow-400' : 'border-slate-700'}`}
                    />
                    {/* Star: set as marquee image */}
                    <button
                      type="button"
                      onClick={() => void handleSetMarquee(image.url)}
                      title={marqueeUrl === image.url ? 'Remove as marquee image' : 'Set as marquee image'}
                      aria-label={marqueeUrl === image.url ? 'Remove marquee' : 'Set as marquee'}
                      className={`absolute bottom-1 left-1 h-6 w-6 flex items-center justify-center rounded-full bg-slate-950/80 border text-xs transition-colors ${
                        marqueeUrl === image.url
                          ? 'border-yellow-400 text-yellow-400'
                          : 'border-slate-700 text-slate-500 hover:text-yellow-400 hover:border-yellow-600'
                      }`}
                    >
                      ★
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => void handleRemoveAttachment('image', image)}
                      title={`Delete ${image.name}`}
                      aria-label={`Delete ${image.name}`}
                      className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-slate-950/80 border border-slate-700 text-slate-300 text-xs hover:text-red-400 hover:border-red-800 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-sm mb-3">No images yet.</p>
            )}

            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-sm transition-colors ${
                uploading !== null
                  ? 'opacity-40 pointer-events-none'
                  : 'text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer'
              }`}
            >
              {uploading === 'image' ? 'Uploading…' : '+ Attach image'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploading !== null}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleUpload('image', file);
                }}
              />
            </label>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-sm text-slate-400 mb-2">
              Documents{' '}
              {documents.length > 0 && <span className="text-slate-600">({documents.length})</span>}
            </h3>

            {documents.length > 0 ? (
              <ul className="space-y-2 mb-3">
                {documents.map((document) => (
                  <li
                    key={document.url}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                  >
                    <span className="text-slate-500 text-sm" aria-hidden="true">
                      📄
                    </span>
                    <a
                      href={`/api/download?url=${encodeURIComponent(document.url)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-white hover:underline truncate"
                    >
                      {document.name}
                    </a>
                    <span className="text-xs text-slate-500 shrink-0">
                      {formatSize(document.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRemoveAttachment('document', document)}
                      title={`Delete ${document.name}`}
                      aria-label={`Delete ${document.name}`}
                      className="ml-auto shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:border-red-800 transition-colors"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600 text-sm mb-3">No documents yet.</p>
            )}

            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-sm transition-colors ${
                uploading !== null
                  ? 'opacity-40 pointer-events-none'
                  : 'text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer'
              }`}
            >
              {uploading === 'document' ? 'Uploading…' : '+ Attach document'}
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                disabled={uploading !== null}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void handleUpload('document', file);
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Danger zone (edit only) */}
      {isEdit && (
        <div className="border-t border-slate-800 pt-8">
          <button
            type="button"
            onClick={() => void handleDeleteNode()}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-red-900 bg-red-950/40 text-sm text-red-400 hover:bg-red-950/70 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete node'}
          </button>
          <p className="text-xs text-slate-600 mt-2">
            This also removes every relationship attached to this node.
          </p>
        </div>
      )}
    </div>
  );
}
