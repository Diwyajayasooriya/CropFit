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
import { ActuatorDeviceCard, DeviceCategoryCards, HubDeviceCard, SensorDeviceCard } from '@/components/devices/DeviceCards';
import { toast } from '@/lib/store/toast-store';
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
  const resource = usePollingResource(load, 15000);
  const nodes = resource.data?.nodes ?? [];
  const visible = nodes.filter(n => !selectedNode || String(n.id) === selectedNode);
  const sensors = visible.flatMap(n => n.sensors.map(s => ({ ...s, hub: n })));
  const actuators = visible.flatMap(n => n.actuators.map(a => ({ ...a, hub: n })));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm">Hub<select className="field" value={selectedNode} onChange={e => setSelectedNode(e.target.value)}><option value="">All hubs</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.node_name || n.node_id}</option>)}</select></label><HubStatus nodes={visible} loading={resource.loading} error={resource.error} /><button className="text-emerald-700 underline text-sm" onClick={resource.reload}>Refresh devices</button></div>
    <ResourceState {...resource} retry={resource.reload} />
    {resource.error && resource.data && <p className="text-amber-700 text-sm">Device data is stale.</p>}
    {!resource.loading && !resource.error && !nodes.length && <section className="panel"><p className="mb-3">Link a GreenNode before registering devices.</p><Link className="primary-button inline-block" href={`/claim?greenhouse=${greenhouseId}`}>Add hub</Link></section>}
    <DeviceCategoryCards selected={filter} onSelect={setFilter} counts={{
      all: resource.data ? visible.length + sensors.length + actuators.length : null,
      hub: resource.data ? visible.length : null,
      sensor: resource.data ? sensors.length : null,
      actuator: resource.data ? actuators.length : null,
    }} />
    {(filter === 'all' || filter === 'hub') && <section aria-label="GreenNode hubs" className="space-y-3">
      <h3 className="font-semibold text-slate-900">GreenNode hubs</h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{visible.map(hub => <HubDeviceCard key={hub.id} hub={hub} stale={Boolean(resource.error)} />)}</div>
      {resource.data && !visible.length && <p className="text-sm text-slate-500">No hubs for this selection.</p>}
    </section>}
    {(filter === 'all' || filter === 'sensor') && <section aria-label="Sensors" className="space-y-3">
      <h3 className="font-semibold text-slate-900">Sensors</h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{sensors.map(sensor => <SensorDeviceCard
        key={sensor.id} sensor={sensor} hub={sensor.hub} stale={Boolean(resource.error)}
        readings={resource.data?.summary.tiles.filter(t => t.node_id === sensor.node && t.device_id === sensor.sensor_id) ?? []}
      />)}</div>
      {resource.data && !sensors.length && <p className="text-sm text-slate-500">No sensors registered for this selection.</p>}
    </section>}
    {(filter === 'all' || filter === 'actuator') && <section aria-label="Actuators" className="space-y-3">
      <h3 className="font-semibold text-slate-900">Actuators</h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{actuators.map(actuator => <ActuatorDeviceCard key={actuator.id} actuator={actuator} hub={actuator.hub} stale={Boolean(resource.error)} />)}</div>
      {resource.data && !actuators.length && <p className="text-sm text-slate-500">No actuators registered for this selection.</p>}
    </section>}
    {!!nodes.length && <RegisterDevice nodes={visible} onSaved={resource.reload} />}
  </div>;
}
export default function DevicesPage() {
  const resource = useResource(getGreenhouses);
  const [selected, setSelected] = useState<number | null>(null);
  const greenhouse = resource.data?.find(g => g.id === selected) ?? resource.data?.[0];
  return <><Topbar greenhouses={resource.data ?? []} selectedGreenhouseId={greenhouse?.id} onSelectGreenhouse={setSelected} onRefresh={resource.reload} /><div className="page-content"><div className="flex justify-between gap-4"><div><h1 className="text-2xl font-bold">Devices</h1><p className="text-slate-500">Your hubs, sensors, and confirmed equipment states.</p></div><Link className="text-emerald-700 underline self-start" href={`/claim${greenhouse ? `?greenhouse=${greenhouse.id}` : ''}`}>Add hub</Link></div><ResourceState {...resource} retry={resource.reload} />{greenhouse ? <DeviceScope key={greenhouse.id} greenhouseId={greenhouse.id} /> : !resource.loading && !resource.error && <Link className="text-emerald-700 underline" href="/greenhouses">Create a greenhouse to add devices</Link>}</div></>;
}
