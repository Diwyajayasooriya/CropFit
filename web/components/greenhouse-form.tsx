"use client";
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/store/toast-store';
import type { Greenhouse } from '@/types';
export function GreenhouseForm({ greenhouse, onSaved }: { greenhouse?: Greenhouse; onSaved: (saved: Greenhouse) => void }) {
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState<string | null>(null);
 async function submit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault(); const form = e.currentTarget; const values = new FormData(form);
  const body = { name: String(values.get('name')).trim(), location: String(values.get('location')).trim(), crop: String(values.get('crop')).trim(), plantation_date: values.get('plantation_date') || null };
  setBusy(true); setError(null);
  try { const saved = greenhouse ? await apiFetch.patch<Greenhouse>(`/greenhouses/${greenhouse.id}/`, body) : await apiFetch.post<Greenhouse>('/greenhouses/', body); toast.success('Greenhouse saved.'); if (!greenhouse) form.reset(); onSaved(saved); }
  catch(error) { setError(error instanceof Error ? error.message : 'Could not save greenhouse.'); }
  finally { setBusy(false); }
 }
 return <form onSubmit={submit} className="panel space-y-4"><h3 className="font-semibold">{greenhouse ? `Edit ${greenhouse.name}` : 'Add greenhouse'}</h3><div className="grid sm:grid-cols-2 gap-4"><label>Name<input className="field" name="name" required maxLength={100} defaultValue={greenhouse?.name} /></label><label>Location<input className="field" name="location" required defaultValue={greenhouse?.location} /></label><label>Crop<input className="field" name="crop" required defaultValue={greenhouse?.crop} /></label><label>Plantation date<input className="field" type="date" name="plantation_date" defaultValue={greenhouse?.plantation_date ?? ''} /></label></div>{error && <p role="alert" className="text-rose-700">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save greenhouse'}</button></form>;
}
