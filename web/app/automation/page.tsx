// ============================================================
// CropFit — Automation Overview Page
// Farmer-friendly view of automatic controls with simple
// descriptions. Links to detailed rules for technicians/admins.
// ============================================================

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { list } from '@/lib/api-functions';
import { toast } from '@/lib/store/toast-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { Topbar } from '@/components/layout/Topbar';
import { LightningIcon, ChevronRightIcon, SettingsIcon } from '@/components/icons';

interface RuleSummary {
  id: string;
  rule_id?: string;
  name: string;
  is_active: boolean;
  sensor_device_id?: string;
  actuator_device_id?: string;
  field?: string;
  condition?: string;
  threshold?: number;
  command_payload?: Record<string, string>;
}

// Map rule data into farmer-friendly descriptions
function describeRule(rule: RuleSummary): string {
  if (rule.field && rule.condition && rule.threshold != null) {
    const fieldLabels: Record<string, string> = {
      temperature: 'temperature',
      humidity: 'humidity',
      soil_moisture: 'soil moisture',
    };
    const condLabels: Record<string, string> = {
      above: 'rises above the threshold',
      below: 'falls below the threshold',
      equals: 'equals the target',
      gt: 'becomes too high',
      gte: 'becomes too high',
      lt: 'becomes too low',
      lte: 'becomes too low',
    };
    const field = fieldLabels[rule.field] || rule.field;
    const cond = condLabels[rule.condition] || rule.condition;
    return `Activates when ${field} ${cond} (${rule.threshold}).`;
  }
  return 'Automated control managed by CropFit.';
}

export default function AutomationPage() {
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin';

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await list<RuleSummary>('/rules/');
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rules.");
      console.error('Failed to fetch rules:', err);
      toast.error('Could not load automation settings.', 'Error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchRules); }, [fetchRules]);

  return (
    <div className="animate-page-in">
      <Topbar onRefresh={fetchRules} />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Automation
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              CropFit automatically controls your greenhouse equipment based on sensor readings.
            </p>
          </div>
          {canManage && (
            <Link
              href="/automation/rules"
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <SettingsIcon size={16} />
              <span className="hidden sm:inline">Manage Rules</span>
            </Link>
          )}
        </div>

        {error && <p role="alert" className="text-rose-700">{error} <button onClick={fetchRules} className="underline">Try again</button></p>}
        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
              <LightningIcon size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              No automation rules configured
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Automation rules allow CropFit to control fans, pumps, and other
              devices automatically based on greenhouse conditions.
            </p>
            {canManage && (
              <Link
                href="/automation/rules"
                className="mt-4 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
              >
                View Rules
              </Link>
            )}
          </div>
        )}

        {/* Automation Cards */}
        {!isLoading && !error && rules.length > 0 && (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 flex items-center gap-4"
              >
                {/* Status indicator */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    rule.is_active
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <LightningIcon size={20} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                      {rule.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        rule.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {rule.is_active ? 'AUTO' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {describeRule(rule)}
                  </p>
                </div>

                {/* Arrow for manage access */}
                {canManage && (
                  <Link
                    href="/automation/rules"
                    className="p-2 rounded-lg text-slate-300 hover:text-emerald-500 transition-colors"
                    aria-label="Configure rule"
                  >
                    <ChevronRightIcon size={16} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
