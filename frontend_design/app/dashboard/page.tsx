"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DeviceManagementZone from "@/components/dashboard/DeviceManagementZone";
import GreenhouseMonitorZone from "@/components/dashboard/GreenhouseMonitorZone";
import ActionPanelZone from "@/components/dashboard/ActionPanelZone";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gn-surface text-gn-text flex flex-col">
      {/* Top Header — Logo, user profile & action menu */}
      <DashboardHeader />

      {/* Main 3-Zone Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Zone 1 — Device Management (Left Column, Full Height) */}
          <div className="lg:row-span-2 h-full">
            <DeviceManagementZone />
          </div>

          {/* Zone 2 — GreenHouse Monitor (Right Column, Top) */}
          <div>
            <GreenhouseMonitorZone />
          </div>

          {/* Zone 3 — Action Panel (Right Column, Bottom) */}
          <div>
            <ActionPanelZone />
          </div>
        </div>
      </main>
    </div>
  );
}
