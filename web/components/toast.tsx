// ============================================================
// CropFit — Toast Notification Container (Light / White Theme)
// Renders active toasts with crisp white cards, colored icons & manual dismiss
// ============================================================

'use client';

import React from 'react';
import { useToastStore, type ToastType } from '@/lib/store/toast-store';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  CloseIcon,
} from './icons';

const toastStyles: Record<ToastType, { border: string; icon: React.ReactNode; text: string }> = {
  success: {
    border: 'border-emerald-300',
    icon: <CheckCircleIcon className="text-emerald-600 shrink-0" size={18} />,
    text: 'text-slate-600',
  },
  error: {
    border: 'border-rose-300',
    icon: <AlertTriangleIcon className="text-rose-600 shrink-0" size={18} />,
    text: 'text-slate-600',
  },
  warning: {
    border: 'border-amber-300',
    icon: <AlertTriangleIcon className="text-amber-600 shrink-0" size={18} />,
    text: 'text-slate-600',
  },
  info: {
    border: 'border-sky-300',
    icon: <InfoIcon className="text-sky-600 shrink-0" size={18} />,
    text: 'text-slate-600',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((item) => {
        const style = toastStyles[item.type] || toastStyles.info;

        return (
          <div
            key={item.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border bg-white shadow-xl shadow-slate-200/80 transition-all animate-in fade-in slide-in-from-bottom-3 ${style.border}`}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              {item.title && (
                <h4 className="text-sm font-semibold text-slate-900 tracking-tight leading-snug">
                  {item.title}
                </h4>
              )}
              <p className={`text-xs mt-0.5 leading-relaxed ${style.text}`}>
                {item.message}
              </p>
            </div>
            <button
              onClick={() => removeToast(item.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Dismiss toast"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
