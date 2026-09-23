// ============================================================
// CropFit — AuthGuard & Session Provider
// Handles client-side route protection, session hydration,
// and redirection for unauthenticated requests.
// ============================================================

'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { SproutIcon } from './icons';

interface AuthGuardProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES = ['/login', '/admin/login'];

export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_ROUTES.includes(pathname);

    if (!isAuthenticated && !isPublic) {
      if (pathname.startsWith('/admin')) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cropfit_admin_redirect', pathname);
        }
        router.replace('/admin/login');
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cropfit_redirect', pathname);
        }
        router.replace('/login');
      }
    } else if (isAuthenticated && isPublic) {
      const redirectUrl =
        pathname === '/admin/login'
          ? sessionStorage.getItem('cropfit_admin_redirect') || '/admin'
          : sessionStorage.getItem('cropfit_redirect') || '/';

      sessionStorage.removeItem('cropfit_redirect');
      sessionStorage.removeItem('cropfit_admin_redirect');
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // While checking auth status on protected pages, show a calm loading pulse
  if (isLoading && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center animate-pulse">
            <SproutIcon size={28} />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              CropFit Smart Greenhouse
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Connecting to Edge Gateway...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
