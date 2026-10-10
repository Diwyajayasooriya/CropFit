'use client';

import React from 'react';
import Link from 'next/link';
import type { ActuatorState } from '@/types';
import { Card, CardHeader, CardTitle, StatusBadge } from '@/components/ui';
import { LightningIcon, ChevronRightIcon } from '@/components/icons';

interface AutomaticControlsProps {
  actuators?: ActuatorState[];
}

export function AutomaticControls({ actuators = [] }: AutomaticControlsProps) {
  // If backend returns configured actuators, use them; otherwise provide default familiar greenhouse actuators
  const displayItems =
    actuators.length > 0
      ? actuators.map((a) => {
          let statusText = 'Waiting';
          let badgeStatus: 'auto' | 'on' | 'off' = 'auto';

          if (a.is_active) {
            statusText = 'Running normally';
            badgeStatus = a.auto_mode ? 'auto' : 'on';
          } else if (!a.auto_mode) {
            statusText = 'Turned off';
            badgeStatus = 'off';
          }

          return {
            id: a.actuator_id,
            name: a.name || a.actuator_id,
            badge: badgeStatus,
            statusText,
          };
        })
      : [
          {
            id: 'fan-1',
            name: 'Ventilation Fan',
            badge: 'auto' as const,
            statusText: 'Running normally',
          },
          {
            id: 'pump-1',
            name: 'Water Pump',
            badge: 'auto' as const,
            statusText: 'Waiting',
          },
          {
            id: 'mister-1',
            name: 'Mister',
            badge: 'off' as const,
            statusText: 'Turned off',
          },
        ];

  return (
    <Card className="flex flex-col h-full shadow-xs border-slate-200/90">
      <CardHeader className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
            <LightningIcon size={16} />
          </div>
          <CardTitle className="text-base">Automatic Controls</CardTitle>
        </div>
        <Link
          href="/automation"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
        >
          <span>Manage</span>
          <ChevronRightIcon size={14} />
        </Link>
      </CardHeader>

      <div className="divide-y divide-slate-100 p-2 sm:p-3 flex-1 flex flex-col justify-around">
        {displayItems.map((item) => (
          <div
            key={item.id}
            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 rounded-xl hover:bg-slate-50/80 transition-colors"
          >
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 truncate">
                {item.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">{item.statusText}</p>
            </div>

            <StatusBadge status={item.badge} className="uppercase font-bold tracking-wider" />
          </div>
        ))}
      </div>
    </Card>
  );
}
