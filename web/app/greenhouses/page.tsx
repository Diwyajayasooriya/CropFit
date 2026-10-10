'use client';

import React, { useState } from 'react';
import { getGreenhouses, getNodes } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { usePollingResource } from '@/hooks/use-polling-resource';
import { GreenhouseCard } from '@/components/greenhouse/GreenhouseCard';
import { AddGreenhouseModal } from '@/components/greenhouse/AddGreenhouseModal';
import {
  Button,
  LoadingSkeleton,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import { SproutIcon, PlusIcon, RefreshIcon } from '@/components/icons';

export default function GreenhousesPage() {
  const resource = useResource(getGreenhouses);
  const hubs = usePollingResource(getNodes, 15000);
  const [modalOpen, setModalOpen] = useState(false);
  const refresh = () => { resource.reload(); hubs.reload(); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-page-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Greenhouses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor, manage, and configure your protected cultivation facilities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={resource.loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:border-slate-300 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            title="Refresh greenhouse list"
            aria-label="Refresh"
          >
            <RefreshIcon size={18} className={resource.loading ? 'animate-spin text-emerald-600' : ''} />
          </button>

          <Button variant="primary" onClick={() => setModalOpen(true)}>
            <PlusIcon size={16} />
            <span>Add Greenhouse</span>
          </Button>
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
      {resource.loading && !resource.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LoadingSkeleton className="h-56" />
          <LoadingSkeleton className="h-56" />
          <LoadingSkeleton className="h-56" />
        </div>
      )}

      {/* ── Error State ── */}
      {resource.error && !resource.data && (
        <ErrorState
          title="Could not load greenhouses"
          message={resource.error}
          retry={resource.reload}
        />
      )}

      {/* ── Empty State ── */}
      {!resource.loading && !resource.error && resource.data?.length === 0 && (
        <EmptyState
          icon={<SproutIcon size={40} className="text-emerald-600" />}
          title="No greenhouses created yet"
          description="Create your first greenhouse to start pairing GreenNode edge hubs and collecting real-time climate telemetry."
          action={
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <PlusIcon size={16} />
              <span>Add Your First Greenhouse</span>
            </Button>
          }
        />
      )}

      {/* ── Greenhouses Grid ── */}
      {resource.data && resource.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resource.data.map((greenhouse) => (
            <GreenhouseCard
              key={greenhouse.id}
              greenhouse={greenhouse}
              nodes={hubs.data ?? []}
              loading={hubs.loading}
              nodesError={hubs.error}
              onRetry={hubs.reload}
            />
          ))}
        </div>
      )}

      {/* Add Greenhouse Modal */}
      <AddGreenhouseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
