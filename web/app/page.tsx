// ============================================================
// CropFit — Dashboard Home View (Light / White Theme)
// Features live environmental tiles, actuator toggle actions,
// and plain-language decision summary.
// ============================================================

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useDashboardStore } from '@/lib/store/dashboard-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import { DashboardSkeleton } from '@/components/skeletons';
import {
  DevicesIcon,
  RulesIcon,
  BellIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from '@/components/icons';

export default function DashboardPage() {
  const { summary, isLoading, fetchDashboard, updateActuator } = useDashboardStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleToggleActuator = (id: string, name: string, currentState: boolean) => {
    const nextState = !currentState;
    updateActuator(id, nextState);
    if (nextState) {
      toast.success(`${name} engaged manually. Edge relay activated.`, 'Actuator Triggered');
    } else {
      toast.info(`${name} turned off manually.`, 'Actuator Disengaged');
    }
  };

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Greenhouse Overview</h2>
            <p className="text-xs text-slate-500">Retrieving real-time telemetry from edge hub...</p>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const sensorKindColors: Record<string, { bg: string; text: string; ring: string }> = {
    temperature: { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'border-amber-200' },
    humidity: { bg: 'bg-sky-50', text: 'text-sky-800', ring: 'border-sky-200' },
    soil_moisture: { bg: 'bg-emerald-50', text: 'text-emerald-800', ring: 'border-emerald-200' },
    light: { bg: 'bg-yellow-50', text: 'text-yellow-800', ring: 'border-yellow-200' },
    co2: { bg: 'bg-purple-50', text: 'text-purple-800', ring: 'border-purple-200' },
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Header with greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Welcome back, {user?.first_name || 'Operator'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Greenhouse Zone A • Connected via ESP32 Edge Gateway
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchDashboard();
              toast.info('Telemetry data refreshed from local edge cache', 'Refreshed');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            Refresh Readings
          </button>
        </div>
      </div>

      {/* Decision Summary Banner */}
      <div className="p-5 sm:p-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
            <CheckCircleIcon size={22} />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Automated Decision Status
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-slate-900">
              {summary.message}
            </p>
          </div>
        </div>

        <Link
          href="/rules"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 px-3.5 py-1.5 rounded-lg bg-emerald-100/70 border border-emerald-300/60 shrink-0 transition-colors"
        >
          <span>View Active Rules</span>
          <ChevronRightIcon size={14} />
        </Link>
      </div>

      {/* Live Environmental Sensor Tiles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Real-Time Sensors ({summary.tiles.length})
          </h3>
          <Link
            href="/devices"
            className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
          >
            <span>Manage devices</span>
            <ChevronRightIcon size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
          {summary.tiles.map((tile) => {
            const colors = sensorKindColors[tile.sensor_kind] || {
              bg: 'bg-slate-50',
              text: 'text-slate-800',
              ring: 'border-slate-200',
            };

            const isOffline = tile.status === 'offline';

            return (
              <div
                key={tile.sensor_id}
                className={`p-4 sm:p-5 rounded-2xl border bg-white transition-all hover:shadow-md ${
                  isOffline
                    ? 'border-slate-200 opacity-60'
                    : `border-slate-200 hover:${colors.ring}`
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 truncate max-w-[120px]">
                    {tile.sensor_name.replace(' Sensor A1', '')}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      isOffline
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {tile.status}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    {tile.value}
                  </span>
                  <span className="text-sm font-semibold text-slate-500">
                    {tile.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5 mt-2">
                  <span className="capitalize">{tile.sensor_kind.replace('_', ' ')}</span>
                  <span>Live telemetry</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Actuator Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Actuator Controls & Relays
            </h3>
            <p className="text-xs text-slate-500">
              Direct edge hardware override with real-time feedback
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summary.actuators.map((act) => (
            <div
              key={act.actuator_id}
              className="p-5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-4 transition-all hover:border-slate-300 shadow-xs"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {act.name}
                  </h4>
                  {act.auto_mode && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium">
                      Auto
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 capitalize">
                  {act.actuator_kind} • {act.is_active ? 'Currently Running' : 'Idle'}
                </p>
              </div>

              <button
                onClick={() => handleToggleActuator(act.actuator_id, act.name, act.is_active)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                  act.is_active
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {act.is_active ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Roadmap Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <Link
          href="/devices"
          className="p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all group flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-sky-200">
              <DevicesIcon size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Device Registry</h4>
              <p className="text-xs text-slate-500">6 Connected Nodes</p>
            </div>
          </div>
          <ChevronRightIcon size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/rules"
          className="p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all group flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-amber-200">
              <RulesIcon size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Rules Engine</h4>
              <p className="text-xs text-slate-500">Transparent Automation</p>
            </div>
          </div>
          <ChevronRightIcon size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/alerts"
          className="p-5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-all group flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-rose-200">
              <BellIcon size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Alerts Inbox</h4>
              <p className="text-xs text-slate-500">2 Unread Notifications</p>
            </div>
          </div>
          <ChevronRightIcon size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
