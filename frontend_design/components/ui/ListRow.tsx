"use client";

import type { ReactNode } from "react";

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Status dot / icon shown before the title. */
  leading?: ReactNode;
  /** Badges rendered under the title. */
  badges?: ReactNode;
  /** Right-aligned controls (toggle, edit, delete…). */
  actions?: ReactNode;
  accent?: "green" | "amber";
  dimmed?: boolean;
}

/** Compact row used for lists in settings (schedules, pinned devices). */
export default function ListRow({
  title,
  subtitle,
  leading,
  badges,
  actions,
  accent = "green",
  dimmed = false,
}: ListRowProps) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-3 p-3 rounded-xl border bg-gn-surface-raised/60 transition-all",
        accent === "green"
          ? "border-gn-text-dim/10 hover:border-gn-green/30"
          : "border-gn-text-dim/10 hover:border-gn-amber/30",
        dimmed ? "opacity-55" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 min-w-0">
        {leading}
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-gn-text truncate">{title}</p>
          {subtitle && <p className="text-[11px] font-mono text-gn-text-dim mt-0.5">{subtitle}</p>}
          {badges && <div className="flex flex-wrap gap-1.5 mt-1.5">{badges}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
