import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
          <span className="text-2xl">🐕</span>
          <span>Trafik<span className="text-blue-400">-hound</span></span>
        </Link>
        <div className="flex items-center gap-6 text-sm text-slate-400">
          <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
          <Link href="/create" className="hover:text-white transition-colors">Create</Link>
        </div>
      </div>
    </nav>
  );
}
