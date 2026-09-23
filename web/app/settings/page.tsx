// ============================================================
// CropFit — Settings & Edge Configuration View (Light / White Theme)
// Greenhouse site selector, network gateway settings, and user preferences
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const [site, setSite] = useState('zone_a');
  const [offlineSync, setOfflineSync] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Edge configuration updated and persisted locally', 'Settings Saved');
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          System & Gateway Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Configure on-site Edge Hub parameters, site zoning, and user credentials
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Site / Greenhouse Selection */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              Greenhouse Site & Zone
            </h3>
            <p className="text-xs text-slate-500">
              Select which on-premise greenhouse structure this terminal monitors
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                site === 'zone_a'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Zone A — North House</p>
                <p className="text-[11px] text-slate-500">ESP32 Gateway • 6 Connected Nodes</p>
              </div>
              <input
                type="radio"
                name="site"
                checked={site === 'zone_a'}
                onChange={() => setSite('zone_a')}
                className="accent-emerald-600"
              />
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                site === 'zone_b'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Zone B — Propagation Tunnel</p>
                <p className="text-[11px] text-slate-500">Raspberry Pi Gateway • 4 Connected Nodes</p>
              </div>
              <input
                type="radio"
                name="site"
                checked={site === 'zone_b'}
                onChange={() => setSite('zone_b')}
                className="accent-emerald-600"
              />
            </label>
          </div>
        </div>

        {/* Edge Hub Parameters */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              Edge Hub Network
            </h3>
            <p className="text-xs text-slate-500">
              Local telemetry endpoint and broker configuration
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Gateway IP Address
              </label>
              <input
                type="text"
                defaultValue="192.168.1.100"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Local MQTT Port
              </label>
              <input
                type="text"
                defaultValue="1883"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Offline Local Caching
              </p>
              <p className="text-[11px] text-slate-500">
                Queue sensor telemetry in local SQLite if cloud uplink is interrupted
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOfflineSync(!offlineSync)}
              className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                offlineSync ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">
              Current Session Profile
            </h3>
            <p className="text-xs text-slate-500">
              Authenticated identity and assigned role permissions
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <p className="text-xs font-bold text-slate-900">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
              <p className="text-[11px] font-semibold text-emerald-700 capitalize mt-1">
                Assigned Role: {user?.role}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                  ⚡ Open Admin Console
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          Save Configuration
        </button>
      </form>
    </div>
  );
}
