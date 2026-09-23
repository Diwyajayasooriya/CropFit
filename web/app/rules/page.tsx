// ============================================================
// CropFit — Rules Engine View (`rules` app) (Light / White Theme)
// Plain-language greenhouse automation rules with toggle controls
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/store/toast-store';

interface Rule {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  last_triggered?: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch.get<Rule[]>('/rules/');
      setRules(data);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      toast.error('Could not load automation rules.', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRule = async (id: string, name: string, currentStatus: boolean) => {
    try {
      const next = !currentStatus;
      await apiFetch.patch(`/rules/${id}/`, { is_active: next });
      
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: next } : r))
      );

      if (next) {
        toast.success(`Rule "${name}" enabled on Edge Gateway`, 'Rule Activated');
      } else {
        toast.warning(`Rule "${name}" disabled. Automation paused.`, 'Rule Deactivated');
      }
    } catch (err) {
      toast.error(`Failed to update rule "${name}"`, 'Error');
    }
  };

  const handleCreateRule = () => {
    toast.info('Rule creator wizard will be available in Phase 5', 'Create Rule');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Rules & Automation Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Local edge rules evaluate in &lt;10ms directly on the Greenhouse Hub
          </p>
        </div>

        <button
          onClick={handleCreateRule}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
        >
          <span>+ Create Automation Rule</span>
        </button>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`p-5 sm:p-6 rounded-2xl border transition-all bg-white shadow-xs ${
              rule.is_active
                ? 'border-slate-200 hover:border-slate-300'
                : 'border-slate-200/80 opacity-60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {rule.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      rule.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {rule.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-xl">
                  {rule.description}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {rule.last_triggered && (
                  <span className="text-[11px] text-slate-400 hidden md:inline">
                    Last triggered: 2h ago
                  </span>
                )}
                <button
                  onClick={() => toggleRule(rule.id, rule.name, rule.is_active)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                    rule.is_active ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                  aria-label="Toggle rule"
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
