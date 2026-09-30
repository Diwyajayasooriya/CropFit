"use client";

import type { GrowthStage } from "@/api/types";

interface GrowthStageHeaderProps {
  growth: GrowthStage;
}

export default function GrowthStageHeader({ growth }: GrowthStageHeaderProps) {
  const { crop, stage, stageIndex, stages } = growth;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gn-text-dim/8">
      {/* Crop and Stage label */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gn-green/15 border border-gn-green/30 flex items-center justify-center text-gn-green-light">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22V10M12 10C12 7 9 4 5 4C5 8 8 11 12 10ZM12 10C12 7 15 4 19 4C19 8 16 11 12 10Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-heading font-semibold text-gn-text">
            {crop} <span className="text-gn-text-muted font-normal">—</span>{" "}
            <span className="text-gn-green-light">{stage} Stage</span>
          </h3>
          <p className="text-[11px] text-gn-text-dim font-mono">
            Phase {stageIndex + 1} of {stages.length}
          </p>
        </div>
      </div>

      {/* Stage Progress Stepper */}
      <div className="flex items-center gap-1.5 self-start sm:self-auto">
        {stages.map((stg, idx) => {
          const isPassed = idx < stageIndex;
          const isCurrent = idx === stageIndex;
          return (
            <div key={stg} className="flex items-center gap-1.5">
              <div
                className={[
                  "px-2.5 py-1 rounded-md text-[11px] font-mono transition-all",
                  isCurrent
                    ? "bg-gn-green/20 border border-gn-green/40 text-gn-green-light font-semibold shadow-[0_0_8px_rgba(46,139,87,0.25)]"
                    : isPassed
                    ? "bg-gn-surface-raised border border-gn-text-dim/10 text-gn-text-dim line-through decoration-gn-green/40"
                    : "bg-gn-surface-raised/40 border border-transparent text-gn-text-dim/60",
                ].join(" ")}
              >
                {stg}
              </div>
              {idx < stages.length - 1 && (
                <span className="text-gn-text-dim/30 text-xs">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
