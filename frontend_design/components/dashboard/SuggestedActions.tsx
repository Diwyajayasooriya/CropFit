"use client";

import Button from "@/components/ui/Button";
import type { SuggestedAction } from "@/api/types";

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onRunAction: (actionId: string) => void;
}

export default function SuggestedActions({
  actions,
  onRunAction,
}: SuggestedActionsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-wider text-gn-text-muted font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gn-amber" />
          Autonomous Recommendations
        </h4>
        <span className="text-[11px] font-mono text-gn-text-dim">
          ScareClaw Engine
        </span>
      </div>

      <div className="space-y-2">
        {actions.map((act) => {
          const isRunning = act.status === "running";
          const isCompleted = act.status === "completed";

          return (
            <div
              key={act.id}
              className="flex items-center justify-between p-3 rounded-xl bg-gn-surface-raised/80 border border-gn-text-dim/8 hover:border-gn-amber/30 transition-all gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gn-amber/10 border border-gn-amber/20 flex-shrink-0 flex items-center justify-center text-gn-amber">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polygon
                      points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gn-text truncate">
                    {act.label}
                  </p>
                  {act.duration && (
                    <span className="text-[10px] font-mono text-gn-text-dim">
                      Duration: {act.duration}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0">
                {isCompleted ? (
                  <span className="text-xs font-mono text-gn-green-light px-2.5 py-1 rounded bg-gn-green/10 border border-gn-green/30">
                    Done ✓
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={isRunning ? "secondary" : "primary"}
                    disabled={isRunning}
                    onClick={() => onRunAction(act.id)}
                    className="text-xs py-1.5 px-3 min-w-[80px]"
                  >
                    {isRunning ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 border-2 border-gn-text-muted border-t-transparent rounded-full animate-spin" />
                        Running
                      </span>
                    ) : (
                      "Apply"
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
