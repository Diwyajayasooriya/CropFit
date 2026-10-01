"use client";

import { useEffect } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import DashboardCard from "./DashboardCard";
import GrowthStageHeader from "./GrowthStageHeader";
import TargetConditions from "./TargetConditions";
import SuggestedActions from "./SuggestedActions";
import ManualOverride from "./ManualOverride";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function ActionPanelZone() {
  const router = useRouter();
  const {
    actionPanel,
    subDevices,
    fetchActionPanel,
    executeAction,
  } = useDashboardStore();

  useEffect(() => {
    fetchActionPanel();
  }, [fetchActionPanel]);

  const { data, loading, error } = actionPanel;
  const actuators = subDevices.data?.filter((d) => d.type === "actuator") || [];

  return (
    <DashboardCard
      variant="amber"
      delay={2}
      className="flex flex-col gap-4"
      loading={loading && !data}
      error={error}
    >
      {/* Zone Header Title */}
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-heading font-semibold text-gn-text tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gn-amber animate-pulse" />
          Action Panel
        </h2>
        <span className="text-[11px] font-mono text-gn-amber px-2 py-0.5 rounded-full bg-gn-amber/10 border border-gn-amber/25">
          Automation Active
        </span>
      </div>

      {data && (
        <>
          {/* Crop & Growth Stage */}
          <GrowthStageHeader growth={data.growth} />

          {/* Target Conditions */}
          <TargetConditions conditions={data.conditions} />

          {/* Suggested Actions */}
          <SuggestedActions
            actions={data.suggestedActions}
            onRunAction={executeAction}
          />

          {/* Manual Actuator Controls */}
          <div className="pt-2 border-t border-gn-text-dim/8">
            <ManualOverride actuators={actuators} />
          </div>
        </>
      )}

      {/* Advanced Settings */}
      <div className="pt-2 flex justify-between items-center text-xs">
        <Button variant="ghost" size="sm" onClick={() => router.push("/settings?tab=automation")} className="w-full text-xs text-gn-text-muted hover:text-gn-text">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 2v2M8 12v2M2 8h2M12 8h2M3.76 3.76l1.42 1.42M10.82 10.82l1.42 1.42M3.76 12.24l1.42-1.42M10.82 5.18l1.42-1.42"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
          Automation rules & threshold settings
        </Button>
      </div>
    </DashboardCard>
  );
}
