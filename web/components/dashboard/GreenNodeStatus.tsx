'use client';

import React from 'react';
import type { GreenNode } from '@/lib/api-functions';
import { Card, CardHeader, CardTitle, StatusBadge } from '@/components/ui';
import { WifiIcon, CloudIcon, CloudOffIcon, ShieldIcon } from '@/components/icons';
import { timeAgo } from '@/lib/utils';

interface GreenNodeStatusProps {
  nodes?: GreenNode[];
  cloudConnected?: boolean;
}

export function GreenNodeStatus({
  nodes = [],
  cloudConnected = true,
}: GreenNodeStatusProps) {
  const primaryNode = nodes[0];
  const isHubOnline = primaryNode ? primaryNode.is_online : true;
  const hubId = primaryNode?.node_id || 'GN-HUB-C554';
  const lastSync = primaryNode?.last_seen ? timeAgo(primaryNode.last_seen) : '5 sec ago';

  const totalSensors = primaryNode?.sensors?.length || 4;
  const activeSensors = primaryNode?.sensors?.filter((s) => s.is_active)?.length ?? 4;

  return (
    <Card className="flex flex-col h-full shadow-xs border-slate-200/90">
      <CardHeader className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <WifiIcon size={16} />
          </div>
          <div>
            <CardTitle className="text-base">GreenNode Status</CardTitle>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{hubId}</p>
          </div>
        </div>

        <StatusBadge status={isHubOnline ? 'online' : 'offline'} showDot />
      </CardHeader>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Status Metrics List */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Hub</span>
            <span className={`font-semibold ${isHubOnline ? 'text-emerald-700' : 'text-slate-600'}`}>
              {isHubOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Cloud</span>
            <span className={`font-semibold flex items-center gap-1.5 ${
              cloudConnected ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {cloudConnected ? <CloudIcon size={14} /> : <CloudOffIcon size={14} />}
              {cloudConnected ? 'Connected' : 'Sync Paused'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Sensors</span>
            <span className="font-semibold text-slate-800">
              {activeSensors}/{totalSensors} online
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 font-medium">Last sync</span>
            <span className="font-semibold text-slate-800">{lastSync}</span>
          </div>
        </div>

        {/* Local Automation Banner */}
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
          cloudConnected
            ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800'
            : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
        }`}>
          <ShieldIcon size={16} className={cloudConnected ? 'text-emerald-600' : 'text-amber-600'} />
          <div>
            <p className="font-semibold">
              {cloudConnected
                ? 'Local automation running normally.'
                : 'Local automation running — Cloud sync paused.'}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              Edge node executes climate targets offline.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
