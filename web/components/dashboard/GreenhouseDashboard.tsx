'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getGreenhouses, getNodes, getThresholds, list, type GreenNode } from '@/lib/api-functions';
import { useResource } from '@/hooks/use-resource';
import { usePollingResource } from '@/hooks/use-polling-resource';
import { useAuthStore } from '@/lib/store/auth-store';
import { ResourceState } from '@/components/resource-state';
import { GreenhouseHeader } from './GreenhouseHeader';
import { SensorGrid } from './SensorGrid';
import { SensorHistory } from './SensorHistory';
import { RecommendationCard } from './RecommendationCard';
import { AutomaticControls } from './AutomaticControls';
import { RecentAlerts } from './RecentAlerts';
import { GreenNodeStatus } from './GreenNodeStatus';
import { Card, Button, LoadingSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { SproutIcon, WifiIcon, PlusIcon } from '@/components/icons';
import type { Alert, DashboardSummary, Greenhouse } from '@/types';

function SelectedDashboard({
  greenhouse,
  greenhouses,
  select,
}: {
  greenhouse: Greenhouse;
  greenhouses: Greenhouse[];
  select: (id: number) => void;
}) {
  const loadNodes = useCallback(() => getNodes(greenhouse.id), [greenhouse.id]);
  const hubs = usePollingResource(loadNodes, 15000);

  const load = useCallback(async () => {
    const [summary, alerts, thresholds] = await Promise.all([
      apiFetch.get<DashboardSummary>(`/reports/dashboard/?greenhouse=${greenhouse.id}`),
      list<Alert>(`/alerts/?greenhouse=${greenhouse.id}&resolved=false`),
      getThresholds(greenhouse.id),
    ]);
    return { summary, alerts, thresholds };
  }, [greenhouse.id]);

  const resource = usePollingResource(load, 15000);

  const refreshAll = () => {
    hubs.reload();
    resource.reload();
  };

  const isStale = Boolean(resource.error && resource.data);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-7 animate-page-in">
      {/* ── 1. Greenhouse Header (Greeting, switcher, hero banner, health card) ── */}
      <GreenhouseHeader
        greenhouse={greenhouse}
        greenhouses={greenhouses}
        selectedGreenhouseId={greenhouse.id}
        onSelectGreenhouse={select}
        summary={resource.data?.summary}
        nodes={hubs.data ?? []}
        onRefresh={refreshAll}
        refreshing={resource.loading || hubs.loading}
      />

      {/* Warnings & Stale notice */}
      {isStale && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center justify-between">
          <span>Readings are stale. Showing the last successful refresh.</span>
          <button onClick={refreshAll} className="underline font-semibold cursor-pointer">
            Retry sync
          </button>
        </div>
      )}

      {/* Unlinked Hub Notice */}
      {!hubs.loading && !hubs.error && hubs.data?.length === 0 && (
        <Card className="p-6 border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <WifiIcon size={18} className="text-emerald-600" />
              No GreenNode hub linked to this greenhouse yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Connect and claim your physical GreenNode hub to automatically sync sensors and local automation.
            </p>
          </div>
          <Link href={`/claim?greenhouse=${greenhouse.id}`} className="shrink-0">
            <Button variant="primary" size="sm">
              Claim GreenNode Hub
            </Button>
          </Link>
        </Card>
      )}

      {/* ── 2. Four Main Sensor Cards (Temperature, Humidity, Soil Moisture, CO₂) ── */}
      <section aria-label="Current Sensor Readings">
        <SensorGrid tiles={resource.data?.summary?.tiles ?? []} />
      </section>

      {/* ── 3. Sensor History Chart & CropFit Recommendation ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SensorHistory
            greenhouseId={greenhouse.id}
            tiles={resource.data?.summary?.tiles ?? []}
            thresholds={resource.data?.thresholds ?? []}
          />
        </div>
        <div className="lg:col-span-1">
          <RecommendationCard
            alerts={resource.data?.alerts ?? []}
            nodes={hubs.data ?? []}
          />
        </div>
      </section>

      {/* ── 4. Automatic Controls, Recent Alerts, GreenNode Status ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AutomaticControls actuators={resource.data?.summary?.actuators ?? []} />
        <RecentAlerts alerts={resource.data?.alerts ?? []} />
        <GreenNodeStatus
          nodes={hubs.data ?? []}
          cloudConnected={!resource.error}
        />
      </section>
    </div>
  );
}

export function GreenhouseDashboard({ greenhouseId }: { greenhouseId?: number }) {
  const resource = useResource(getGreenhouses);
  const [selected, setSelected] = useState<number | null>(null);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (greenhouseId === undefined && user?.onboarding_completed === false) {
      router.replace('/onboarding');
    }
  }, [user, router, greenhouseId]);

  const greenhouse = resource.data?.find(
    (g) => g.id === (greenhouseId ?? selected ?? resource.data?.[0]?.id)
  );

  const select = (id: number) => {
    if (greenhouseId !== undefined) {
      router.push(`/greenhouses/${id}`);
    } else {
      setSelected(id);
    }
  };

  // If loading greenhouse list
  if (resource.loading && !resource.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <LoadingSkeleton className="h-16 w-1/3" />
        <LoadingSkeleton className="h-44 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoadingSkeleton className="h-36" />
          <LoadingSkeleton className="h-36" />
          <LoadingSkeleton className="h-36" />
          <LoadingSkeleton className="h-36" />
        </div>
      </div>
    );
  }

  // If API error loading greenhouses
  if (resource.error && !resource.data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ErrorState
          title="Could not load greenhouses"
          message={resource.error}
          retry={resource.reload}
        />
      </div>
    );
  }

  // Active greenhouse found
  if (greenhouse) {
    return (
      <SelectedDashboard
        key={greenhouse.id}
        greenhouse={greenhouse}
        greenhouses={resource.data!}
        select={select}
      />
    );
  }

  // No greenhouses registered yet
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <EmptyState
        icon={<SproutIcon size={36} className="text-emerald-600" />}
        title={greenhouseId !== undefined ? 'Greenhouse not found' : 'No greenhouses configured yet'}
        description="Create your first greenhouse to begin telemetry monitoring, automation targets, and hub linking."
        action={
          <Link href="/greenhouses">
            <Button variant="primary">
              <PlusIcon size={16} />
              <span>Create Greenhouse</span>
            </Button>
          </Link>
        }
      />
    </div>
  );
}
