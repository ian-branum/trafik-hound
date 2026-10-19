'use client';

import { useEffect, useRef, useState } from 'react';

interface SearchNode {
  id: string;
  label: string;
  type?: string;
}

interface NodeSearchProps {
  value: string | null;
  onChange: (id: string, label: string) => void;
  placeholder?: string;
}

export default function NodeSearch({ value, onChange, placeholder }: NodeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchNode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedLabel, setSelectedLabel] = useState('');

  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced type-ahead search.
  useEffect(() => {
    const q = query.trim();

    // Don't re-search the label we just picked from the list.
    if (!q || (q === selectedLabel && value)) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/nodes?q=${encodeURIComponent(q)}&limit=10`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as SearchNode[];
        setResults(Array.isArray(data) ? data : []);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedLabel, value]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    setOpen(true);
    setActiveIndex(-1);
    // Editing the text invalidates a previously picked node.
    if (value) onChange('', '');
  }

  function select(node: SearchNode) {
    setQuery(node.label);
    setSelectedLabel(node.label);
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    onChange(node.id, node.label);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? -1 : (i + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) =>
        results.length === 0 ? -1 : (i - 1 + results.length) % results.length
      );
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        select(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Search nodes…'}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
      />

      {showDropdown && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-slate-500">Searching…</div>}

          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
          )}

          {!loading &&
            results.map((node, index) => (
              <button
                key={node.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(node)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  index === activeIndex
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{node.label}</span>
                {node.type && (
                  <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
                    {node.type}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
