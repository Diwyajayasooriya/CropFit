"use client";
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch, ApiRequestError } from '@/lib/api';
import { getGreenhouses, type ClaimResult } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { ResourceState } from '@/components/resource-state';
import { GreenhouseForm } from '@/components/greenhouse-form';
import { toast } from '@/lib/store/toast-store';

function ClaimForm() {
  const params = useSearchParams();
  const resource = useResource(getGreenhouses);
  const [device, setDevice] = useState(params.get('device_id') ?? params.get('device') ?? '');
  const [code, setCode] = useState(params.get('code') ?? '');
  const [greenhouse, setGreenhouse] = useState(params.get('greenhouse') ?? '');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ClaimResult | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const selected = resource.data?.find(g => String(g.id) === greenhouse)?.id ?? resource.data?.[0]?.id;
  useEffect(() => {
    if (!retryAt) return;
    const update = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !selected || Date.now() < retryAt) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const result = await apiFetch.post<ClaimResult>('/nodes/claim/', { device_id: device.trim(), claim_code: code.trim().toUpperCase(), greenhouse_id: selected });
      setSuccess(result); toast.success(result.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Claim failed. Please try again.');
      if (error instanceof ApiRequestError && error.status === 429 && error.data.retry_after_seconds) {
        setRemaining(error.data.retry_after_seconds);
        setRetryAt(Date.now() + error.data.retry_after_seconds * 1000);
      }
    } finally { pending.current = false; setBusy(false); }
  }
  return <>
    <ol className="flex gap-2 text-xs text-slate-500" aria-label="Setup progress"><li>1. Connect hub</li><li>→ 2. Link greenhouse</li><li>→ 3. View readings</li></ol>
    <ResourceState {...resource} retry={resource.reload} />
    {success ? <div role="status" className="rounded-xl bg-emerald-50 p-5 space-y-3"><h2 className="font-semibold text-emerald-800">Hub linked successfully</h2><p>{success.device_id} is now linked to {success.greenhouse_name}.</p><Link className="primary-button inline-block" href={`/greenhouses/${success.greenhouse_id}`}>View greenhouse dashboard</Link></div> : <>
      {resource.data?.length === 0 && !resource.error && <div className="space-y-3"><p>Create a greenhouse below. Your hub details will stay in this form.</p><GreenhouseForm onSaved={created => { setGreenhouse(String(created.id)); resource.reload(); }} /></div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Device ID<input className="field" required maxLength={100} autoComplete="off" value={device} onChange={e => setDevice(e.target.value)} placeholder="GN-HUB-001" /></label>
        <label className="block text-sm font-medium">Claim code<input className="field uppercase" required maxLength={32} autoComplete="off" value={code} onChange={e => setCode(e.target.value)} aria-describedby="claim-help" /></label>
        <p id="claim-help" className="text-xs text-slate-500">Use the device ID and claim code printed on your hub label.</p>
        <label className="block text-sm font-medium">Greenhouse<select className="field" required value={selected ?? ''} onChange={e => setGreenhouse(e.target.value)}><option value="" disabled>Select greenhouse</option>{resource.data?.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {remaining > 0 && <p className="text-sm text-amber-700">You can try again in {remaining} seconds.</p>}
        <button className="primary-button w-full" disabled={busy || !selected || !!resource.error || remaining > 0}>{busy ? 'Linking hub…' : 'Claim & link hub'}</button>
      </form>
    </>}
  </>;
}
export default function ClaimPage() {
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><section className="panel max-w-xl w-full space-y-5 shadow-sm"><p className="text-xs uppercase tracking-widest font-semibold text-emerald-700">CropFit · GreenNode setup</p><h1 className="text-2xl font-bold">Link your GreenNode hub</h1><p className="text-sm text-slate-500">First connect your hub to your router using its setup hotspot. Once it registers with CropFit, link it to your greenhouse here.</p><Suspense fallback={<p>Loading claim details…</p>}><ClaimForm /></Suspense><Link className="block text-sm text-emerald-700 underline" href="/">Back to dashboard</Link></section></main>;
}
