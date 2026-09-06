// ============================================================
// CropFit — Device Management View (`devices` app) (Light / White Theme)
// Complete device registry: Hubs, Sensors, and Actuators with
// connectivity status and manual controls.
// ============================================================

'use client';

import React, { useState } from 'react';
import { mockHub, mockSensors, mockActuators } from '@/lib/mock-data';
import { toast } from '@/lib/store/toast-store';
import { DevicesIcon } from '@/components/icons';

export default function DevicesPage() {
  const [filter, setFilter] = useState<'all' | 'sensor' | 'actuator' | 'hub'>('all');
  const [actuators, setActuators] = useState(mockActuators);

  const toggleActuator = (id: string, name: string) => {
    setActuators((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const nextState = !a.is_active;
          if (nextState) {
            toast.success(`${name} activated via edge command`, 'Actuator Engaged');
          } else {
            toast.info(`${name} deactivated`, 'Actuator Stopped');
          }
          return { ...a, is_active: nextState };
        }
        return a;
      })
    );
  };

  const handleAddDevice = () => {
    toast.info('Device onboarding wizard will launch here in Phase 3', 'Add Device');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Device Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Greenhouse Zone A • 1 Edge Hub, 5 Sensors, 3 Actuators
          </p>
        </div>

        <button
          onClick={handleAddDevice}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
        >
          <span>+ Connect New Device</span>
        </button>
      </div>

      {/* Edge Hub Spotlight Card */}
      <div className="p-5 sm:p-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-transparent space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <DevicesIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{mockHub.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/70">
                  Primary Gateway
                </span>
              </div>
              <p className="text-xs text-slate-500">Firmware {mockHub.firmware_version} • Local IP: {mockHub.ip_address}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              6 Nodes Orchestrated
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'sensor', 'actuator', 'hub'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
              filter === f
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f === 'all' ? 'All Devices (9)' : `${f}s`}
          </button>
        ))}
      </div>

      {/* Sensors Grid */}
      {(filter === 'all' || filter === 'sensor') && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Environmental Sensors ({mockSensors.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockSensors.map((s) => {
              const isOffline = s.status === 'offline';
              return (
                <div
                  key={s.id}
                  className={`p-5 rounded-2xl border bg-white transition-all shadow-xs ${
                    isOffline
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {s.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        isOffline
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {s.last_value}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{s.unit}</span>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="uppercase font-semibold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {s.protocol}
                    </span>
                    <span>{s.location}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actuators Grid */}
      {(filter === 'all' || filter === 'actuator') && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Actuators & Controls ({actuators.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {actuators.map((a) => (
              <div
                key={a.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{a.name}</h4>
                    <p className="text-xs text-slate-500 capitalize">{a.actuator_kind} • {a.protocol.toUpperCase()}</p>
                  </div>
                  <button
                    onClick={() => toggleActuator(a.id, a.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      a.is_active
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {a.is_active ? 'ACTIVE' : 'IDLE'}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between border-t border-slate-100 pt-2.5">
                  <span>{a.location}</span>
                  <span>{a.auto_mode ? 'Managed by Rules' : 'Manual Override'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
