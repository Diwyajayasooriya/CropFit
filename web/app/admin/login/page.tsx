// ============================================================
// CropFit — Dedicated Admin Login (`/admin/login`) (Light / White Theme)
// Clean, specialized entry point for system administrators
// ============================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import { ShieldIcon, AlertTriangleIcon, ChevronRightIcon } from '@/components/icons';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter administrator email and password.', 'Required');
      return;
    }

    setSubmitting(true);
    clearError();

    try {
      await login({ email, password });

      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role !== 'admin') {
        useAuthStore.getState().logout();
        toast.error('Account does not possess Administrator privileges.', 'Access Denied');
        return;
      }

      toast.success('System Administrator authenticated', 'Admin Clearance Granted');
      const destination = sessionStorage.getItem('cropfit_admin_redirect') || '/admin';
      sessionStorage.removeItem('cropfit_admin_redirect');
      router.push(destination);
    } catch {
      toast.error('Could not authenticate administrator credentials.', 'Login Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background purple glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-600/25 mb-1">
            <ShieldIcon size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CropFit Admin Console
          </h1>
          <p className="text-xs text-slate-500">
            Restricted administrative portal for system administrators & engineers
          </p>
        </div>

        {/* Auth Box */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
              <AlertTriangleIcon size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cropfit.io"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Admin Password
                </label>
              </div>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Authenticating Admin...' : 'Enter Admin Console'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/login"
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
          >
            <span>Switch to Standard Greenhouse Login</span>
            <ChevronRightIcon size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
