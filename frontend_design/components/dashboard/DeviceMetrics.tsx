"use client";

import Button from "@/components/ui/Button";

interface DeviceMetricsProps {
  bandwidthUsage: string;
  connectedSubDevices: number;
  mode: "manual" | "scareclaw";
  onToggleMode: () => void;
}

export default function DeviceMetrics({
  bandwidthUsage,
  connectedSubDevices,
  mode,
  onToggleMode,
}: DeviceMetricsProps) {
  const isManual = mode === "manual";
  const isScareClaw = mode === "scareclaw";

  return (
    <div className="space-y-4">
      {/* Enhanced Telemetry Metrics Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Bandwidth Usage Card */}
        <div className="p-3.5 rounded-xl bg-gn-surface-raised/70 border border-gn-text-dim/15 hover:border-gn-green/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gn-text-muted font-mono flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Bus Bandwidth
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-gn-green-light animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-heading font-bold text-gn-text">
              {bandwidthUsage}
            </span>
            <span className="text-[11px] font-mono text-gn-text-dim">
              peak 16M
            </span>
          </div>
        </div>

        {/* Connected Sub-devices Card */}
        <div className="p-3.5 rounded-xl bg-gn-surface-raised/70 border border-gn-text-dim/15 hover:border-gn-green/30 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gn-text-muted font-mono flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Active Nodes
            </span>
            <span className="text-[10px] font-mono text-gn-green-light bg-gn-green/15 px-1.5 py-0.5 rounded border border-gn-green/20">
              Mesh 100%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-heading font-bold text-gn-text">
              {connectedSubDevices}
            </span>
            <span className="text-[11px] font-mono text-gn-text-dim">
              Sub-devices
            </span>
          </div>
        </div>
      </div>

      {/* Symbolic Mode Switcher Panel */}
      <div className="p-3 rounded-2xl bg-gn-surface-raised/80 border border-gn-text-dim/20 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-wider text-gn-text-muted font-mono flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            System Operating Mode
          </span>
          <span className="text-[10px] font-mono text-gn-text-dim">
            Click to switch
          </span>
        </div>

        {/* Dual Symbolic Mode Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* Manual Mode Card */}
          <button
            type="button"
            onClick={isManual ? undefined : onToggleMode}
            className={[
              "flex flex-col p-3 rounded-xl border text-left transition-all duration-300 relative cursor-pointer",
              isManual
                ? "bg-gn-green/15 border-gn-green/50 shadow-[0_0_15px_rgba(46,139,87,0.3)] ring-1 ring-gn-green/40"
                : "bg-gn-surface/50 border-gn-text-dim/10 hover:border-gn-text-dim/30 opacity-60 hover:opacity-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={[
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isManual
                    ? "bg-gn-green text-gn-surface shadow-sm"
                    : "bg-gn-surface-raised text-gn-text-dim",
                ].join(" ")}
              >
                {/* Manual Symbol: Hand / Dial Controls */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {isManual && (
                <span className="w-2 h-2 rounded-full bg-gn-green-light animate-ping" />
              )}
            </div>

            <div className="space-y-0.5">
              <p
                className={[
                  "text-xs font-heading font-bold tracking-wider uppercase",
                  isManual ? "text-gn-green-light" : "text-gn-text-dim",
                ].join(" ")}
              >
                Manual
              </p>
              <p className="text-[10px] text-gn-text-muted leading-tight font-body">
                Operator direct control
              </p>
            </div>
          </button>

          {/* ScareClaw Mode Card */}
          <button
            type="button"
            onClick={isScareClaw ? undefined : onToggleMode}
            className={[
              "flex flex-col p-3 rounded-xl border text-left transition-all duration-300 relative cursor-pointer",
              isScareClaw
                ? "bg-gn-amber/15 border-gn-amber/50 shadow-[0_0_15px_rgba(217,164,65,0.3)] ring-1 ring-gn-amber/40"
                : "bg-gn-surface/50 border-gn-text-dim/10 hover:border-gn-text-dim/30 opacity-60 hover:opacity-100",
            ].join(" ")}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={[
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isScareClaw
                    ? "bg-gn-amber text-gn-surface shadow-sm"
                    : "bg-gn-surface-raised text-gn-text-dim",
                ].join(" ")}
              >
                {/* ScareClaw Symbol: Cybernetic Eagle / Claw / AI Core */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L14.5 8.5L21 9.5L16 14.5L17.5 21L12 17.5L6.5 21L8 14.5L3 9.5L9.5 8.5L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>

              {isScareClaw && (
                <span className="w-2 h-2 rounded-full bg-gn-amber animate-ping" />
              )}
            </div>

            <div className="space-y-0.5">
              <p
                className={[
                  "text-xs font-heading font-bold tracking-wider uppercase",
                  isScareClaw ? "text-gn-amber" : "text-gn-text-dim",
                ].join(" ")}
              >
                ScareClaw
              </p>
              <p className="text-[10px] text-gn-text-muted leading-tight font-body">
                Autonomous AI engine
              </p>
            </div>
          </button>
        </div>

        {/* Mode Status Explanatory Badge */}
        <div
          className={[
            "p-2 rounded-lg text-[11px] font-mono flex items-center justify-between border",
            isScareClaw
              ? "bg-gn-amber/10 border-gn-amber/25 text-gn-amber"
              : "bg-gn-green/10 border-gn-green/25 text-gn-green-light",
          ].join(" ")}
        >
          <span className="flex items-center gap-1.5 truncate">
            <span>{isScareClaw ? "⚡" : "🎮"}</span>
            <span className="truncate">
              {isScareClaw
                ? "ScareClaw inference loop running (2.5s cycle)"
                : "Manual override active — automated rules paused"}
            </span>
          </span>
          <span className="text-[10px] uppercase opacity-80 shrink-0 font-bold">
            {isScareClaw ? "Live AI" : "Manual"}
          </span>
        </div>
      </div>

      {/* Action Log Button */}
      <Button variant="ghost" size="sm" className="w-full text-xs">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 4h12M2 8h8M2 12h10"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        View hub telemetry & action log
      </Button>
    </div>
  );
}
