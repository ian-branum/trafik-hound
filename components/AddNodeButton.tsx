'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function AddNodeButton() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  if (role === 'viewer') return null;
  return (
    <Link
      href="/create"
      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
    >
      Add Node
    </Link>
  );
}
