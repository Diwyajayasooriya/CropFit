"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSettingsStore } from "@/store/settingsStore";
import DeviceTab from "@/components/settings/DeviceTab";
import GreenhouseTab from "@/components/settings/GreenhouseTab";
import AutomationTab from "@/components/settings/AutomationTab";

const TABS = [
  { id: "device", label: "Device" },
  { id: "greenhouse", label: "Greenhouse" },
  { id: "automation", label: "Automation" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SettingsShell() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrateUnits = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    hydrateUnits();
  }, [hydrateUnits]);

  const requested = params.get("tab");
  const active: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : "device";

  return (
    <div className="min-h-screen bg-gn-surface text-gn-text flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-gn-text-dim/10 bg-gn-surface/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gn-text-muted hover:text-gn-text transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to dashboard
          </Link>
          <h1 className="font-heading font-bold text-base tracking-tight">Settings</h1>
        </div>

        {/* Top tab strip */}
        <nav aria-label="Settings sections" className="max-w-3xl mx-auto px-4 sm:px-6">
          <div role="tablist" className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active === t.id}
                aria-controls="settings-panel"
                onClick={() => router.replace(`/settings?tab=${t.id}`, { scroll: false })}
                className={[
                  "px-4 py-2.5 text-sm font-heading border-b-2 -mb-px transition-colors cursor-pointer",
                  active === t.id
                    ? "border-gn-amber text-gn-text"
                    : "border-transparent text-gn-text-dim hover:text-gn-text-muted",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6"
      >
        {active === "device" && <DeviceTab />}
        {active === "greenhouse" && <GreenhouseTab />}
        {active === "automation" && <AutomationTab />}
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsShell />
    </Suspense>
  );
}
