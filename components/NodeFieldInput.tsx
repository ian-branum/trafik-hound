'use client';

import { INPUT_CLASS } from '@/components/NodeEditor';
import type { FieldDef } from '@/lib/schemas/nodeFields';

interface Props {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, value: string | number | boolean | null) => void;
  readOnly?: boolean;
}

/** Coerce whatever Neo4j hands back into something an input can display. */
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

/** `YYYY-MM-DD` (dates are stored date-only, so never route them through Date). */
function toDateInputValue(value: unknown): string {
  const raw = toDisplayString(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
}

/** ISO datetime → `YYYY-MM-DDTHH:mm` in the viewer's local timezone. */
function toDateTimeInputValue(value: unknown): string {
  const raw = toDisplayString(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toDisplayValue(field: FieldDef, value: unknown): string {
  if (field.kind === 'boolean') return value ? 'Yes' : 'No';
  return toDisplayString(value);
}

export default function NodeFieldInput({ field, value, onChange, readOnly = false }: Props) {
  if (readOnly) {
    return (
      <div className="flex gap-3 text-sm">
        <dt className="text-slate-500 w-32 shrink-0">{field.label}</dt>
        <dd className="text-slate-200 break-all">{toDisplayValue(field, value) || '—'}</dd>
      </div>
    );
  }

  const emit = (next: string | number | boolean | null) => onChange(field.key, next);

  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value === true || value === 'true'}
          onChange={(e) => emit(e.target.checked)}
          className="h-4 w-4 rounded border-slate-700 bg-slate-800 accent-blue-600"
        />
        <span className="text-sm text-slate-300">{field.label}</span>
      </label>
    );
  }

  let control: React.ReactNode;

  switch (field.kind) {
    case 'number':
      control = (
        <input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            emit(raw === '' ? null : Number(raw));
          }}
          placeholder={field.placeholder}
          className={INPUT_CLASS}
        />
      );
      break;

    case 'date':
      control = (
        <input
          type="date"
          value={toDateInputValue(value)}
          onChange={(e) => emit(e.target.value || null)}
          className={`${INPUT_CLASS} [color-scheme:dark]`}
        />
      );
      break;

    case 'datetime':
      control = (
        <input
          type="datetime-local"
          value={toDateTimeInputValue(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) {
              emit(null);
              return;
            }
            const date = new Date(raw);
            emit(Number.isNaN(date.getTime()) ? null : date.toISOString());
          }}
          className={`${INPUT_CLASS} [color-scheme:dark]`}
        />
      );
      break;

    case 'enum':
      control = (
        <select
          value={toDisplayString(value)}
          onChange={(e) => emit(e.target.value || null)}
          className={INPUT_CLASS}
        >
          <option value="">— select —</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;

    case 'text':
    default:
      control = (
        <input
          type="text"
          value={toDisplayString(value)}
          onChange={(e) => emit(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT_CLASS}
        />
      );
      break;
  }

  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{field.label}</label>
      {control}
    </div>
  );
}
