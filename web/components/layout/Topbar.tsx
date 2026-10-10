// ============================================================
// CropFit — Top Bar
// Greeting + greenhouse selector + GreenNode quick status
// Shown at the top of the main content area
// ============================================================

'use client';

import React from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { RefreshIcon, WifiIcon, WifiOffIcon } from '@/components/icons';
import type { Greenhouse } from '@/types';
import type { GreenNode } from '@/lib/api-functions';
import { HubStatus } from '@/components/hub-status';

interface TopbarProps {
  greenhouses?: Greenhouse[];
  selectedGreenhouseId?: number | null;
  onSelectGreenhouse?: (id: number) => void;
  onRefresh?: () => void;
  hubOnline?: boolean;
  hubId?: string;
  lastSyncLabel?: string;
  nodes?: GreenNode[];
  nodesLoading?: boolean;
  nodesError?: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Topbar({
  greenhouses = [],
  selectedGreenhouseId,
  onSelectGreenhouse,
  onRefresh,
  hubOnline = false,
  hubId,
  lastSyncLabel,
  nodes, nodesLoading, nodesError,
}: TopbarProps) {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 lg:px-8 py-4">
        {/* Left: Greeting + Greenhouse Name */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {getGreeting()}, {user?.first_name || 'Farmer'}
          </h1>

          {/* Greenhouse selector or single greenhouse label */}
          {greenhouses.length > 1 && onSelectGreenhouse ? (
            <div className="flex items-center gap-2 mt-1">
              <select
                value={selectedGreenhouseId ?? ''}
                onChange={(e) => onSelectGreenhouse(Number(e.target.value))}
                className="text-sm text-slate-600 bg-transparent border-none focus:ring-0 p-0 cursor-pointer font-medium hover:text-emerald-700 transition-colors"
                aria-label="Select greenhouse"
              >
                {greenhouses.map((gh) => (
                  <option key={gh.id} value={gh.id}>
                    {gh.name}
                  </option>
                ))}
              </select>
            </div>
          ) : greenhouses.length === 1 ? (
            <p className="text-sm text-slate-500 mt-0.5">
              {greenhouses[0].name}
              {greenhouses[0].crop && (
                <span className="text-slate-400"> · {greenhouses[0].crop}</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-400 mt-0.5">No greenhouse selected</p>
          )}
        </div>

        {/* Right: Hub status + Refresh */}
        <div className="flex items-center gap-3 shrink-0">
          {/* GreenNode quick status */}
          {nodes && <HubStatus nodes={nodes} loading={nodesLoading} error={nodesError} />}
          {!nodes && hubId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
              {hubOnline ? (
                <WifiIcon size={14} className="text-emerald-500" />
              ) : (
                <WifiOffIcon size={14} className="text-slate-400" />
              )}
              <div className="text-[11px]">
                <span className="font-medium text-slate-700">GreenNode</span>
                <span className="text-slate-400 ml-1 font-mono">{hubId}</span>
              </div>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hubOnline ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                aria-label={hubOnline ? 'Online' : 'Offline'}
              />
            </div>
          )}

          {/* Last sync label */}
          {lastSyncLabel && (
            <span className="text-[11px] text-slate-400 hidden lg:block">
              Last sync: {lastSyncLabel}
            </span>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
              aria-label="Refresh data"
              title="Refresh data"
            >
              <RefreshIcon size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
