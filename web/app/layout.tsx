import type { ReactNode } from 'react';
import './globals.css';

/**
 * Root layout. The <html> tag is written by the locale-aware layout under
 * `app/[locale]/layout.tsx` — this root exists mainly to import the global
 * stylesheet + share metadata defaults across all localised pages.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
