'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type Note = {
  id: string;
  nodeId: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

interface Props {
  nodeId: string;
}

/** Pinned first, then oldest first within each group. */
function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function IconPin({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconPublish() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

const ACTION_BUTTON =
  'rounded-md p-1.5 text-slate-400 hover:text-white transition-colors';

export default function NotesPanel({ nodeId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [toastId, setToastId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/notes`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? 'Could not load notes.');
        } else {
          setNotes(sortNotes((data.notes ?? []) as Note[]));
        }
      } catch {
        if (!cancelled) setError('Network error while loading notes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const startCreate = useCallback(() => {
    setError('');
    setEditingId(null);
    setCreating(true);
    setDraft('');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  function startEdit(note: Note) {
    setError('');
    setCreating(false);
    setEditingId(note.id);
    setDraft(note.content);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelEdit() {
    setCreating(false);
    setEditingId(null);
    setDraft('');
  }

  async function save() {
    const content = draft.trim();
    if (!content) {
      setError('A note cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (creating) {
        const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Could not save the note.');
          return;
        }
        setNotes((prev) => sortNotes([...prev, data.note as Note]));
        setCreating(false);
      } else if (editingId) {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(nodeId)}/notes/${encodeURIComponent(editingId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'Could not save the note.');
          return;
        }
        const updated = data.note as Note;
        setNotes((prev) =>
          sortNotes(prev.map((note) => (note.id === updated.id ? updated : note)))
        );
        setEditingId(null);
      }
      setDraft('');
    } catch {
      setError('Network error while saving.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(note: Note) {
    setError('');
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(nodeId)}/notes/${encodeURIComponent(note.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinned: !note.pinned }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not update the note.');
        return;
      }
      const updated = data.note as Note;
      setNotes((prev) =>
        sortNotes(prev.map((item) => (item.id === updated.id ? updated : item)))
      );
    } catch {
      setError('Network error while updating.');
    }
  }

  async function publish(note: Note) {
    setError('');
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(nodeId)}/notes/${encodeURIComponent(note.id)}/publish`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not publish the note.');
        return;
      }

      setToastId(note.id);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastId(null), 2000);
    } catch {
      setError('Network error while publishing.');
    }
  }

  async function remove(note: Note) {
    if (!window.confirm('Delete this note?')) return;
    setError('');
    try {
      const res = await fetch(
        `/api/nodes/${encodeURIComponent(nodeId)}/notes/${encodeURIComponent(note.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not delete the note.');
        return;
      }
      setNotes((prev) => prev.filter((item) => item.id !== note.id));
    } catch {
      setError('Network error while deleting.');
    }
  }

  /** Wrap the selection (or place syntax at the cursor). */
  function applyFormat(format: 'bold' | 'italic' | 'bullet') {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    let next = value;
    let caret = selectionStart;

    if (format === 'bold') {
      next =
        value.slice(0, selectionStart) + `**${selected || 'bold text'}**` + value.slice(selectionEnd);
      caret = selectionStart + 2 + (selected || 'bold text').length;
    } else if (format === 'italic') {
      next =
        value.slice(0, selectionStart) + `*${selected || 'italic text'}*` + value.slice(selectionEnd);
      caret = selectionStart + 1 + (selected || 'italic text').length;
    } else {
      next =
        value.slice(0, selectionStart) +
        (selected || 'list item')
          .split('\n')
          .map((line) => `- ${line}`)
          .join('\n') +
        value.slice(selectionEnd);
      caret = selectionStart + 2;
    }

    setDraft(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  }

  const editor = (
    <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40">
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => applyFormat('bold')}
          title="Bold"
          className="rounded-md border border-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyFormat('italic')}
          title="Italic"
          className="rounded-md border border-slate-700 px-2 py-0.5 text-xs italic text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => applyFormat('bullet')}
          title="Bullet list"
          className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
        >
          •
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        placeholder="Markdown supported…"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
      />

      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Private to you — publish a note to share it in Discussion.
        </p>
        <button
          type="button"
          onClick={startCreate}
          disabled={creating}
          className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 transition-colors"
        >
          + New note
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-600">Loading notes…</p>
      ) : notes.length === 0 && !creating ? (
        <p className="text-sm text-slate-600">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) =>
            editingId === note.id ? (
              <div key={note.id}>{editor}</div>
            ) : (
              <div
                key={note.id}
                className="border border-slate-800 rounded-lg p-4 bg-slate-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void togglePin(note)}
                      title={note.pinned ? 'Unpin' : 'Pin'}
                      aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                      className={`${ACTION_BUTTON} ${note.pinned ? 'text-amber-400' : ''}`}
                    >
                      <IconPin filled={note.pinned} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      title="Edit"
                      aria-label="Edit note"
                      className={ACTION_BUTTON}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      onClick={() => void publish(note)}
                      title="Publish to discussion"
                      aria-label="Publish note"
                      className={ACTION_BUTTON}
                    >
                      <IconPublish />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(note)}
                      title="Delete"
                      aria-label="Delete note"
                      className={`${ACTION_BUTTON} hover:text-red-400`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                {toastId === note.id && (
                  <p className="mt-2 text-xs text-emerald-400">Published to Discussion ✓</p>
                )}
              </div>
            )
          )}

          {creating && <div>{editor}</div>}
        </div>
      )}
    </div>
  );
}
