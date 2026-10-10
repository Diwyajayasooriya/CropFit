'use client';

import Link from 'next/link';
import type { GreenNode } from '@/lib/api-functions';
import { timeAgo } from '@/lib/utils';

export function SidebarHubStatus({ nodes, loading, error, onRetry }: {
  nodes: GreenNode[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <section aria-label="Your GreenNode hubs" className="space-y-2">
      <h2 className="text-xs font-semibold text-slate-600">Your GreenNode hubs</h2>
      {error ? (
        <div role="status" className="text-xs text-amber-700">
          Hub status unavailable.
          <button onClick={onRetry} className="ml-2 underline cursor-pointer">Retry</button>
        </div>
      ) : loading ? (
        <p role="status" className="text-xs text-slate-500">Loading hubs...</p>
      ) : nodes?.length === 0 ? (
        <p className="text-xs text-slate-500">No hubs linked. <Link href="/claim" className="underline text-emerald-700">Add a hub</Link></p>
      ) : null}
      <div className="max-h-52 overflow-y-auto space-y-2">
        {nodes?.map(node => {
          const online = !error && !loading && node.is_online;
          const status = error || loading ? 'Status unknown' : online ? 'Online' : 'Offline';
          return (
            <Link key={node.id} href={`/greenhouses/${node.greenHouse}`} className="block p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-emerald-400">
              <p className="text-xs font-semibold text-slate-800 break-words">{node.node_name || 'GreenNode'}</p>
              <p className="text-[11px] font-mono text-slate-500 mt-1 break-all">{node.node_id}</p>
              <p className={`flex items-center gap-1.5 mt-2 text-xs ${online ? 'text-emerald-700' : 'text-slate-500'}`}>
                <span aria-hidden="true" className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {status}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Last seen: {timeAgo(node.last_seen)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
