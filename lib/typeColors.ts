/**
 * Shared type → tailwind class mapping for node type badges/pills.
 * Used by NodeCard and the Find Connection modal.
 */
export const TYPE_COLORS: Record<string, string> = {
  Person:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Organization: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Agent:        'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Transaction:  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Interaction:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Agreement:    'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Record:       'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Asset:        'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
};

export const DEFAULT_TYPE_COLOR = 'bg-slate-500/20 text-slate-300 border-slate-500/30';

export function typeColorClass(type: unknown): string {
  return typeof type === 'string' ? (TYPE_COLORS[type] ?? DEFAULT_TYPE_COLOR) : DEFAULT_TYPE_COLOR;
}
