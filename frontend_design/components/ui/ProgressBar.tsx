"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({
  currentStep,
  totalSteps,
}: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2 w-full max-w-md mx-auto">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;

        return (
          <div key={i} className="flex-1 flex items-center gap-2">
            {/* Step segment */}
            <div
              className={[
                "flex-1 h-1.5 rounded-full transition-all duration-600",
                isComplete
                  ? "bg-gn-amber"
                  : isCurrent
                    ? "bg-gn-green shadow-[0_0_8px_rgba(27,94,59,0.4)]"
                    : "bg-gn-surface-raised",
              ].join(" ")}
            />
          </div>
        );
      })}
    </div>
  );
}
