// ============================================================
// CropFit — Toast Notification Store
// Global toast state with auto-dismiss
// ============================================================

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      ...toast,
      id,
      duration: toast.duration ?? 4000,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Convenience helper functions
export const toast = {
  success: (message: string, title?: string) =>
    useToastStore.getState().showToast({ type: 'success', message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().showToast({ type: 'error', message, title }),
  warning: (message: string, title?: string) =>
    useToastStore.getState().showToast({ type: 'warning', message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().showToast({ type: 'info', message, title }),
};
