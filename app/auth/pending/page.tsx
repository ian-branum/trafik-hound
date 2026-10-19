'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function PendingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const checkApproval = useCallback(async () => {
    setChecking(true);
    try {
      // Hits the full Auth.js handler, whose jwt callback refreshes `enabled`
      // from Neo4j and writes the updated token cookie.
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = (await res.json()) as { user?: { enabled?: boolean } } | null;
      if (data?.user?.enabled) {
        router.replace('/');
        return;
      }
      setCheckedAt(new Date());
    } catch {
      // Transient failure — the next poll will retry.
    } finally {
      setChecking(false);
    }
  }, [router]);

  // Poll so newly approved users get in without signing out and back in.
  useEffect(() => {
    const timer = setInterval(() => {
      void checkApproval();
    }, 10000);
    return () => clearInterval(timer);
  }, [checkApproval]);

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <div className="text-4xl mb-4">⏳</div>
      <h1 className="text-2xl font-bold mb-3">Account pending approval</h1>
      <p className="text-slate-400 text-sm mb-2">
        {session?.user?.email ? (
          <>
            <span className="text-slate-200">{session.user.email}</span> is signed in, but an admin needs to
            enable the account before you can use Trafik-hound.
          </>
        ) : (
          'An admin needs to enable your account before you can use Trafik-hound.'
        )}
      </p>
      <p className="text-slate-600 text-xs mb-8">This page checks automatically every few seconds.</p>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => void checkApproval()}
          disabled={checking}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="px-4 py-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 text-sm transition-colors"
        >
          Sign out
        </button>
      </div>

      {checkedAt && (
        <p className="text-slate-600 text-xs mt-6">
          Last checked {checkedAt.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
