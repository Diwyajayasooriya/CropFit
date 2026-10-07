import Link from 'next/link';
import type { Alert, DashboardSummary, DashboardTile } from '@/types';
import type { GreenNode } from '@/lib/api-functions';
import { timeAgo } from '@/lib/utils';
import { HubStatus } from '@/components/hub-status';
import { ActuatorControl } from '@/components/actuator-control';

export function DashboardHeader({ name }: { name: string }) {
  return <div><p className="text-xs uppercase tracking-widest text-emerald-700 font-semibold mb-1">Greenhouse overview</p><h2 className="text-2xl font-bold">{name}</h2><p className="text-slate-500 mt-1">Conditions, equipment, and tasks for your greenhouse.</p></div>;
}
export function GreenhouseHealth({ summary }: { summary: DashboardSummary }) {
  const hasReadings = summary.tiles.some(tile => tile.value !== null);
  const color = !hasReadings ? 'border-l-slate-300' : summary.overall_status === 'critical' ? 'border-l-rose-500' : summary.overall_status === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500';
  return <section className={`panel border-l-4 ${color}`}><h3 className="font-semibold capitalize">Greenhouse health: {hasReadings ? summary.overall_status : 'Awaiting readings'}</h3><p className="text-slate-600 mt-1">{hasReadings ? summary.message : 'Health cannot be assessed until sensor readings arrive.'}</p></section>;
}
export function SensorCard({ tile }: { tile: DashboardTile }) {
  const color = tile.sensor_kind === 'temperature' ? 'text-orange-700' : tile.sensor_kind === 'humidity' ? 'text-sky-700' : 'text-emerald-700';
  return <article className="panel shadow-sm"><h3 className="text-sm text-slate-500">{tile.sensor_name}</h3><p className={`text-3xl font-bold my-3 ${color}`}>{tile.value ?? 'No data'}{tile.value !== null && <span className="text-base ml-1 font-normal">{tile.unit}</span>}</p><div className="flex justify-between gap-3 text-xs text-slate-500"><span>Last reading: {timeAgo(tile.updated_at)}</span>{tile.trend && <span aria-label={`Trend: ${tile.trend}`}>{tile.trend === 'up' ? '↑ Rising' : tile.trend === 'down' ? '↓ Falling' : '→ Stable'}</span>}</div></article>;
}
export function SensorGrid({ tiles }: { tiles: DashboardTile[] }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{tiles.map(tile => <SensorCard key={tile.sensor_id} tile={tile} />)}{!tiles.length && <p className="text-slate-500">No sensor readings yet.</p>}</div>;
}
export function RecommendationCard({ alerts, nodes }: { alerts: Alert[]; nodes: GreenNode[] }) {
  const offline = nodes.filter(n => !n.is_online).length;
  return <section className="panel"><h3 className="font-semibold mb-3">Recommended next steps</h3><div className="space-y-3 text-sm">{alerts.length > 0 && <p><Link className="text-emerald-700 underline" href="/alerts">Review {alerts.length} unresolved alert(s)</Link> and inspect the affected conditions.</p>}{offline > 0 && <p>Check power and network connectivity for {offline} offline hub(s).</p>}{!nodes.length && <Link className="text-emerald-700 underline" href="/claim">Claim a GreenNode hub to begin monitoring.</Link>}{nodes.length > 0 && !offline && !alerts.length && <p className="text-slate-500">No follow-up tasks based on the current alerts and hub status.</p>}</div></section>;
}
export function AutomationSummary({ summary }: { summary: DashboardSummary }) {
  return <section className="panel"><div className="flex justify-between"><h3 className="font-semibold">Actuator controls</h3><Link className="text-sm text-emerald-700 underline" href="/devices">Manage devices</Link></div>{summary.actuators.map(a => <div className="border-t border-slate-100 py-3 mt-2" key={a.actuator_id}>{a.id ? <ActuatorControl id={a.id} name={a.name} /> : <p>{a.name}: hardware state unconfirmed</p>}</div>)}{!summary.actuators.length && <p className="text-slate-500 mt-3">No actuators configured.</p>}</section>;
}
export function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  return <section className="panel"><h3 className="font-semibold mb-3">Recent unresolved alerts</h3>{alerts.slice(0,5).map(a => <Link href="/alerts" key={a.id} className={`block border-l-4 rounded-r-lg bg-slate-50 px-3 py-3 mt-2 ${a.severity === 'critical' ? 'border-rose-500' : a.severity === 'warning' ? 'border-amber-500' : 'border-sky-500'}`}><span className="font-medium">{a.title}</span><span className="text-xs ml-2 capitalize">{a.severity}</span><p className="text-sm text-slate-500">{a.message}</p><p className="text-xs text-slate-400 mt-1">{timeAgo(a.created_at)}</p></Link>)}{!alerts.length && <p className="text-slate-500">No unresolved alerts.</p>}</section>;
}
export function GreenNodeStatus({ nodes, error, loading }: { nodes: GreenNode[]; error?: string | null; loading?: boolean }) {
  return <section className="panel"><h3 className="font-semibold mb-3">GreenNode hubs</h3><HubStatus nodes={nodes} loading={loading} error={error} />{nodes.map(n => <div className="py-3 border-b border-slate-100 last:border-0" key={n.id}><div className="flex justify-between gap-2"><span>{n.node_name || n.node_id}</span><span className="text-sm text-slate-500">{error ? 'Last known: ' : ''}{n.is_online ? 'Online' : 'Offline'}</span></div><p className="text-xs text-slate-500 mt-1">Heartbeat: {timeAgo(n.last_seen)} · v{n.software_version}</p></div>)}</section>;
}
