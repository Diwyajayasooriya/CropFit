'use client';

import React from 'react';
import Link from 'next/link';
import type { Greenhouse, DashboardSummary } from '@/types';
import type { GreenNode } from '@/lib/api-functions';
import { timeAgo } from '@/lib/utils';
import { Card, StatusBadge, type CropFitStatus } from '@/components/ui';
import {
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
  nodesError?: string | null;
  onRetry?: () => void;
}

export function GreenhouseCard({
  greenhouse,
  summary,
  nodes = [],
  loading = false,
  nodesError = null,
  onRetry,
}: GreenhouseCardProps) {
  const linkedNodes = nodes.filter(node => node.greenHouse === greenhouse.id);
  const statusUnknown = loading || Boolean(nodesError);

  // Extract temperature & soil moisture tiles if present
  const tempTile = summary?.tiles?.find(
    (t) => t.sensor_kind === 'temperature' && t.value !== null
  );
  const soilTile = summary?.tiles?.find(
    (t) => t.sensor_kind === 'soil_moisture' && t.value !== null
  );

  const tempDisplay = tempTile ? `${tempTile.value}${tempTile.unit}` : 'No data';
  const soilDisplay = soilTile ? `${soilTile.value}${soilTile.unit}` : 'No data';
  const hasReadings = summary?.tiles?.some(tile => tile.value !== null && tile.value !== undefined);

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
              Crop: <span className="font-semibold text-slate-700">{greenhouse.crop || 'Not specified'}</span>
              {greenhouse.location && <span> · {greenhouse.location}</span>}
            </p>
          </div>

          {hasReadings && summary?.overall_status ? <StatusBadge status={healthStatus} showDot>
            Health: {healthLabel}
          </StatusBadge> : <span className="text-xs text-slate-500">Health: No data</span>}
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
        <section aria-label="Linked GreenNode hubs" className="mt-4 space-y-3 text-xs text-slate-500 px-1">
          <p className="font-medium">GreenNode hubs{!statusUnknown ? `: ${linkedNodes.length} linked` : ''}</p>
          {nodesError ? <p role="status" className="text-amber-700">Hub status unavailable. {onRetry && <button onClick={onRetry} className="underline cursor-pointer">Retry</button>}</p>
            : loading ? <p role="status">Loading hubs...</p>
            : linkedNodes.length === 0 ? <p>No hub linked.</p> : null}
          {linkedNodes.map(node => (
            <div key={node.id} className="border-t border-slate-100 pt-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700 break-words">{node.node_name || 'GreenNode'}</p>
                  <p className="font-mono break-all">{node.node_id}</p>
                </div>
                <span className={`flex items-center gap-1 shrink-0 ${!statusUnknown && node.is_online ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {statusUnknown ? 'Status unknown' : node.is_online
                    ? <><WifiIcon size={14} />Online</>
                    : <><WifiOffIcon size={14} />Offline</>}
                </span>
              </div>
              <p className="mt-1 text-[11px]">Last seen: {timeAgo(node.last_seen)}</p>
            </div>
          ))}
        </section>
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
