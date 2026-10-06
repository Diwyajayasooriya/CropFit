// ============================================================
// CropFit — Greenhouse Farmer Login (`/login`)
// Production-grade authentication page for farm operators
// Features: Full field validation, show/hide password, zero admin leakage
// ============================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import {
  SproutIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
} from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    const trimmedIdentifier = email.trim();
    if (!trimmedIdentifier) {
      errors.email = 'Please enter your email or username.';
    } else if (trimmedIdentifier.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedIdentifier)) {
        errors.email = 'Please enter a valid email address format.';
      }
    } else if (trimmedIdentifier.length < 3) {
      errors.email = 'Username must be at least 3 characters long.';
    }

    if (!password) {
      errors.password = 'Password is required.';
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
      toast.error('Please fix the errors indicated in the form.', 'Validation Error');
      return;
    }

    setSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      toast.success('Successfully authenticated with Greenhouse Hub', 'Welcome');

      const savedDestination = sessionStorage.getItem('cropfit_redirect');
      if (savedDestination) {
        sessionStorage.removeItem('cropfit_redirect');
        router.push(savedDestination);
      } else {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && !currentUser.onboarding_completed) {
          router.push('/onboarding');
        } else {
          router.push('/');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your credentials.';
      toast.error(msg, 'Authentication Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Soft ambient background glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-1">
            <SproutIcon size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CropFit Greenhouse
          </h1>
          <p className="text-xs text-slate-500">
            Sign in to access your local Edge Gateway & Greenhouse Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertTriangleIcon size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email / Username Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700"
              >
                Farmer Email or Username
              </label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="farmer@cropfit.local or username"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                  fieldErrors.email
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30'
                    : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] font-medium text-rose-600 pl-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password Field with Show/Hide toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="Enter your password"
                  className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50/80 border text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition-all ${
                    fieldErrors.password
                      ? 'border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50/30'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] font-medium text-rose-600 pl-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                />
                <span>Keep session active</span>
              </label>
              <span className="text-slate-400 text-[11px]">
                Secured by Edge JWT
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Verifying Credentials...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>

        {/* Footer info: Clean, farmer-focused (no admin portal leakage) */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-slate-400">
            CropFit Smart Greenhouse System • Offline-Resilient Local Auth
          </p>
          <p className="text-[10px] text-slate-400">
            Need device pairing assistance? Visit <a href="/claim" className="text-emerald-600 hover:underline font-medium">Claim Device</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
