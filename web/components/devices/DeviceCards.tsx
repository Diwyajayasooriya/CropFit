'use client';

import type { GreenNode, NodeSensor, NodeActuator } from '@/lib/api-functions';
import type { DashboardSummary } from '@/types';
import { StatusBadge } from '@/components/status-badge';
import { ActuatorControl } from '@/components/actuator-control';
import { ActivityIcon, DevicesIcon, DropletIcon, LeafIcon, LightningIcon, SunIcon, ThermometerIcon, WifiIcon, WindIcon } from '@/components/icons';
import { timeAgo } from '@/lib/utils';

export function DeviceTypeIcon({ type, category }: { type: string; category: 'hub' | 'sensor' | 'actuator' }) {
  const value = type.toLowerCase();
  const Icon = category === 'hub' ? WifiIcon
    : /soil|moisture/.test(value) ? LeafIcon
    : /temp|dht|heater/.test(value) ? ThermometerIcon
    : /humid|water|pump|valve|irrigation/.test(value) ? DropletIcon
    : /fan|vent|co2|co₂|air/.test(value) ? WindIcon
    : /light|lux|lamp/.test(value) ? SunIcon
    : category === 'actuator' ? LightningIcon : ActivityIcon;
  const color = category === 'hub' ? 'bg-emerald-50 text-emerald-700'
    : category === 'sensor' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700';
  return <span className={`inline-flex shrink-0 rounded-2xl p-3 ${color}`}><Icon size={24} aria-hidden="true" /></span>;
}

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 min-w-0';
const label = (value: string) => value.replaceAll('_', ' ');

export function HubDeviceCard({ hub, stale }: { hub: GreenNode; stale: boolean }) {
  return <article className={cardClass}>
    <div className="flex items-start justify-between gap-3">
      <DeviceTypeIcon type="hub" category="hub" />
      <StatusBadge tone={stale ? 'pending' : hub.is_online ? 'success' : 'neutral'}>{stale ? 'Status unknown' : hub.is_online ? 'Online' : 'Offline'}</StatusBadge>
    </div>
    <div><p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">GreenNode hub</p><h4 className="font-semibold text-lg text-slate-900 break-words mt-1">{hub.node_name || hub.node_id}</h4><p className="text-xs text-slate-500 font-mono break-all mt-1">{hub.node_id}</p></div>
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm"><p><span className="font-bold text-slate-900">{hub.sensors.length}</span> sensors</p><p><span className="font-bold text-slate-900">{hub.actuators.length}</span> actuators</p></div>
    <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 space-y-1"><p>Last seen: {timeAgo(hub.last_seen)}</p><p>Software: {hub.software_version || 'Not reported'}</p>{hub.ip_address && <p>IP address: {hub.ip_address}</p>}</div>
  </article>;
}

export function SensorDeviceCard({ sensor, hub, readings, stale }: {
  sensor: NodeSensor; hub: GreenNode; readings: DashboardSummary['tiles']; stale: boolean;
}) {
  return <article className={cardClass}>
    <div className="flex items-start justify-between gap-3"><DeviceTypeIcon type={sensor.sensor_type} category="sensor" /><StatusBadge tone={sensor.is_active ? 'success' : 'neutral'}>{sensor.is_active ? 'Enabled' : 'Disabled'}</StatusBadge></div>
    <div><p className="text-[10px] uppercase tracking-wider font-semibold text-sky-700">Sensor</p><h4 className="font-semibold text-lg text-slate-900 capitalize break-words mt-1">{label(sensor.sensor_type)}</h4><p className="text-xs text-slate-500 font-mono break-all mt-1">{sensor.sensor_id}</p></div>
    <div className="rounded-xl bg-slate-50 p-3 space-y-3">
      {readings.length ? readings.map(reading => <div key={reading.sensor_id}><p className="text-xs text-slate-500 capitalize">{label(reading.sensor_kind)}</p><p className="text-2xl font-bold text-slate-900">{reading.value ?? 'No data'}{reading.value != null && <span className="text-sm font-medium text-slate-500 ml-1">{reading.unit}</span>}</p><p className="text-[11px] text-slate-500">Updated {timeAgo(reading.updated_at)}</p></div>) : <p className="text-sm text-slate-500">No readings received</p>}
    </div>
    <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 space-y-1"><p className="break-words">Hub: {hub.node_name || hub.node_id}</p><p>{stale ? 'Connection status unavailable · readings may be stale' : hub.is_online ? 'Hub online' : 'Hub offline · showing last received readings'}</p></div>
  </article>;
}

export function ActuatorDeviceCard({ actuator, hub, stale }: { actuator: NodeActuator; hub: GreenNode; stale: boolean }) {
  return <article className={cardClass}>
    <DeviceTypeIcon type={actuator.actuator_type} category="actuator" />
    <div><p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700">Actuator</p><p className="text-xs text-slate-500 font-mono break-all mt-1">{actuator.actuator_id}</p></div>
    <ActuatorControl id={actuator.id} name={label(actuator.actuator_type)} />
    <div className="border-t border-slate-100 pt-3 text-xs text-slate-500 space-y-1"><p className="break-words">Hub: {hub.node_name || hub.node_id}</p><p>{stale ? 'Connection status unavailable' : hub.is_online ? 'Hub online' : 'Hub offline'}</p></div>
  </article>;
}

const categories = [
  { id: 'all', title: 'All devices', icon: DevicesIcon, description: 'Your connected equipment' },
  { id: 'hub', title: 'GreenNode hubs', icon: WifiIcon, description: 'Connection and heartbeat' },
  { id: 'sensor', title: 'Sensors', icon: ActivityIcon, description: 'Climate and soil readings' },
  { id: 'actuator', title: 'Actuators', icon: LightningIcon, description: 'Equipment and controls' },
] as const;

export function DeviceCategoryCards({ selected, onSelect, counts }: { selected: string; onSelect: (value: string) => void; counts: Record<string, number | null> }) {
  return <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" role="group" aria-label="Device category">{categories.map(({ id, title, icon: Icon, description }) => <button key={id} onClick={() => onSelect(id)} aria-pressed={selected === id} className={`text-left rounded-2xl border p-4 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${selected === id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'}`}><div className="flex items-center justify-between gap-2"><Icon size={22} className="text-emerald-700" aria-hidden="true" /><span className="text-2xl font-bold text-slate-900">{counts[id] ?? '—'}</span></div><p className="text-sm font-semibold text-slate-900 mt-3">{title}</p><p className="text-xs text-slate-500 mt-1">{description}</p></button>)}</div>;
}
