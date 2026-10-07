"use client";
import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { list, getGreenhouses } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { Topbar } from '@/components/layout/Topbar';
import { ResourceState } from '@/components/resource-state';
import { toast } from '@/lib/store/toast-store';
import type { Alert } from '@/types';
export default function AlertsPage() {
 const [severity,setSeverity] = useState('');
 const [resolved,setResolved] = useState('false');
 const [greenhouse,setGreenhouse] = useState('');
 const [busy,setBusy] = useState<string | null>(null);
 const greenhouses = useResource(getGreenhouses);
 const load = useCallback(() => list<Alert>(`/alerts/?severity=${severity}${resolved ? `&resolved=${resolved}` : ''}${greenhouse ? `&greenhouse=${greenhouse}` : ''}`), [severity,resolved,greenhouse]);
 const resource = useResource(load);
 async function acknowledge(id: string) {
  setBusy(id);
  try { await apiFetch.patch(`/alerts/${id}/acknowledge/`, {}); resource.reload(); toast.success('Alert resolved.'); }
  catch (error) { toast.error(error instanceof Error ? error.message : 'Could not resolve alert.'); }
  finally { setBusy(null); }
 }
 return <><Topbar onRefresh={resource.reload} /><div className="page-content"><h2 className="text-2xl font-bold">Alerts & notifications</h2><div className="flex flex-wrap gap-4">
 <label>Greenhouse<select className="field" value={greenhouse} onChange={e => setGreenhouse(e.target.value)}><option value="">All greenhouses</option>{greenhouses.data?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
 <label>Severity<select className="field" value={severity} onChange={e => setSeverity(e.target.value)}><option value="">All severities</option><option>critical</option><option>warning</option><option>info</option></select></label>
 <label>Status<select className="field" value={resolved} onChange={e => setResolved(e.target.value)}><option value="false">Unresolved</option><option value="true">Resolved</option><option value="">All statuses</option></select></label></div>
 <ResourceState {...resource} retry={resource.reload} />{!resource.loading && !resource.error && !resource.data?.length && <p>No alerts match these filters.</p>}
 {resource.data?.map(a => <article className="panel" key={a.id}><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{a.title} <span className="text-xs uppercase text-slate-500">{a.severity}</span></h3>{a.is_resolved ? <span>Resolved</span> : <button className="text-emerald-700 underline disabled:opacity-50" disabled={busy !== null} onClick={() => acknowledge(a.id)}>{busy === a.id ? 'Resolving...' : 'Acknowledge'}</button>}</div><p className="text-slate-600 mt-2">{a.message}</p><time className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</time></article>)}</div></>;
}
