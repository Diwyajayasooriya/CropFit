'use client';

import React from 'react';
import { AlertTriangleIcon, CloseIcon } from '@/components/icons';

export interface FormErrorProps {
  message?: string | null;
  onDismiss?: () => void;
  className?: string;
}

export function FormError({ message, onDismiss, className = '' }: FormErrorProps) {
  if (!message) return null;

  // Normalize friendly message if server gave raw or technical errors
  const normalizedMessage = (() => {
    const lower = message.toLowerCase();
    if (
      lower.includes('failed to fetch') ||
      lower.includes('network') ||
      lower.includes('econnrefused') ||
      lower.includes('server unavailable') ||
      lower.includes('unable to connect')
    ) {
      return 'Unable to connect to CropFit. Please check your network and try again.';
    }
    if (
      lower.includes('invalid credentials') ||
      lower.includes('no active account') ||
      lower.includes('authentication failed') ||
      lower.includes('bad credentials')
    ) {
      return 'Email or password is incorrect. Please verify your credentials.';
    }
    return message;
  })();

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`p-3.5 rounded-xl bg-rose-50/90 border border-rose-200/90 text-rose-800 flex items-start justify-between gap-3 text-xs leading-relaxed transition-all shadow-xs animate-in fade-in slide-in-from-top-1 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon size={16} className="text-rose-600 shrink-0 mt-0.5" />
        <span className="font-medium">{normalizedMessage}</span>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="text-rose-500 hover:text-rose-700 p-0.5 rounded hover:bg-rose-100/60 transition-colors shrink-0"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}
