// ============================================================
// CropFit — AdminGuard (Light / White Theme)
// Enforces admin-only access for protected administrative URLs.
// Unauthenticated users are redirected to /admin/login.
// Non-admin users are blocked with a clear 403 Forbidden view.
// ============================================================

'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { ShieldIcon, AlertTriangleIcon, ChevronRightIcon } from './icons';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  const isAdminLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isAdminLoginPage) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cropfit_admin_redirect', pathname);
      }
      router.replace('/admin/login');
    }
  }, [isAuthenticated, isLoading, pathname, router, isAdminLoginPage]);

  // If on /admin/login itself, render without role check
  if (isAdminLoginPage) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center animate-pulse">
            <ShieldIcon size={24} />
          </div>
          <p className="text-xs text-slate-500 font-medium">Verifying Administrative Clearance...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated, but role is NOT admin (e.g. farmer or technician)
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200/90 text-center space-y-5 shadow-xl shadow-slate-200/50">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto flex items-center justify-center">
            <AlertTriangleIcon size={28} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              403 Forbidden
            </span>
            <h2 className="text-lg font-bold text-slate-900 pt-1">
              Admin Privileges Required
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are currently signed in as <strong className="text-slate-900">{user.email}</strong> with role{' '}
              <strong className="text-amber-700 uppercase">{user.role}</strong>.
              This URL is protected and restricted strictly to System Administrators.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
            >
              <span>Return to Standard Greenhouse Dashboard</span>
              <ChevronRightIcon size={14} />
            </Link>

            <button
              onClick={() => {
                useAuthStore.getState().logout();
                router.push('/admin/login');
              }}
              className="w-full py-2 px-4 rounded-xl text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Admin
  return <>{children}</>;
}
