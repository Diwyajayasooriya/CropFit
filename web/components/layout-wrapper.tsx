// ============================================================
// CropFit — LayoutWrapper
// Conditionally applies AppShell to protected pages while
// keeping public pages (like /login) full-screen.
// ============================================================

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from './app-shell';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = pathname === '/login' || pathname.startsWith('/admin');

  if (isStandalone) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
