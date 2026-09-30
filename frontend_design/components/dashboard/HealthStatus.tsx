"use client";

interface HealthStatusProps {
  status: "connected" | "not_connected" | "pending";
  onClick?: () => void;
}

const statusConfig = {
  connected: {
    label: "Connected & Online",
    sublabel: "Local edge bus synchronized",
    dotClass: "bg-gn-green-light shadow-[0_0_12px_rgba(45,143,94,0.8)]",
    textClass: "text-gn-green-light",
    badge: "Operational",
    badgeClass: "bg-gn-green/15 text-gn-green-light border-gn-green/30",
  },
  pending: {
    label: "Syncing Telemetry",
    sublabel: "Negotiating mesh handshake...",
    dotClass: "bg-gn-amber animate-pulse shadow-[0_0_12px_rgba(217,164,65,0.7)]",
    textClass: "text-gn-amber",
    badge: "Handshake",
    badgeClass: "bg-gn-amber/15 text-gn-amber border-gn-amber/30",
  },
  not_connected: {
    label: "Offline / Disconnected",
    sublabel: "No carrier signal detected",
    dotClass: "bg-gn-text-dim/50",
    textClass: "text-gn-text-muted",
    badge: "Offline",
    badgeClass: "bg-gn-surface-raised text-gn-text-dim border-gn-text-dim/20",
  },
};

export default function HealthStatus({ status, onClick }: HealthStatusProps) {
  const config = statusConfig[status];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3.5 rounded-xl bg-gn-surface-raised/70 border border-gn-text-dim/15 hover:border-gn-green/40 transition-all duration-300 group cursor-pointer text-left"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span className={`w-3 h-3 rounded-full ${config.dotClass}`} />
          {status === "connected" && (
            <span className="absolute w-5 h-5 rounded-full bg-gn-green/20 animate-ping -z-0" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-heading font-semibold ${config.textClass}`}>
              {config.label}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${config.badgeClass}`}>
              {config.badge}
            </span>
          </div>
          <p className="text-xs text-gn-text-muted font-mono mt-0.5">
            {config.sublabel} • 12ms latency
          </p>
        </div>
      </div>

      {/* Right side info & Chevron */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-block text-[11px] font-mono text-gn-text-dim bg-gn-surface px-2 py-0.5 rounded border border-gn-text-dim/10">
          v1.2.0-edge
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-gn-text-dim group-hover:text-gn-text transition-colors group-hover:translate-x-0.5 transition-transform"
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </button>
  );
}
