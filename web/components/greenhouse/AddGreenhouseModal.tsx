'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/store/toast-store';
import { Button, IconButton } from '@/components/ui';
import { CloseIcon, SproutIcon } from '@/components/icons';
import type { Greenhouse } from '@/types';

interface AddGreenhouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (greenhouse: Greenhouse) => void;
}

export function AddGreenhouseModal({
  isOpen,
  onClose,
  onSaved,
}: AddGreenhouseModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);

    const body = {
      name: String(values.get('name')).trim(),
      location: String(values.get('location')).trim(),
      crop: String(values.get('crop')).trim(),
      plantation_date: values.get('plantation_date') || null,
    };

    setBusy(true);
    setError(null);

    try {
      const saved = await apiFetch.post<Greenhouse>('/greenhouses/', body);
      toast.success('Greenhouse created successfully!');
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create greenhouse.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <SproutIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Add Greenhouse</h3>
              <p className="text-xs text-slate-500">Configure a new protected cultivation area</p>
            </div>
          </div>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
            <CloseIcon size={18} />
          </IconButton>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Greenhouse Name *
            </label>
            <input
              name="name"
              required
              maxLength={100}
              placeholder="e.g. Tomato Greenhouse Alpha"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-emerald-600 focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Crop *
              </label>
              <input
                name="crop"
                required
                maxLength={50}
                placeholder="e.g. Tomato, Bell Pepper, Berry"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-emerald-600 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location / Sector *
              </label>
              <input
                name="location"
                required
                maxLength={100}
                placeholder="e.g. Sector B, North Wing"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-emerald-600 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Plantation Date
            </label>
            <input
              type="date"
              name="plantation_date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-emerald-600 focus:bg-white transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Create Greenhouse
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
