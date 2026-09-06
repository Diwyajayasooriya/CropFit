// ============================================================
// CropFit — Alerts Inbox View (`alerts` app) (Light / White Theme)
// Real-time alert notifications with severity categorization & read states
// ============================================================

'use client';

import React, { useState } from 'react';
import { mockAlerts } from '@/lib/mock-data';
import { toast } from '@/lib/store/toast-store';
import type { AlertSeverity } from '@/types';
import {
  AlertTriangleIcon,
  InfoIcon,
  CheckCircleIcon,
} from '@/components/icons';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(mockAlerts);

  const markAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_read: true } : a))
    );
    toast.info('Alert marked as resolved', 'Updated');
  };

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    toast.success('All alerts marked as read', 'Cleared');
  };

  const severityBadges: Record<AlertSeverity, { bg: string; text: string; icon: React.ReactNode }> = {
    critical: {
      bg: 'bg-rose-50 text-rose-700 border border-rose-200',
      text: 'Critical',
      icon: <AlertTriangleIcon size={14} className="text-rose-600 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50 text-amber-700 border border-amber-200',
      text: 'Warning',
      icon: <AlertTriangleIcon size={14} className="text-amber-600 shrink-0" />,
    },
    info: {
      bg: 'bg-sky-50 text-sky-700 border border-sky-200',
      text: 'Information',
      icon: <InfoIcon size={14} className="text-sky-600 shrink-0" />,
    },
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Alerts & Notifications
            </h2>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                {unreadCount} New
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            System notices, threshold violations, and edge failover logs
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
          >
            Mark All as Read
          </button>
        )}
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const badge = severityBadges[alert.severity] || severityBadges.info;

          return (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
                alert.is_read
                  ? 'border-slate-200 bg-white/70 opacity-70'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="pt-0.5">{badge.icon}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      {alert.title}
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${badge.bg}`}>
                      {badge.text}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 max-w-xl">
                    {alert.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                {!alert.is_read && (
                  <button
                    onClick={() => markAsRead(alert.id)}
                    className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Acknowledge
                  </button>
                )}
                {alert.is_read && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <CheckCircleIcon size={12} />
                    <span>Resolved</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
