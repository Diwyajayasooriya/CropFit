import Link from 'next/link';
import type { GreenNode } from '@/lib/api-functions';
import { timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export function HubStatus({ nodes, loading = false, error = null }: { nodes: GreenNode[]; loading?: boolean; error?: string | null }) {
  if (loading) return <span role="status" className="text-sm text-slate-500 animate-pulse">Checking hubs…</span>;
  if (error && !nodes.length) return <span role="status" className="text-sm text-amber-700">Hub status unavailable</span>;
  if (!nodes.length) return <Link className="text-sm text-emerald-700 underline" href="/claim">Add your first hub</Link>;
  const online = nodes.filter(node => node.is_online).length;
  return <details className="relative text-sm">
    <summary className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 focus-visible:outline-emerald-600">
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${error ? 'bg-amber-500' : online === nodes.length ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
      {error ? 'Hub status stale' : nodes.length === 1 ? `Cloud connection: ${online ? 'Online' : 'Offline'}` : `${online} of ${nodes.length} hubs online`}
    </summary>
    <div className="absolute right-0 top-full mt-2 w-72 max-w-[85vw] max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-lg z-40 space-y-3">
      {error && <p className="text-amber-700">Refresh failed. Showing last known status.</p>}
      {nodes.map(node => <div key={node.id} className="space-y-1 border-b border-slate-100 pb-3 last:border-0">
        <p className="font-semibold">{node.node_name || node.node_id}</p>
        <p className="text-xs text-slate-500">{node.node_id}</p>
        <StatusBadge tone={error ? 'pending' : node.is_online ? 'success' : 'neutral'}>{node.is_online ? 'Online' : 'Offline'}{error ? ' (last known)' : ''}</StatusBadge>
        <p>Heartbeat: {timeAgo(node.last_seen)}</p>
        <p className="text-xs text-slate-500">Version {node.software_version || 'unknown'} · Uptime {Math.floor((node.uptime_seconds ?? 0) / 60)} min</p>
        {node.ip_address && <p className="text-xs text-slate-500">IP address: {node.ip_address}</p>}
      </div>)}
      <p className="text-xs text-slate-500">Online means a heartbeat reached CropFit within 90 seconds.</p>
    </div>
  </details>;
}
