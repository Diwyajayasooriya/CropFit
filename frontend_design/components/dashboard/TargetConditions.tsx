"use client";

import type { TargetCondition } from "@/api/types";

interface TargetConditionsProps {
  conditions: TargetCondition[];
}

export default function TargetConditions({ conditions }: TargetConditionsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-wider text-gn-text-muted font-mono">
          Target Environmental Conditions
        </h4>
        <span className="text-[11px] font-mono text-gn-text-dim">
          Real vs Setpoint
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {conditions.map((item) => {
          const diff = Number((item.target - item.current).toFixed(1));
          const isOptimal = Math.abs(diff) < 0.2;
          const isNeeded = diff > 0.2; // current is lower than target

          return (
            <div
              key={item.label}
              className="flex items-center justify-between p-2.5 rounded-xl bg-gn-surface-raised/60 border border-gn-text-dim/8 hover:border-gn-text-dim/20 transition-all text-xs"
            >
              <span className="font-medium text-gn-text font-body">
                {item.label}
              </span>

              <div className="flex items-center gap-2">
                <span className="font-mono text-gn-text-muted">
                  {item.current}
                  <span className="text-[10px] text-gn-text-dim ml-0.5">{item.unit}</span>
                </span>
                <span className="text-gn-text-dim/40 text-[10px]">→</span>
                <span className="font-mono text-gn-text font-semibold">
                  {item.target}
                  <span className="text-[10px] text-gn-text-dim ml-0.5">{item.unit}</span>
                </span>

                {/* Delta Badge */}
                <span
                  className={[
                    "px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border",
                    isOptimal
                      ? "bg-gn-green/10 text-gn-green-light border-gn-green/30"
                      : isNeeded
                      ? "bg-gn-amber/10 text-gn-amber border-gn-amber/30"
                      : "bg-gn-amber/10 text-gn-amber border-gn-amber/30",
                  ].join(" ")}
                >
                  {isOptimal
                    ? "Optimal"
                    : isNeeded
                    ? `+${diff} ${item.unit}`
                    : `-${Math.abs(diff)} ${item.unit}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
