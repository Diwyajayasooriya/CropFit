"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { SubDevice } from "@/api/types";
import { useDashboardStore } from "@/store/dashboardStore";

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  { name: "Soil Moisture TDR Probe", type: "sensor" as const, mode: "Continuous Telemetry", bandwidth: "0.9 MB/s" },
  { name: "PAR Photon Sensor #2", type: "sensor" as const, mode: "Polling (5s)", bandwidth: "0.6 MB/s" },
  { name: "Overhead Misting Solenoid", type: "actuator" as const, mode: "Autonomous PWM", bandwidth: "1.4 MB/s" },
  { name: "CO₂ Injection Valve", type: "actuator" as const, mode: "Standby Pulse", bandwidth: "1.2 MB/s" },
];

export default function AddDeviceModal({ isOpen, onClose }: AddDeviceModalProps) {
  const { addDevice } = useDashboardStore();

  const [type, setType] = useState<"sensor" | "actuator">("sensor");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("Continuous Telemetry");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setType(preset.type);
    setName(preset.name);
    setMode(preset.mode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newDevice: SubDevice = {
        id: `node-${Date.now().toString().slice(-4)}`,
        name: name.trim(),
        type,
        bandwidthUsed: type === "sensor" ? "1.1 MB/s" : "1.7 MB/s",
        health: "healthy",
        isAwake: true,
        mode: mode || (type === "sensor" ? "Continuous Telemetry" : "Autonomous PWM"),
      };

      addDevice(newDevice);
      setIsSubmitting(false);
      setName("");
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-2xl bg-gn-surface-raised border border-gn-green/30 p-6 shadow-2xl z-10 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gn-text-dim/15">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gn-green/20 border border-gn-green/40 flex items-center justify-center text-gn-green-light shadow-[0_0_10px_rgba(46,139,87,0.3)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-heading font-semibold text-gn-text">
                Pair & Add New Node
              </h3>
              <p className="text-xs text-gn-text-muted">
                Bind IoT sensor or actuator to GreenNode bus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gn-text-dim hover:text-gn-text text-sm p-1 rounded-lg hover:bg-gn-surface transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gn-text-muted">
            Quick Discovery Presets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="text-left p-2 rounded-lg bg-gn-surface/60 border border-gn-text-dim/10 hover:border-gn-green/40 hover:bg-gn-green/5 transition-all text-xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gn-text group-hover:text-gn-green-light truncate">
                    {p.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-gn-text-dim">
                  {p.type} • {p.bandwidth}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Node Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-gn-text-muted">
              Node Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("sensor");
                  setMode("Continuous Telemetry");
                }}
                className={[
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-heading font-medium transition-all cursor-pointer",
                  type === "sensor"
                    ? "bg-gn-green/20 border-gn-green/60 text-gn-green-light shadow-[0_0_10px_rgba(46,139,87,0.2)]"
                    : "bg-gn-surface/50 border-gn-text-dim/15 text-gn-text-dim hover:text-gn-text",
                ].join(" ")}
              >
                <span>🌡</span>
                <span>Sensor</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("actuator");
                  setMode("Autonomous PWM");
                }}
                className={[
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-heading font-medium transition-all cursor-pointer",
                  type === "actuator"
                    ? "bg-gn-amber/20 border-gn-amber/60 text-gn-amber shadow-[0_0_10px_rgba(217,164,65,0.2)]"
                    : "bg-gn-surface/50 border-gn-text-dim/15 text-gn-text-dim hover:text-gn-text",
                ].join(" ")}
              >
                <span>⚡</span>
                <span>Actuator</span>
              </button>
            </div>
          </div>

          {/* Node Name */}
          <div className="space-y-1">
            <Input
              label="Node Identifier / Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ambient Light Sensor #2"
              required
              className="text-sm"
            />
          </div>

          {/* Operational Mode */}
          <div className="space-y-1">
            <Input
              label="Operational Mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              placeholder="e.g. Continuous Telemetry"
              className="text-sm"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!name.trim() || isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-gn-surface border-t-transparent rounded-full animate-spin" />
                  Binding...
                </span>
              ) : (
                "Bind to Hub ✓"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
