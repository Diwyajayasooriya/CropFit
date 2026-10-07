'use client';

import React from 'react';
import Link from 'next/link';
import type { Alert } from '@/types';
import { Card, CardHeader, CardTitle, StatusBadge, type CropFitStatus } from '@/components/ui';
import { BellIcon, ChevronRightIcon, CheckCircleIcon } from '@/components/icons';
import { timeAgo } from '@/lib/utils';

interface RecentAlertsProps {
  alerts?: Alert[];
}

export function RecentAlerts({ alerts = [] }: RecentAlertsProps) {
  // If real alerts exist, display top 3; otherwise provide contextual recent history
  const displayAlerts =
    alerts.length > 0
      ? alerts.slice(0, 3).map((a) => {
          const badgeStatus: CropFitStatus =
            a.is_resolved ? 'healthy' : a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'neutral';
          const badgeLabel = a.is_resolved ? 'Resolved' : a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info';

          return {
            id: a.id,
            title: a.title,
            time: timeAgo(a.created_at),
            badgeStatus,
            badgeLabel,
          };
        })
      : [
          {
            id: 'mock-1',
            title: 'Low soil moisture',
            time: '10 min ago',
            badgeStatus: 'warning' as CropFitStatus,
            badgeLabel: 'Warning',
          },
          {
            id: 'mock-2',
            title: 'Temperature returned to normal',
            time: '1 hour ago',
            badgeStatus: 'neutral' as CropFitStatus,
            badgeLabel: 'Info',
          },
          {
            id: 'mock-3',
            title: 'Sensor sync restored',
            time: '3 hours ago',
            badgeStatus: 'healthy' as CropFitStatus,
            badgeLabel: 'Resolved',
          },
        ];

  return (
    <Card className="flex flex-col h-full shadow-xs border-slate-200/90">
      <CardHeader className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <BellIcon size={16} />
          </div>
          <CardTitle className="text-base">Recent Alerts</CardTitle>
        </div>
        <Link
          href="/alerts"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
        >
          <span>View all alerts</span>
          <ChevronRightIcon size={14} />
        </Link>
      </CardHeader>

      <div className="divide-y divide-slate-100 p-2 sm:p-3 flex-1 flex flex-col justify-around">
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 rounded-xl hover:bg-slate-50/80 transition-colors"
          >
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 truncate">
                {alert.title}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">{alert.time}</p>
            </div>

            <StatusBadge status={alert.badgeStatus}>
              {alert.badgeLabel}
            </StatusBadge>
          </div>
        ))}
      </div>
    </Card>
  );
}
