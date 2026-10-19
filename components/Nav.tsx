'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';

const LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/create', label: 'Create' },
];

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split('@')[0] || '?';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export default function Nav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user;
  const isAdmin = user?.role === 'admin';

  const links = isAdmin ? [...LINKS, { href: '/admin/users', label: 'Admin' }] : LINKS;

  const linkClass = (href: string) =>
    `transition-colors hover:text-white ${pathname === href ? 'text-white' : ''}`;

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
            <span className="text-2xl">🐕</span>
            <span>Trafik<span className="text-blue-400">-hound</span></span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {status === 'loading' && (
            <span className="text-sm text-slate-600">…</span>
          )}

          {status === 'authenticated' && user && (
            <>
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt={user.name ?? 'User avatar'}
                      className="h-7 w-7 rounded-full border border-slate-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 flex items-center justify-center">
                      {initials(user.name, user.email)}
                    </span>
                  )}
                  <span className="text-sm text-slate-300 max-w-[10rem] truncate">
                    {user.name ?? user.email}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Sign out
                </button>
              </div>

              <button
                type="button"
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((open) => !open)}
                className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
              >
                <span className="sr-only">Menu</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileOpen ? (
                    <>
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </>
                  ) : (
                    <>
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </>
                  )}
                </svg>
              </button>
            </>
          )}

          {status === 'unauthenticated' && (
            <Link
              href="/auth/signin"
              className="text-sm px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {mobileOpen && status === 'authenticated' && user && (
        <div className="sm:hidden border-t border-slate-800 px-4 py-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? 'User avatar'}
                className="h-7 w-7 rounded-full border border-slate-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 flex items-center justify-center">
                {initials(user.name, user.email)}
              </span>
            )}
            <span className="text-slate-300 truncate">{user.name ?? user.email}</span>
          </div>
          <div className="flex flex-col gap-2 text-slate-400">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="text-left text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
