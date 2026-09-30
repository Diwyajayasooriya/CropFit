"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import type { SubDevice } from "@/api/types";

interface ManualOverrideProps {
  actuators: SubDevice[];
}

export default function ManualOverride({ actuators }: ManualOverrideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [triggeredIds, setTriggeredIds] = useState<Record<string, boolean>>({});

  const handleTrigger = (id: string) => {
    setTriggeredIds((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setTriggeredIds((prev) => ({ ...prev, [id]: false }));
    }, 1500);
  };

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs justify-center gap-2 border-gn-text-dim/15"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Manual Actuator Override
        <span className="text-gn-text-dim text-[10px]">
          {isOpen ? "▲" : "▼"}
        </span>
      </Button>

      {/* Popover / Drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full left-0 right-0 mb-2 p-3 rounded-xl bg-gn-surface-raised border border-gn-text-dim/20 shadow-xl z-30 space-y-2 backdrop-blur-md">
            <div className="flex items-center justify-between pb-1 border-b border-gn-text-dim/10">
              <span className="text-[11px] font-mono text-gn-text-muted uppercase">
                Direct Actuator Controls
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gn-text-dim hover:text-gn-text text-xs"
              >
                ✕
              </button>
            </div>

            {actuators.length === 0 ? (
              <p className="text-xs text-gn-text-dim py-2 text-center">
                No actuators connected
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {actuators.map((act) => {
                  const isTriggered = triggeredIds[act.id];
                  return (
                    <div
                      key={act.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gn-surface/60 border border-gn-text-dim/8 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-gn-text truncate">
                          {act.name}
                        </p>
                        <span className="text-[10px] font-mono text-gn-text-dim">
                          {act.health} • {act.isAwake ? "Online" : "Standby"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleTrigger(act.id)}
                        disabled={isTriggered}
                        className={[
                          "px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-all",
                          isTriggered
                            ? "bg-gn-green text-gn-surface font-semibold"
                            : "bg-gn-surface-raised hover:bg-gn-amber/20 hover:text-gn-amber text-gn-text border border-gn-text-dim/15",
                        ].join(" ")}
                      >
                        {isTriggered ? "Triggered ✓" : "Trigger"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
