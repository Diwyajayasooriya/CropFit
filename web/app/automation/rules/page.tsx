// ============================================================
// CropFit — Automation Rules Management (`/automation/rules`)
// Detailed rules view with toggle controls and condition info.
// Farmers see read-only; technicians/admins can toggle/edit.
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { list } from '@/lib/api-functions';
import { toast } from '@/lib/store/toast-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { Topbar } from '@/components/layout/Topbar';
import { ChevronLeftIcon, LightningIcon } from '@/components/icons';

interface Rule {
  id: string;
  rule_id?: string;
  name: string;
  sensor_device_id?: string;
  field?: string;
  condition?: string;
  threshold?: number;
  actuator_device_id?: string;
  command_payload?: Record<string, string>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

function conditionLabel(cond: string | undefined): string {
  const map: Record<string, string> = {
    above: '>',
    below: '<',
    equals: '=',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    eq: '=',
  };
  return map[cond || ''] || cond || '?';
}

function fieldLabel(field: string | undefined): string {
  const map: Record<string, string> = {
    temperature: 'Temperature',
    humidity: 'Humidity',
    soil_moisture: 'Soil Moisture',
  };
  return map[field || ''] || field || 'Sensor';
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin';

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await list<Rule>('/rules/');
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rules.");
      console.error('Failed to fetch rules:', err);
      toast.error('Could not load automation rules.', 'Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchRules); }, [fetchRules]);

  const toggleRule = async (id: string, name: string, currentStatus: boolean) => {
    if (!canManage) {
      toast.error('Only administrators can modify automation rules.', 'Access Denied');
      return;
    }

    try {
      const next = !currentStatus;
      await apiFetch.patch(`/rules/${id}/`, { is_active: next });

      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: next } : r))
      );

      if (next) {
        toast.success(`"${name}" is now active. CropFit will apply this rule automatically.`, 'Rule Enabled');
      } else {
        toast.warning(`"${name}" has been paused. CropFit will not apply this rule.`, 'Rule Disabled');
      }
    } catch {
      toast.error(`Could not update "${name}".`, 'Error');
    }
  };

  return (
    <div className="animate-page-in">
      <Topbar onRefresh={fetchRules} />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumb + Header */}
        <div>
          <Link
            href="/automation"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-600 transition-colors mb-2"
          >
            <ChevronLeftIcon size={14} />
            Automation
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Automation Rules
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {canManage
                  ? 'Configure conditions and actions for automated greenhouse control.'
                  : 'View the automation rules managing your greenhouse.'}
              </p>
            </div>
          </div>
        </div>

        {error && <p role="alert" className="text-rose-700">{error} <button onClick={fetchRules} className="underline">Try again</button></p>}
        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
              <LightningIcon size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              No automation rules yet
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Rules allow CropFit to automatically respond to environmental changes
              in your greenhouse.
            </p>
          </div>
        )}

        {/* Rules List */}
        {!isLoading && !error && rules.length > 0 && (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-5 rounded-2xl border bg-white transition-all ${
                  rule.is_active
                    ? 'border-slate-200 hover:border-slate-300 shadow-xs'
                    : 'border-slate-200/80 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Title + Badge */}
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {rule.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                          rule.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {rule.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    {/* Condition description */}
                    {rule.field && rule.condition && rule.threshold != null && (
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">IF</span>{' '}
                        {fieldLabel(rule.field)}{' '}
                        {conditionLabel(rule.condition)}{' '}
                        {rule.threshold}
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-medium">THEN</span>{' '}
                        {rule.actuator_device_id || 'device'}{' '}
                        {rule.command_payload?.action || 'activates'}
                      </p>
                    )}
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-4 shrink-0">
                    <button
                      onClick={() => toggleRule(rule.id, rule.name, rule.is_active)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                        rule.is_active ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                      } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label={`Toggle rule: ${rule.name}`}
                      disabled={!canManage}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
