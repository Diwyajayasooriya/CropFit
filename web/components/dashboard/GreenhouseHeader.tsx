'use client';

import React from 'react';
import type { Greenhouse, DashboardSummary } from '@/types';
import type { GreenNode } from '@/lib/api-functions';
import { useAuthStore } from '@/lib/store/auth-store';
import { StatusBadge, Card } from '@/components/ui';
import { RefreshIcon, WifiIcon, SproutIcon, CheckCircleIcon, AlertTriangleIcon } from '@/components/icons';
import { timeAgo } from '@/lib/utils';

interface GreenhouseHeaderProps {
  greenhouse: Greenhouse;
  greenhouses: Greenhouse[];
  selectedGreenhouseId: number;
  onSelectGreenhouse: (id: number) => void;
  summary?: DashboardSummary | null;
  nodes: GreenNode[];
  onRefresh?: () => void;
  refreshing?: boolean;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function GreenhouseHeader({
  greenhouse,
  greenhouses,
  selectedGreenhouseId,
  onSelectGreenhouse,
  summary,
  nodes,
  onRefresh,
  refreshing = false,
}: GreenhouseHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const farmerName = user?.first_name || 'Nimal';

  // Primary hub info
  const primaryNode = nodes[0];
  const hubId = primaryNode?.node_id || 'GN-HUB-C554';
  const hubOnline = primaryNode ? primaryNode.is_online : true;
  const lastSyncText = primaryNode?.last_seen ? timeAgo(primaryNode.last_seen) : '8 seconds ago';

  const healthStatus = summary?.overall_status || 'healthy';
  const healthBadgeStatus = healthStatus === 'healthy' ? 'healthy' : healthStatus === 'warning' ? 'warning' : 'critical';

  return (
    <div className="space-y-6">
      {/* ── Top Bar / Greeting & Selectors ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()}, {farmerName}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Here&apos;s how your greenhouse is doing today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Greenhouse dropdown */}
          {greenhouses.length > 0 && (
            <div className="relative">
              <select
                value={selectedGreenhouseId}
                onChange={(e) => onSelectGreenhouse(Number(e.target.value))}
                className="bg-white border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-4 py-2.5 pr-9 shadow-xs hover:border-slate-300 focus:outline-emerald-600 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none transition-colors"
                aria-label="Select greenhouse"
              >
                {greenhouses.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.crop})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:border-slate-300 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              title="Refresh greenhouse telemetry"
              aria-label="Refresh"
            >
              <RefreshIcon size={18} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* ── Large Greenhouse Hero Header Card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Greenhouse Identity Card (2 Cols on lg) */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 shadow-md">
          {/* Subtle nature SVG pattern in background */}
          <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none">
            <SproutIcon size={280} />
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold tracking-wide text-emerald-50 border border-white/20">
                <SproutIcon size={14} />
                {greenhouse.crop || 'Tomato'}
              </span>

              <div className="flex items-center gap-2">
                <StatusBadge status={hubOnline ? 'online' : 'offline'} className="bg-white/20 text-white border-white/30 backdrop-blur-md" />
                <span className="text-xs text-emerald-100/80">
                  Last sync: {lastSyncText}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
                {greenhouse.name}
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs sm:text-sm text-emerald-100 font-medium">
                <span className="flex items-center gap-1.5 font-mono">
                  <WifiIcon size={14} className="text-emerald-300" />
                  GreenNode {hubId}
                </span>
                {greenhouse.location && (
                  <>
                    <span>•</span>
                    <span>{greenhouse.location}</span>
                  </>
                )}
                {greenhouse.plantation_date && (
                  <>
                    <span>•</span>
                    <span>Planted {greenhouse.plantation_date}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Greenhouse Health Card (1 Col on lg) */}
        <Card className="flex flex-col justify-between p-6 sm:p-7 border-slate-200/90 shadow-xs bg-linear-to-b from-white to-slate-50/50">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Greenhouse Health
              </span>
              <StatusBadge status={healthBadgeStatus} showDot />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                healthStatus === 'healthy' ? 'bg-emerald-50 text-emerald-600' :
                healthStatus === 'warning' ? 'bg-amber-50 text-amber-600' :
                'bg-rose-50 text-rose-600'
              }`}>
                {healthStatus === 'healthy' ? (
                  <CheckCircleIcon size={26} />
                ) : (
                  <AlertTriangleIcon size={26} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 capitalize">
                  {healthStatus === 'healthy' ? 'Good Condition' : healthStatus === 'warning' ? 'Needs Attention' : 'Critical Condition'}
                </h3>
                <p className="text-xs text-slate-500">
                  Automated telemetry evaluation
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
              {summary?.message || 'All primary climate parameters and soil measurements are within optimal target bounds.'}
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Edge node active</span>
            <span className="font-medium text-emerald-600">{nodes.length} hub linked</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
