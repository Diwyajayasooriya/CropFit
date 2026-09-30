"use client";

import { useEffect, useState } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import DashboardCard from "./DashboardCard";
import DeviceHeader from "./DeviceHeader";
import DeviceBlueprint from "./DeviceBlueprint";
import HealthStatus from "./HealthStatus";
import DeviceMetrics from "./DeviceMetrics";
import SubDeviceList from "./SubDeviceList";
import AddDeviceModal from "./AddDeviceModal";
import Button from "@/components/ui/Button";

export default function DeviceManagementZone() {
  const {
    deviceName,
    setDeviceName,
    health,
    subDevices,
    fetchHealth,
    fetchSubDevices,
    toggleMode,
    toggleSleep,
  } = useDashboardStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchHealth();
    fetchSubDevices();
  }, [fetchHealth, fetchSubDevices]);

  const isConnected = health.data?.status === "connected";

  return (
    <>
      <DashboardCard
        variant="green"
        delay={0}
        className="flex flex-col gap-4 h-full"
        loading={health.loading && !health.data}
        error={health.error}
      >
        {/* Header */}
        <DeviceHeader name={deviceName} onNameChange={setDeviceName} />

        {/* Compact Blueprint Render */}
        <DeviceBlueprint />

        {/* Enhanced Health Status */}
        {health.data && <HealthStatus status={health.data.status} />}

        {/* Enhanced Connected-state metrics with Symbolic Mode switcher */}
        {isConnected && health.data && (
          <DeviceMetrics
            bandwidthUsage={health.data.bandwidthUsage}
            connectedSubDevices={health.data.connectedSubDevices}
            mode={health.data.mode}
            onToggleMode={toggleMode}
          />
        )}

        {/* Sub-device section with Header and '+ Add Device' Button */}
        {isConnected && subDevices.data && (
          <div className="border-t border-gn-text-dim/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-heading font-semibold text-gn-text uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gn-green-light" />
                  Connected Peripheral Nodes
                </h3>
                <p className="text-[11px] text-gn-text-muted mt-0.5">
                  Side-by-side device card decks
                </p>
              </div>

              {/* Add Device Button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="text-xs py-1 px-2.5 h-8 gap-1.5 bg-gn-green/10 text-gn-green-light border-gn-green/30 hover:bg-gn-green/20"
              >
                <span className="text-sm font-bold leading-none">+</span>
                <span>Add Device</span>
              </Button>
            </div>

            {/* SubDevice Stacked Decks: Side-by-Side Sensors & Actuators */}
            <SubDeviceList
              devices={subDevices.data}
              onToggleSleep={toggleSleep}
              onOpenAddDevice={() => setIsAddModalOpen(true)}
            />
          </div>
        )}

        {/* Advanced settings */}
        <div className="mt-auto pt-3 border-t border-gn-text-dim/8">
          <Button variant="ghost" size="sm" className="w-full text-xs">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M8 2v2M8 12v2M2 8h2M12 8h2M3.76 3.76l1.42 1.42M10.82 10.82l1.42 1.42M3.76 12.24l1.42-1.42M10.82 5.18l1.42-1.42"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
            Advanced hub configuration
          </Button>
        </div>
      </DashboardCard>

      {/* Add Device Modal Dialog */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </>
  );
}
