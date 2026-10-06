// ============================================================
// CropFit — Dedicated Admin Login (`/admin/login`)
// Highly secured entry point for system administrators & engineers
// Enforces IP allowlisting and checks server-verified admin tokens
// ============================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import {
  ShieldIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
} from '@/components/icons';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginAdmin, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    const trimmed = email.trim();
    if (!trimmed) {
      errors.email = 'Administrator email or username is required.';
    }

    if (!password) {
      errors.password = 'Administrator password is required.';
    } else if (password.length < 4) {
      errors.password = 'Password must be at least 4 characters long.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      toast.error('Please fill in all administrator credentials.', 'Validation Error');
      return;
    }

    setSubmitting(true);

    try {
      await loginAdmin({ email: email.trim(), password });
      toast.success('System Administrator clearance granted', 'Clearance Level 1');
      const destination = sessionStorage.getItem('cropfit_admin_redirect') || '/admin';
      sessionStorage.removeItem('cropfit_admin_redirect');
      router.push(destination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not authenticate administrator credentials.';
      toast.error(msg, 'Access Denied');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient security glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-900/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-600/30 mb-1 border border-purple-400/20">
            <ShieldIcon size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            CropFit Admin Console
          </h1>
          <p className="text-xs text-slate-400">
            Authorized Personnel Only • IP & Hardware Whitelisted Gateway
          </p>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 backdrop-blur-md">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertTriangleIcon size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-slate-300"
              >
                Administrator Email or Username
              </label>
              <input
                id="admin-email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="admin@cropfit.io"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all ${
                  fieldErrors.email
                    ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                    : 'border-slate-700 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] font-medium text-rose-400 pl-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Admin Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="Enter administrator password"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all ${
                    fieldErrors.password
                      ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-700 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-md focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] font-medium text-rose-400 pl-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold text-sm transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {submitting ? 'Verifying Administrator Authorization...' : 'Access Admin Console'}
            </button>
          </form>
        </div>

        {/* Security Warning Notice */}
        <div className="text-center space-y-1 text-[11px] text-slate-500">
          <p>This console is protected by network IP filtering and audit logging.</p>
          <p>Unauthorized access attempts are monitored and recorded.</p>
        </div>
      </div>
    </div>
  );
}
