'use client';

import React from 'react';
import { AlertTriangleIcon } from '@/components/icons';

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function AuthInput({
  label,
  id,
  error,
  icon,
  rightElement,
  className = '',
  disabled,
  required,
  ...props
}: AuthInputProps) {
  const inputId = id || props.name || 'auth-input';
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 tracking-wide"
        >
          {label}
          {required && <span className="text-emerald-700 ml-0.5">*</span>}
        </label>
      </div>

      <div className="relative rounded-xl transition-all">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          required={required}
          className={`w-full py-2.5 sm:py-3 text-sm text-slate-900 bg-slate-50/80 hover:bg-slate-50/60 focus:bg-white rounded-xl border transition-all duration-150 placeholder:text-slate-400 focus:outline-none ${
            icon ? 'pl-10' : 'pl-3.5'
          } ${rightElement ? 'pr-11' : 'pr-3.5'} ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15 bg-rose-50/20'
              : 'border-slate-200/90 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15'
          } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''} ${className}`}
          {...props}
        />

        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-rose-600 pt-0.5 pl-1 animate-in fade-in"
        >
          <AlertTriangleIcon size={13} className="shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
