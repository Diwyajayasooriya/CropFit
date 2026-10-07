'use client';
import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { usePollingResource } from '@/hooks/use-polling-resource';
import { StatusBadge } from '@/components/status-badge';
import { toast } from '@/lib/store/toast-store';
import { timeAgo } from '@/lib/utils';

interface Command { id: string; created_at: string; action: 'ON' | 'OFF'; status: 'pending' | 'delivered' | 'confirmed' | 'failed' | 'expired'; error: string }
interface CommandStatus { command: Command | null; is_active: boolean; confirmed_at: string | null }
export function ActuatorControl({ id, name }: { id: number; name: string }) {
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState<Command | null>(null);
  const load = useCallback(async () => {
    const result = await apiFetch.get<CommandStatus>(`/nodes/actuators/${id}/command-status/`);
    setSubmitted(previous => previous && result.command && (previous.id === result.command.id || result.command.created_at >= previous.created_at) ? null : previous);
    return result;
  }, [id]);
  const resource = usePollingResource(load, 5000);
  const pending = useRef(false);
  const command = submitted && resource.data?.command?.id !== submitted.id ? submitted : resource.data?.command;
  const waiting = command?.status === 'pending' || command?.status === 'delivered';
  const disabled = sending || waiting || resource.loading || !!resource.error;
  async function send(action: 'ON' | 'OFF') {
    if (pending.current || disabled) return;
    pending.current = true; setSending(true);
    try {
      const result = await apiFetch.post<Command>(`/nodes/actuators/${id}/command/`, { action });
      setSubmitted(result); resource.reload(); toast.success(`Command requested for ${name}. Waiting for hardware confirmation.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Command request failed.'); resource.reload(); }
    finally { pending.current = false; setSending(false); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h4 className="font-medium">{name}</h4><StatusBadge tone={resource.error ? 'pending' : resource.data?.confirmed_at ? 'success' : 'neutral'}>{resource.data?.confirmed_at ? `Last confirmed: ${resource.data.is_active ? 'ON' : 'OFF'}` : 'State unconfirmed'}</StatusBadge></div>
    {resource.data?.confirmed_at && <p className="text-xs text-slate-500">Confirmed {timeAgo(resource.data.confirmed_at)}</p>}
    {command && <p role="status" className={`text-sm ${['failed', 'expired'].includes(command.status) ? 'text-rose-700' : 'text-slate-600'}`}>{waiting ? `Requested ${command.action} — waiting for hub confirmation…` : command.status === 'confirmed' ? `${command.action} confirmed by device.` : `${command.status === 'expired' ? 'Confirmation timed out' : 'Command failed'}. ${command.error}`}</p>}
    {resource.error && <p role="alert" className="text-sm text-amber-700">Command status unavailable; displayed state may be stale. <button className="underline" onClick={resource.reload}>Retry</button></p>}
    <div className="flex gap-2"><button className="primary-button text-sm" disabled={disabled} onClick={() => send('ON')} aria-label={`Turn ${name} on`}>Turn on</button><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" disabled={disabled} onClick={() => send('OFF')} aria-label={`Turn ${name} off`}>Turn off</button></div>
  </div>;
}
