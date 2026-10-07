'use client';
import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getGreenhouses, getNodes, type GreenNode } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { usePollingResource } from '@/hooks/use-polling-resource';
import { Topbar } from '@/components/layout/Topbar';
import { ResourceState } from '@/components/resource-state';
import { HubStatus } from '@/components/hub-status';
import { StatusBadge } from '@/components/status-badge';
import { ActuatorControl } from '@/components/actuator-control';
import { toast } from '@/lib/store/toast-store';
import { timeAgo } from '@/lib/utils';
import type { DashboardSummary } from '@/types';

function RegisterDevice({ nodes, onSaved }: { nodes: GreenNode[]; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const category = values.get('category');
    const node = Number(values.get('node'));
    if (!nodes.some(n => n.id === node)) return;
    const body = category === 'sensor'
      ? { node, sensor_id: String(values.get('device_id')).trim(), sensor_type: String(values.get('model')).trim(), unit: String(values.get('unit')).trim(), is_active: true }
      : { node, actuator_id: String(values.get('device_id')).trim(), actuator_type: String(values.get('model')).trim() };
    pending.current = true; setBusy(true); setError(null);
    try {
      await apiFetch.post(category === 'sensor' ? '/nodes/sensors/' : '/nodes/actuators/', body);
      toast.success('Device registered.'); form.reset(); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not register device.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <details className="panel"><summary className="font-semibold cursor-pointer">Register a sensor or actuator</summary><form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-4">
    <label className="text-sm">Hub<select name="node" className="field" required>{nodes.map(n => <option key={n.id} value={n.id}>{n.node_name || n.node_id}</option>)}</select></label>
    <label className="text-sm">Device category<select className="field" name="category"><option value="sensor">Sensor</option><option value="actuator">Actuator</option></select></label>
    <label className="text-sm">Hardware ID<input className="field" name="device_id" required maxLength={100} /></label>
    <label className="text-sm">Type / model<input className="field" name="model" required maxLength={50} placeholder="DHT22, soil_moisture, fan…" /></label>
    <label className="text-sm">Sensor unit<input className="field" name="unit" maxLength={20} placeholder="°C or %" /></label>
    {error && <p role="alert" className="text-rose-700 text-sm sm:col-span-2">{error}</p>}
    <div className="sm:col-span-2"><button className="primary-button" disabled={busy || !nodes.length}>{busy ? 'Registering…' : 'Register device'}</button></div>
  </form></details>;
}

function DeviceScope({ greenhouseId }: { greenhouseId: number }) {
  const [selectedNode, setSelectedNode] = useState('');
  const [filter, setFilter] = useState('all');
  const load = useCallback(async () => {
    const [nodes, summary] = await Promise.all([getNodes(greenhouseId), apiFetch.get<DashboardSummary>(`/reports/dashboard/?greenhouse=${greenhouseId}`)]);
    return { nodes, summary };
  }, [greenhouseId]);
  const resource = usePollingResource(load);
  const nodes = resource.data?.nodes ?? [];
  const visible = nodes.filter(n => !selectedNode || String(n.id) === selectedNode);
  const sensors = visible.flatMap(n => n.sensors.map(s => ({ ...s, hub: n })));
  const actuators = visible.flatMap(n => n.actuators);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm">Hub<select className="field" value={selectedNode} onChange={e => setSelectedNode(e.target.value)}><option value="">All hubs</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.node_name || n.node_id}</option>)}</select></label><HubStatus nodes={visible} loading={resource.loading} error={resource.error} /><button className="text-emerald-700 underline text-sm" onClick={resource.reload}>Refresh devices</button></div>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.error && resource.data && <p className="text-amber-700 text-sm">Device data is stale.</p>}
    {!resource.loading && !resource.error && !nodes.length && <section className="panel"><p className="mb-3">Link a GreenNode before registering devices.</p><Link className="primary-button inline-block" href={`/claim?greenhouse=${greenhouseId}`}>Add hub</Link></section>}
    <div className="flex flex-wrap gap-2" aria-label="Device category">{['all','hub','sensor','actuator'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm capitalize ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>{f === 'all' ? 'All devices' : `${f}s`}</button>)}</div>
    {(filter === 'all' || filter === 'hub') && <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{visible.map(n => <article className="panel space-y-3" key={n.id}><h3 className="font-semibold">{n.node_name || n.node_id}</h3><p className="text-sm text-slate-500">{n.node_id}</p><StatusBadge tone={resource.error ? 'pending' : n.is_online ? 'success' : 'neutral'}>{n.is_online ? 'Online' : 'Offline'}{resource.error ? ' (last known)' : ''}</StatusBadge><p className="text-xs text-slate-500">Heartbeat: {timeAgo(n.last_seen)} · v{n.software_version}</p></article>)}</section>}
    {(filter === 'all' || filter === 'sensor') && <section><h3 className="font-semibold mb-3">Sensors ({sensors.length})</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{sensors.map(s => {
      const readings = resource.data?.summary.tiles.filter(t => t.node_id === s.node && t.device_id === s.sensor_id) ?? [];
      return <article key={s.id} className="panel space-y-3"><div className="flex justify-between gap-2"><h4 className="font-medium">{s.sensor_type}</h4><StatusBadge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Enabled' : 'Disabled'}</StatusBadge></div><p className="text-xs text-slate-500">{s.sensor_id} · {s.hub.node_name || s.hub.node_id}</p>{readings.length ? readings.map(t => <div key={t.sensor_id}><p className="text-xl font-semibold">{t.value ?? 'No data'} {t.value !== null ? t.unit : ''}</p><p className="text-xs text-slate-500">{t.sensor_kind.replaceAll('_',' ')} · {timeAgo(t.updated_at)}</p></div>) : <p className="text-slate-500">No readings received</p>}</article>;
    })}</div>{!sensors.length && <p className="text-sm text-slate-500">No sensors registered for this selection.</p>}</section>}
    {(filter === 'all' || filter === 'actuator') && <section><h3 className="font-semibold mb-3">Actuators ({actuators.length})</h3><div className="grid sm:grid-cols-2 gap-4">{actuators.map(a => <article className="panel" key={a.id}><ActuatorControl id={a.id} name={`${a.actuator_type} (${a.actuator_id})`} /></article>)}</div>{!actuators.length && <p className="text-sm text-slate-500">No actuators registered for this selection.</p>}</section>}
    {!!nodes.length && <RegisterDevice nodes={visible} onSaved={resource.reload} />}
  </div>;
}
export default function DevicesPage() {
  const resource = useResource(getGreenhouses);
  const [selected, setSelected] = useState<number | null>(null);
  const greenhouse = resource.data?.find(g => g.id === selected) ?? resource.data?.[0];
  return <><Topbar greenhouses={resource.data ?? []} selectedGreenhouseId={greenhouse?.id} onSelectGreenhouse={setSelected} onRefresh={resource.reload} /><div className="page-content"><div className="flex justify-between gap-4"><div><h1 className="text-2xl font-bold">Devices</h1><p className="text-slate-500">Your hubs, sensors, and confirmed equipment states.</p></div><Link className="text-emerald-700 underline self-start" href={`/claim${greenhouse ? `?greenhouse=${greenhouse.id}` : ''}`}>Add hub</Link></div><ResourceState {...resource} retry={resource.reload} />{greenhouse ? <DeviceScope key={greenhouse.id} greenhouseId={greenhouse.id} /> : !resource.loading && !resource.error && <Link className="text-emerald-700 underline" href="/greenhouses">Create a greenhouse to add devices</Link>}</div></>;
}
