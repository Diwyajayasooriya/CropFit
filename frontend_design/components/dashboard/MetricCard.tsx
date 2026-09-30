"use client";

import DashboardCard from "./DashboardCard";
import SparklineBar from "./SparklineBar";
import type { GreenhouseMetric } from "@/api/types";

interface MetricCardProps {
  metric: GreenhouseMetric;
  delay: number;
}

export default function MetricCard({ metric, delay }: MetricCardProps) {
  return (
    <DashboardCard variant="green" delay={delay} className="flex flex-col justify-between">
      {/* Label */}
      <p className="text-[11px] uppercase tracking-wider text-gn-text-muted font-mono mb-2">
        {metric.label}
      </p>

      {/* Value */}
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl font-heading font-bold text-gn-text">
          {metric.value.toLocaleString()}
        </span>
        <span className="text-sm text-gn-text-muted font-body">
          {metric.unit}
        </span>
      </div>

      {/* Sparkline */}
      <div className="border-t border-gn-text-dim/8 pt-2">
        <SparklineBar data={metric.trendData} height={32} />
      </div>
    </DashboardCard>
  );
}
