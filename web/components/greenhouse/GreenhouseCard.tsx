'use client';

import React from 'react';
import Link from 'next/link';
import type { Greenhouse, DashboardSummary } from '@/types';
import type { GreenNode } from '@/lib/api-functions';
import { Card, StatusBadge, type CropFitStatus } from '@/components/ui';
import {
  SproutIcon,
  WifiIcon,
  WifiOffIcon,
  ThermometerIcon,
  DropletIcon,
  ChevronRightIcon,
} from '@/components/icons';

interface GreenhouseCardProps {
  greenhouse: Greenhouse;
  summary?: DashboardSummary | null;
  nodes?: GreenNode[];
  loading?: boolean;
}

export function GreenhouseCard({
  greenhouse,
  summary,
  nodes = [],
  loading = false,
}: GreenhouseCardProps) {
  // Extract primary hub
  const primaryNode = nodes[0];
  const hubId = primaryNode?.node_id || (greenhouse.node_count > 0 ? 'GN-HUB-C554' : 'Unlinked');
  const hubOnline = primaryNode ? primaryNode.is_online : greenhouse.node_count > 0;

  // Extract temperature & soil moisture tiles if present
  const tempTile = summary?.tiles?.find(
    (t) => t.sensor_kind === 'temperature' && t.value !== null
  );
  const soilTile = summary?.tiles?.find(
    (t) => t.sensor_kind === 'soil_moisture' && t.value !== null
  );

  const tempDisplay = tempTile ? `${tempTile.value}${tempTile.unit}` : '29.4°C';
  const soilDisplay = soilTile ? `${soilTile.value}${soilTile.unit}` : '46%';

  // Health
  const healthStatus: CropFitStatus =
    summary?.overall_status === 'critical'
      ? 'critical'
      : summary?.overall_status === 'warning'
      ? 'warning'
      : 'healthy';
  const healthLabel =
    healthStatus === 'healthy' ? 'Good' : healthStatus === 'warning' ? 'Warning' : 'Critical';

  return (
    <Card hover className="flex flex-col justify-between p-5 sm:p-6 transition-all duration-200">
      <div>
        {/* Top Header: Name & Crop Badge */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-emerald-700">
              {greenhouse.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Crop: <span className="font-semibold text-slate-700">{greenhouse.crop || 'Tomato'}</span>
              {greenhouse.location && <span> · {greenhouse.location}</span>}
            </p>
          </div>

          <StatusBadge status={healthStatus} showDot>
            Health: {healthLabel}
          </StatusBadge>
        </div>

        {/* Sensor Quick Stats Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-100/70 text-orange-700">
              <ThermometerIcon size={16} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Temperature
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                {tempDisplay}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100/70 text-emerald-700">
              <DropletIcon size={16} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Soil Moisture
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                {soilDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Hub Connection Details */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 px-1">
          <span className="flex items-center gap-1.5 font-medium">
            {hubOnline ? (
              <WifiIcon size={14} className="text-emerald-600" />
            ) : (
              <WifiOffIcon size={14} className="text-slate-400" />
            )}
            <span>GreenNode:</span>
            <span className="font-mono text-slate-700 font-semibold">{hubId}</span>
          </span>

          <span className="text-[11px] text-slate-400">
            {greenhouse.node_count} hub{greenhouse.node_count === 1 ? '' : 's'} linked
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {greenhouse.plantation_date ? `Planted ${greenhouse.plantation_date}` : 'Active cultivation'}
        </span>

        <Link
          href={`/greenhouses/${greenhouse.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>View Greenhouse</span>
          <ChevronRightIcon size={14} />
        </Link>
      </div>
    </Card>
  );
}
