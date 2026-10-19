import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import Nav from '@/components/Nav';
import Providers from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Trafik-hound',
  description: 'Graph-based relationship tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-slate-950 text-slate-100 min-h-screen antialiased`}>
        <Providers>
          <Suspense fallback={<div className="h-14 border-b border-slate-800 bg-slate-950" />}>
            <Nav />
          </Suspense>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
