'use client';

import React, { useCallback, useId, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { list, type ConditionReading, type ConditionThreshold } from '@/lib/api-functions';
import { usePollingResource } from '@/hooks/use-polling-resource';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { RefreshIcon } from '@/components/icons';
import type { DashboardTile } from '@/types';

type MetricType = 'temperature' | 'humidity' | 'soil_moisture';

interface SensorHistoryProps {
  greenhouseId: number;
  tiles: DashboardTile[];
  thresholds?: ConditionThreshold[];
}

export function SensorHistory({
  greenhouseId,
  tiles,
  thresholds = [],
}: SensorHistoryProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>('temperature');
  const [timeRange, setTimeRange] = useState<string>('24'); // 24 = 24h, 168 = 7d, 720 = 30d
  const gradientId = useId().replace(/:/g, '');

  // Find relevant tile for units and thresholds
  const currentTile = tiles.find((t) => t.sensor_kind === activeMetric);
  const unit = currentTile?.unit || (activeMetric === 'temperature' ? '°C' : '%');

  // Load readings for this greenhouse
  const load = useCallback(() => {
    return list<ConditionReading>(
      `/conditions/readings/?greenhouse=${greenhouseId}&hours=${timeRange}`
    );
  }, [greenhouseId, timeRange]);

  const resource = usePollingResource(load, 30000);

  const readings = (resource.data ?? [])
    .slice()
    .sort((a, b) => a.reading_ts - b.reading_ts)
    .map((r) => ({
      timestamp: r.reading_ts * 1000,
      value: r[activeMetric],
    }))
    .filter((d) => d.value !== null && d.value !== undefined);

  // Relevant threshold lines
  const lines = thresholds.filter((t) =>
    [activeMetric, `${activeMetric}_min`, `${activeMetric}_max`].includes(
      t.condition_type.toLowerCase()
    )
  );

  const metricColors: Record<MetricType, { stroke: string; fill: string }> = {
    temperature: { stroke: '#f97316', fill: '#f97316' },
    humidity: { stroke: '#0284c7', fill: '#0284c7' },
    soil_moisture: { stroke: '#059669', fill: '#059669' },
  };

  const currentColor = metricColors[activeMetric];

  return (
    <Card className="flex flex-col h-full shadow-xs border-slate-200/90">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100">
        <div>
          <CardTitle className="text-lg">Sensor History</CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time telemetry trend analysis
          </p>
        </div>

        {/* Metric selection pills & time range filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric tabs */}
          <div className="flex bg-slate-100/90 p-1 rounded-xl text-xs font-semibold">
            {(
              [
                { id: 'temperature', label: 'Temperature' },
                { id: 'humidity', label: 'Humidity' },
                { id: 'soil_moisture', label: 'Soil Moisture' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMetric(m.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeMetric === m.id
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer focus:outline-emerald-600 hover:border-slate-300"
            aria-label="Chart time range"
          >
            <option value="24">24h</option>
            <option value="168">7 days</option>
            <option value="720">30 days</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        {resource.loading && !resource.data && (
          <div className="h-72 flex items-center justify-center text-sm text-slate-400 gap-2">
            <RefreshIcon size={16} className="animate-spin text-emerald-600" />
            Loading sensor history…
          </div>
        )}

        {resource.error && !resource.data && (
          <div className="h-72 flex items-center justify-center text-sm text-amber-700">
            Telemetry history currently unavailable.
          </div>
        )}

        {!resource.loading && readings.length === 0 && (
          <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <p className="text-sm font-semibold text-slate-600">No sensor readings yet</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Data will appear after your GreenNode receives sensor measurements for this period.
            </p>
          </div>
        )}

        {readings.length > 0 && (
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={currentColor.fill} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={currentColor.fill} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleString([], Number(timeRange) > 24
                      ? { month: 'short', day: 'numeric' }
                      : { hour: '2-digit', minute: '2-digit' })
                  }
                />
                <YAxis
                  unit={unit}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                    fontSize: '12px',
                  }}
                  labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                />
                {lines.map((t) => (
                  <ReferenceLine
                    key={t.id}
                    y={t.threshold_value}
                    stroke="#d97706"
                    strokeDasharray="4 4"
                    label={{
                      value: t.condition_type.endsWith('_min') ? 'Min' : 'Max',
                      fill: '#b45309',
                      fontSize: 10,
                    }}
                  />
                ))}
                <Area
                  dataKey="value"
                  name={activeMetric.replace('_', ' ')}
                  stroke={currentColor.stroke}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  connectNulls
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer summary */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>{readings.length} data points recorded</span>
          <span className="capitalize">{activeMetric.replace('_', ' ')} target bounds active</span>
        </div>
      </CardContent>
    </Card>
  );
}
