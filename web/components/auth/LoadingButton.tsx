'use client';

import React from 'react';

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}

export function LoadingButton({
  children,
  isLoading = false,
  loadingText = 'Signing in…',
  disabled,
  className = '',
  icon,
  ...props
}: LoadingButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={isLoading}
      className={`w-full py-3 px-4 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2.5 transition-all duration-150 select-none shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-700/20 active:translate-y-px ${
        isDisabled
          ? 'bg-emerald-800/80 cursor-not-allowed opacity-80'
          : 'bg-[#065f46] hover:bg-[#044e3a] active:bg-[#033d2e] shadow-emerald-900/10 cursor-pointer'
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="font-medium tracking-wide">{loadingText}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {icon && <span className="transition-transform group-hover:translate-x-0.5">{icon}</span>}
        </>
      )}
    </button>
  );
}
