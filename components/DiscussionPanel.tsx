'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type DiscussionEntry = {
  id: string;
  nodeId: string;
  content: string;
  authorName: string;
  authorImage: string | null;
  publishedAt: string;
  sourceNoteId: string;
  republishOfId: string | null;
};

interface Props {
  nodeId: string;
}

function initials(name: string): string {
  const source = name.trim() || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** "just now" / "3 hours ago" / "5 days ago". */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';

  const units: [number, string][] = [
    [60, 'minute'],
    [60, 'hour'],
    [24, 'day'],
    [7, 'week'],
    [4.35, 'month'],
    [12, 'year'],
  ];

  let value = seconds / 60;
  let unit = 'minute';

  for (let i = 0; i < units.length; i += 1) {
    const [divisor, name] = units[i];
    unit = name;
    if (value < divisor || i === units.length - 1) break;
    value /= divisor;
  }

  const rounded = Math.max(1, Math.round(value));
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`;
}

export default function DiscussionPanel({ nodeId }: Props) {
  const [entries, setEntries] = useState<DiscussionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(nodeId)}/discussion`,
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? 'Could not load the discussion.');
        } else {
          setEntries((data.entries ?? []) as DiscussionEntry[]);
        }
      } catch {
        if (!cancelled) setError('Network error while loading the discussion.');
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
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, DiscussionEntry>();
    for (const entry of entries) map.set(entry.id, entry);
    return map;
  }, [entries]);

  function jumpTo(id: string) {
    const element = document.getElementById(`discussion-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2000);
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading discussion…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No discussion yet. Publish a note from the Notes tab to start the thread.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const original = entry.republishOfId ? byId.get(entry.republishOfId) : undefined;
        const highlighted = highlightId === entry.id;

        return (
          <div
            key={entry.id}
            id={`discussion-${entry.id}`}
            className={`border rounded-lg p-4 transition-colors ${
              highlighted
                ? 'border-blue-500/60 bg-blue-500/5'
                : 'border-slate-800 bg-slate-900/20'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              {entry.authorImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.authorImage}
                  alt={entry.authorName}
                  className="h-7 w-7 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <span className="h-7 w-7 shrink-0 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 flex items-center justify-center">
                  {initials(entry.authorName)}
                </span>
              )}
              <span className="text-sm font-medium text-slate-200">{entry.authorName}</span>
              <span
                className="text-xs text-slate-500"
                title={entry.publishedAt}
              >
                {relativeTime(entry.publishedAt)}
              </span>
            </div>

            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{entry.content}</ReactMarkdown>
            </div>

            {entry.republishOfId && (
              <button
                type="button"
                onClick={() => jumpTo(entry.republishOfId as string)}
                className="mt-3 text-xs text-slate-500 hover:text-blue-300 transition-colors"
              >
                ↩ Re-publish
                {original
                  ? ` — see earlier entry from ${new Date(original.publishedAt).toLocaleDateString(
                      'en-GB',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}`
                  : ' — see earlier entry'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
