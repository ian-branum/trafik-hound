'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

type Mode = 'signin' | 'register';

export default function SignInPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setError('Could not start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const address = email.trim();
    if (!address || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: address, password }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };

        if (!res.ok) {
          setError(data.error ?? 'Could not create your account.');
          setSubmitting(false);
          return;
        }
      }

      const result = await signIn('credentials', {
        email: address,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (mode === 'register') {
          setMode('signin');
          setNotice('Account created — please sign in.');
        } else {
          setError('Invalid email or password.');
        }
        setSubmitting(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const busy = googleLoading || submitting;

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🐕</div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Sign in to Trafik<span className="text-blue-400">-hound</span>
        </h1>
        <p className="text-slate-400 text-sm">
          New accounts need to be approved by an admin before they can access the app.
        </p>
      </div>

      <div className="border border-slate-800 rounded-xl p-6 bg-slate-900/50 space-y-5">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.6-5.1l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.4-4 5.7l6.3 5.2C37 40.4 44 35 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          or
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm text-slate-400">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm text-slate-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? mode === 'register'
                ? 'Creating account…'
                : 'Signing in…'
              : mode === 'register'
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p className="text-sm text-emerald-400" role="status">
            {notice}
          </p>
        )}

        <p className="text-center text-sm text-slate-500">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      <p className="text-center text-xs text-slate-600 mt-6">
        <Link href="/" className="hover:text-slate-400 transition-colors">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
