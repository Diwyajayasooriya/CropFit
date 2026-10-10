// ============================================================
// CropFit — LayoutWrapper
// Conditionally applies DashboardLayout to protected pages while
// keeping public pages (like /login, /onboarding, /claim) full-screen.
// ============================================================

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DashboardLayout } from './layout/DashboardLayout';

// Pages that render without the sidebar/nav shell
const STANDALONE_ROUTES = ['/login', '/onboarding', '/claim'];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone =
    STANDALONE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/')) ||
    pathname.startsWith('/admin');

  if (isStandalone) {
    return <>{children}</>;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
