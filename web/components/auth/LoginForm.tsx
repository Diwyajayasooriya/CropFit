'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import { AuthInput } from './AuthInput';
import { PasswordInput } from './PasswordInput';
import { LoadingButton } from './LoadingButton';
import { FormError } from './FormError';
import { MailIcon, ChevronRightIcon, CloseIcon, ShieldIcon, DevicesIcon } from '@/components/icons';

const REMEMBER_KEY = 'cropfit_remember_email';

export function LoginForm() {
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Help & Registration Modals
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Restore remembered email on initial load
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBER_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore storage access issues
    }
  }, []);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    const trimmedIdentifier = email.trim();
    if (!trimmedIdentifier) {
      errors.email = 'Please enter your email or username.';
    } else if (trimmedIdentifier.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedIdentifier)) {
        errors.email = 'Please enter a valid email address.';
      }
    } else if (trimmedIdentifier.length < 3) {
      errors.email = 'Username must be at least 3 characters long.';
    }

    if (!password) {
      errors.password = 'Please enter your password.';
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
      toast.error('Please check your login details and try again.', 'Validation Error');
      return;
    }

    setSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      await login({ email: trimmedEmail, password });

      // Handle remember me persistence
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, trimmedEmail);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // Ignore storage exceptions
      }

      toast.success('Authenticated with CropFit Hub', 'Welcome back');
      // AuthGuard automatically routes the user:
      // Preserves pending redirects, onboarding state, or greenhouse/GreenNode claim setup!
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : '';
      let friendlyMessage = 'Email or password is incorrect.';
      if (
        rawMessage.toLowerCase().includes('fetch') ||
        rawMessage.toLowerCase().includes('network') ||
        rawMessage.toLowerCase().includes('unavailable') ||
        rawMessage.toLowerCase().includes('failed to connect')
      ) {
        friendlyMessage = 'Unable to connect to CropFit. Please try again.';
      }

      toast.error(friendlyMessage, 'Authentication Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Login Card Container */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl shadow-slate-200/50 transition-all">
        {/* Card Header */}
        <div className="mb-6 space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Sign in to manage your greenhouses, devices and automation.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-5">
            <FormError message={error} onDismiss={clearError} />
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email / Username Field */}
          <AuthInput
            id="email"
            name="email"
            label="Email or username"
            type="text"
            autoComplete="username"
            value={email}
            disabled={submitting || isLoading}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            placeholder="farmer@greenhouse.com or username"
            icon={<MailIcon size={18} />}
            error={fieldErrors.email}
            required
          />

          {/* Password Field with Show/Hide toggle */}
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            value={password}
            disabled={submitting || isLoading}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="Enter your password"
            error={fieldErrors.password}
            required
          />

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={submitting || isLoading}
                className="w-4 h-4 rounded-md border-slate-300 text-emerald-700 focus:ring-2 focus:ring-emerald-600/30 accent-emerald-700 transition-colors cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                Remember me
              </span>
            </label>

            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/20 rounded px-1"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <LoadingButton
              type="submit"
              isLoading={submitting || isLoading}
              loadingText="Signing in…"
              icon={<ChevronRightIcon size={16} />}
            >
              Sign In
            </LoadingButton>
          </div>
        </form>

        {/* Footer Link: Create Account */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            New to CropFit?{' '}
            <button
              type="button"
              onClick={() => setShowRegisterModal(true)}
              className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/20 rounded px-1"
            >
              Create account
            </button>
          </p>
        </div>
      </div>

      {/* Auxiliary Sub-Card Guidance: Device Pairing */}
      <div className="mt-4 text-center">
        <p className="text-[11px] text-slate-400">
          Setting up new edge hardware? Visit{' '}
          <Link
            href="/claim"
            className="text-emerald-700 hover:text-emerald-800 hover:underline font-medium"
          >
            Claim GreenNode Hub
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ShieldIcon size={20} />
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div>
              <h3 id="forgot-modal-title" className="text-base font-bold text-slate-900">
                Password Recovery
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                For farm security and edge-mesh isolation, passwords are reset by your Greenhouse System Administrator or via the local GreenNode edge portal.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Support Steps:</div>
              <div>1. Contact your greenhouse operations manager.</div>
              <div>2. Verify your node ID on the hardware label.</div>
              <div>3. Admins can reset credentials from the Admin Console.</div>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showRegisterModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200/90 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <DevicesIcon size={20} />
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                aria-label="Close dialog"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div>
              <h3 id="register-modal-title" className="text-base font-bold text-slate-900">
                Join CropFit
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Accounts are provisioned when you link a new GreenNode hardware controller or are invited by a greenhouse farm manager.
              </p>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-emerald-900 space-y-1.5">
              <div className="font-semibold text-emerald-950">Have a GreenNode Hub?</div>
              <p className="text-emerald-800 leading-normal">
                If you recently purchased or deployed a hub, you can link it directly to initialize your farm profile.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Link
                href="/claim"
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs text-center transition-colors shadow-xs"
              >
                Claim GreenNode
              </Link>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
