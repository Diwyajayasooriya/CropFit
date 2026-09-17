// ============================================================
// CropFit — Protected Admin Console (`/admin`) (Light / White Theme)
// Multi-greenhouse monitoring, user role management, edge firmware OTA,
// and broker telemetry in a clean, modern white theme.
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import {
  ShieldIcon,
  ChevronRightIcon,
  CheckCircleIcon,
} from '@/components/icons';

interface SystemUser {
  id: number;
  name: string;
  email: string;
  role: 'farmer' | 'technician' | 'admin';
  status: 'active' | 'suspended';
  lastActive: string;
}

const initialUsers: SystemUser[] = [
  { id: 1, name: 'Dulaj Jayasooriya', email: 'farmer@cropfit.io', role: 'farmer', status: 'active', lastActive: '5m ago' },
  { id: 2, name: 'Kasun Perera', email: 'tech@cropfit.io', role: 'technician', status: 'active', lastActive: '12m ago' },
  { id: 3, name: 'Saman Silva', email: 'admin@cropfit.io', role: 'admin', status: 'active', lastActive: 'Now' },
];

export default function AdminPage() {
  const { user, logout } = useAuthStore();
  const [users, setUsers] = useState(initialUsers);

  const handleUpdateRole = (id: number, newRole: 'farmer' | 'technician' | 'admin') => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
    toast.success(`User role updated to ${newRole.toUpperCase()}`, 'Permission Granted');
  };

  const handleTriggerOTA = (hubName: string) => {
    toast.info(`OTA firmware push initiated for ${hubName}...`, 'Firmware Update');
    setTimeout(() => {
      toast.success(`${hubName} updated to EdgeOS v1.2.1`, 'OTA Completed');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 space-y-8">
      {/* Top Admin Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shadow-xs">
            <ShieldIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                CropFit Administrator Console
              </h1>
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Protected Route
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Authenticated Admin: <strong className="text-slate-800">{user?.email}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>Open Greenhouse Terminal</span>
            <ChevronRightIcon size={14} />
          </Link>

          <button
            onClick={logout}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* System Status Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Orchestrated Edge Hubs</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">3</span>
            <span className="text-xs text-emerald-600 font-semibold">100% Online</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">Zone A, Zone B, Zone C</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Active Edge Nodes</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">16</span>
            <span className="text-xs text-slate-500">Sensors & Relays</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">MQTT + Zigbee + BLE</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Telemetry Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">48/sec</span>
            <span className="text-xs text-emerald-600">0 dropped</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">Buffered locally on-premise</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Security Clearance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-700">Root / Admin</span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">JWT Tokens with DRF SimpleJWT</p>
        </div>
      </div>

      {/* User Role Management Panel */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              System Access Control & User Roles
            </h2>
            <p className="text-xs text-slate-500">
              Manage accounts and granular permissions (Farmer / Technician / Admin)
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {users.length} Registered Accounts
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {users.map((u) => (
            <div
              key={u.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-slate-50/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900">{u.name}</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-[11px] text-slate-500">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500">Role:</span>
                <select
                  value={u.role}
                  onChange={(e) =>
                    handleUpdateRole(u.id, e.target.value as 'farmer' | 'technician' | 'admin')
                  }
                  className="bg-slate-50 border border-slate-300 text-xs text-slate-900 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="farmer">Farmer</option>
                  <option value="technician">Technician</option>
                  <option value="admin">Administrator</option>
                </select>
                <span className="text-[11px] text-slate-400 min-w-[60px] text-right">
                  {u.lastActive}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Firmware Over-The-Air (OTA) Updates */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Edge Gateway Fleet & Firmware OTA
          </h2>
          <p className="text-xs text-slate-500">
            Push software updates directly to on-premise ESP32 and Raspberry Pi gateways
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-900">Greenhouse A — Main Hub</h3>
              <p className="text-[11px] text-slate-500">Current: EdgeOS v1.2.0 • Target: v1.2.1</p>
            </div>
            <button
              onClick={() => handleTriggerOTA('Greenhouse A Main Hub')}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Push OTA Update
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-900">Greenhouse B — Tunnel Hub</h3>
              <p className="text-[11px] text-slate-500">Current: EdgeOS v1.2.0 • Up to date</p>
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircleIcon size={12} />
              <span>Synced</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
