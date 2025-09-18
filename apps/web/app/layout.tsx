import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tutor Loop Hub',
  description: 'Keep students, parents, and tutors aligned in one-click screens.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen bg-slate-50`}>{children}</body>
    </html>
  );
}
