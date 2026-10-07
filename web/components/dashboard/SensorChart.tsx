"use client";
import { useCallback, useId, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { list, type ConditionReading, type ConditionThreshold } from '@/lib/api-functions';
import { usePollingResource } from '@/hooks/use-polling-resource';
import { ResourceState } from '@/components/resource-state';
import type { DashboardTile } from '@/types';

export function SensorChart({ tile, greenhouseId, thresholds = [] }: { tile: DashboardTile; greenhouseId: number; thresholds?: ConditionThreshold[] }) {
  const [hours, setHours] = useState('24');
  const gradientId = useId().replace(/:/g, '');
  const deviceId = tile.device_id ?? tile.sensor_id.replace(/^(temp|hum|soil)-/, '');
  const load = useCallback(() => list<ConditionReading>(`/conditions/readings/?greenhouse=${greenhouseId}&device_id=${encodeURIComponent(deviceId)}&hours=${hours}${tile.node_id ? `&node=${tile.node_id}` : ''}`), [greenhouseId, deviceId, hours, tile.node_id]);
  const resource = usePollingResource(load);
  const readings = (resource.data ?? []).slice().sort((a,b) => a.reading_ts-b.reading_ts).map(r => ({ timestamp: r.reading_ts*1000, value: r[tile.sensor_kind as 'temperature' | 'humidity' | 'soil_moisture'] }));
  // Only explicit metric names and _min/_max suffixes are understood. Unknown
  // condition types are not guessed; legacy records may encode other meanings.
  const lines = thresholds.filter(t => t.node === tile.node_id && [tile.sensor_kind, `${tile.sensor_kind}_min`, `${tile.sensor_kind}_max`].includes(t.condition_type.toLowerCase()));
  return <section className="panel">
    <div className="flex flex-wrap justify-between gap-3 mb-4"><h3 className="font-semibold">{tile.sensor_name} history</h3><select className="text-sm rounded-lg border border-slate-200 p-2" aria-label={`${tile.sensor_name} history time range`} value={hours} onChange={e => setHours(e.target.value)}><option value="1">Last hour</option><option value="6">Last 6 hours</option><option value="24">Last 24 hours</option><option value="168">Last 7 days</option></select></div>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.error && resource.data && <p className="text-sm text-amber-700">Chart data is stale.</p>}
    {readings.length ? <>
      <div className="h-64" role="img" aria-label={`${tile.sensor_name} history in ${tile.unit}, ${readings.length} readings`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={readings}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.25}/><stop offset="100%" stopColor="#059669" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={v => new Date(v).toLocaleString([], Number(hours) > 24 ? {month:'short',day:'numeric',hour:'2-digit'} : {hour:'2-digit',minute:'2-digit'})} /><YAxis unit={tile.unit} /><Tooltip labelFormatter={v => new Date(Number(v)).toLocaleString()} />
        {lines.map(t => <ReferenceLine key={t.id} y={t.threshold_value} stroke="#d97706" strokeDasharray="4 4" ifOverflow="extendDomain" label={t.condition_type.endsWith('_min') ? 'Minimum' : t.condition_type.endsWith('_max') ? 'Maximum' : 'Threshold'} />)}
        <Area dataKey="value" name={tile.sensor_name} stroke="#059669" fill={`url(#${gradientId})`} connectNulls={false} isAnimationActive={false} />
      </AreaChart></ResponsiveContainer></div>
      <p className="text-xs text-slate-500 mt-2">Showing {readings.length} readings, {new Date(readings[0].timestamp).toLocaleString()} – {new Date(readings[readings.length-1].timestamp).toLocaleString()}.</p>
      {readings.length >= 500 && <p className="text-xs text-amber-700 mt-1">Limited to the latest 500 readings. Earlier readings in this time range may be omitted.</p>}
    </> : !resource.loading && !resource.error && <p className="text-slate-500">No readings in this time range.</p>}
  </section>;
}
