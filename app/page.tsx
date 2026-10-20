import Link from 'next/link';
import AddNodeButton from '@/components/AddNodeButton';

const ENTITY_TYPES = [
  { label: 'People',        type: 'Person',       icon: '👤', color: 'text-blue-400' },
  { label: 'Organizations', type: 'Organization',  icon: '🏛️', color: 'text-emerald-400' },
  { label: 'Agents',        type: 'Agent',         icon: '🤖', color: 'text-violet-400' },
  { label: 'Transactions',  type: 'Transaction',   icon: '💸', color: 'text-amber-400' },
  { label: 'Interactions',  type: 'Interaction',   icon: '🤝', color: 'text-orange-400' },
  { label: 'Agreements',    type: 'Agreement',     icon: '📜', color: 'text-pink-400' },
  { label: 'Records',       type: 'Record',        icon: '🗂️', color: 'text-slate-400' },
  { label: 'Assets',        type: 'Asset',         icon: '🏠', color: 'text-teal-400' },
];

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          🐕 Trafik<span className="text-blue-400">-hound</span>
        </h1>
        <p className="text-slate-400 text-xl max-w-xl mx-auto">
          Record and traverse relationships between people, organizations, events, and artifacts.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/explore"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Explore Graph
          </Link>
          <AddNodeButton />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ENTITY_TYPES.map(({ label, type, icon, color }) => (
          <Link
            key={type}
            href={`/explore?type=${type}`}
            className="group border border-slate-800 rounded-lg p-5 hover:border-slate-600 hover:bg-slate-900 transition-all text-center"
          >
            <div className={`text-3xl mb-2`}>{icon}</div>
            <div className={`font-semibold ${color}`}>{label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
