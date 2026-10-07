'use client';

import React from 'react';
import type { DashboardTile, SensorKind } from '@/types';
import { Card, StatusBadge, type CropFitStatus } from '@/components/ui';
import {
  ThermometerIcon,
  DropletIcon,
  WindIcon,
  SunIcon,
  ActivityIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from '@/components/icons';
import { timeAgo } from '@/lib/utils';

export interface SensorCardProps {
  label: string;
  value: number | string | null;
  unit: string;
  status?: CropFitStatus;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable' | null;
  updatedAt?: string;
  className?: string;
}

export function getSensorIcon(kind: SensorKind | string, size = 20) {
  switch (kind?.toLowerCase()) {
    case 'temperature':
    case 'temp':
      return <ThermometerIcon size={size} className="text-orange-600" />;
    case 'humidity':
    case 'hum':
      return <DropletIcon size={size} className="text-sky-600" />;
    case 'soil_moisture':
    case 'soil':
      return <DropletIcon size={size} className="text-emerald-600" />;
    case 'co2':
      return <WindIcon size={size} className="text-purple-600" />;
    case 'light':
      return <SunIcon size={size} className="text-amber-500" />;
    default:
      return <ActivityIcon size={size} className="text-slate-500" />;
  }
}

export function SensorCard({
  label,
  value,
  unit,
  status = 'healthy',
  icon,
  trend,
  updatedAt,
  className = '',
}: SensorCardProps) {
  const isAvailable = value !== null && value !== undefined && value !== '';
  const trendColor = trend === 'up' ? 'text-amber-600' : trend === 'down' ? 'text-sky-600' : 'text-slate-400';
  const trendText = trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable';

  return (
    <Card hover className={`p-5 flex flex-col justify-between ${className}`}>
      {/* Top Header: Label & Sensor Icon */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase truncate">
            {label}
          </span>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
            {icon || <ActivityIcon size={18} className="text-slate-400" />}
          </div>
        </div>

        {/* Big Reading Value */}
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {isAvailable ? value : '—'}
          </span>
          {isAvailable && unit && (
            <span className="text-sm sm:text-base font-semibold text-slate-400">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Bottom status badge & trend indicator */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <StatusBadge status={status} showDot />

        <div className="flex items-center gap-1.5 font-medium">
          {trend && (
            <span className={`flex items-center gap-1 ${trendColor}`}>
              {trend === 'up' ? <TrendingUpIcon size={14} /> : trend === 'down' ? <TrendingDownIcon size={14} /> : '→'}
              <span>{trendText}</span>
            </span>
          )}
          {!trend && updatedAt && (
            <span className="text-slate-400">
              {timeAgo(updatedAt)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

// Wrapper for tile from backend API
export function SensorTileCard({ tile }: { tile: DashboardTile }) {
  const status: CropFitStatus =
    tile.status === 'online' ? 'healthy' : tile.status === 'error' ? 'critical' : 'warning';

  return (
    <SensorCard
      label={tile.sensor_name}
      value={tile.value !== null ? tile.value : 'No data'}
      unit={tile.unit}
      status={status}
      icon={getSensorIcon(tile.sensor_kind)}
      trend={tile.trend}
      updatedAt={tile.updated_at}
    />
  );
}
