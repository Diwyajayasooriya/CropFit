"use client";

import { useEffect } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import MetricCard from "./MetricCard";
import GreenhouseStatusBanner from "./GreenhouseStatusBanner";
import Button from "@/components/ui/Button";

export default function GreenhouseMonitorZone() {
  const { greenhouse, fetchGreenhouse } = useDashboardStore();

  useEffect(() => {
    fetchGreenhouse();
  }, [fetchGreenhouse]);

  const { data, loading, error } = greenhouse;

  return (
    <section className="flex flex-col gap-4">
      {/* Zone Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-heading font-semibold text-gn-text tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gn-green-light animate-pulse" />
            GreenHouse Monitor
          </h2>
          <p className="text-xs text-gn-text-muted mt-0.5">
            Real-time microclimate sensors & environmental telemetry
          </p>
        </div>
        <span className="text-[11px] font-mono text-gn-text-dim px-2.5 py-1 rounded-full bg-gn-surface-raised border border-gn-text-dim/10">
          Sync: 1s
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-gn-amber/30 bg-gn-amber/5 text-gn-amber text-xs flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-gn-surface/80 border border-gn-text-dim/10 animate-pulse h-32 flex flex-col justify-between"
            >
              <div className="h-3 w-1/2 rounded bg-gn-surface-raised" />
              <div className="h-7 w-2/3 rounded bg-gn-surface-raised" />
              <div className="h-6 w-full rounded bg-gn-surface-raised" />
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {data.metrics.map((metric, index) => (
            <MetricCard key={metric.id} metric={metric} delay={index + 1} />
          ))}
        </div>
      )}

      {/* Status Banner */}
      {data && (
        <GreenhouseStatusBanner status={data.overallStatus} />
      )}

      {/* Advanced Settings Row */}
      <div className="flex justify-end pt-1">
        <Button variant="ghost" size="sm" className="text-xs text-gn-text-muted hover:text-gn-text">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 2v2M8 12v2M2 8h2M12 8h2M3.76 3.76l1.42 1.42M10.82 10.82l1.42 1.42M3.76 12.24l1.42-1.42M10.82 5.18l1.42-1.42"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
          Sensor settings & calibration
        </Button>
      </div>
    </section>
  );
}
