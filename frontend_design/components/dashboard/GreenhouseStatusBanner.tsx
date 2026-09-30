"use client";

import type { GreenhouseStatus } from "@/api/types";

interface GreenhouseStatusBannerProps {
  status: GreenhouseStatus;
}

const statusConfig: Record<
  GreenhouseStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string; icon: string }
> = {
  good: {
    label: "All systems nominal — greenhouse conditions are optimal",
    bgClass: "bg-gn-green/8",
    textClass: "text-gn-green-light",
    borderClass: "border-gn-green/25",
    icon: "✓",
  },
  needs_control: {
    label: "Some conditions are outside target range — adjustments recommended",
    bgClass: "bg-gn-amber/8",
    textClass: "text-gn-amber",
    borderClass: "border-gn-amber/25",
    icon: "⚠",
  },
  warning: {
    label: "Critical conditions detected — immediate attention required",
    bgClass: "bg-red-500/8",
    textClass: "text-red-400",
    borderClass: "border-red-500/25",
    icon: "✕",
  },
};

export default function GreenhouseStatusBanner({
  status,
}: GreenhouseStatusBannerProps) {
  const config = statusConfig[status];

  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-3 rounded-xl border",
        config.bgClass,
        config.borderClass,
      ].join(" ")}
    >
      <span className={`text-sm ${config.textClass}`}>{config.icon}</span>
      <span className={`text-sm font-body ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}
