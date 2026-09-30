"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SubDevice } from "@/api/types";

interface SubDeviceListProps {
  devices: SubDevice[];
  onToggleSleep: (id: string) => void;
  onOpenAddDevice?: () => void;
}

const healthConfig = {
  healthy: {
    dot: "bg-gn-green-light shadow-[0_0_8px_rgba(45,143,94,0.8)]",
    label: "Healthy",
    badge: "text-gn-green-light bg-gn-green/10 border-gn-green/30",
  },
  degraded: {
    dot: "bg-gn-amber shadow-[0_0_8px_rgba(217,164,65,0.7)]",
    label: "Degraded",
    badge: "text-gn-amber bg-gn-amber/10 border-gn-amber/30",
  },
  offline: {
    dot: "bg-gn-text-dim/50",
    label: "Offline",
    badge: "text-gn-text-dim bg-gn-surface border-gn-text-dim/20",
  },
};

/**
 * Stacked Card Deck component for either Sensors or Actuators.
 * Cards are layered on top of each other; navigation arrows move which card is on top.
 */
function DeviceCardStack({
  title,
  type,
  items,
  onToggleSleep,
  onOpenAdd,
}: {
  title: string;
  type: "sensor" | "actuator";
  items: SubDevice[];
  onToggleSleep: (id: string) => void;
  onOpenAdd?: () => void;
}) {
  const [topIndex, setTopIndex] = useState(0);

  const total = items.length;
  const safeIndex = total > 0 ? (topIndex % total + total) % total : 0;
  const currentDevice = total > 0 ? items[safeIndex] : null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (total <= 1) return;
    setTopIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (total <= 1) return;
    setTopIndex((prev) => (prev + 1) % total);
  };

  const isSensor = type === "sensor";
  const accentColor = isSensor ? "gn-green" : "gn-amber";

  return (
    <div className="flex flex-col gap-2.5">
      {/* Column / Stack Header with Navigation Arrows */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs">{isSensor ? "🌡" : "⚡"}</span>
          <span className="text-xs font-heading font-semibold text-gn-text uppercase tracking-wider">
            {title}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-gn-surface-raised border border-gn-text-dim/15 text-gn-text-dim">
            {total}
          </span>
        </div>

        {/* Carousel / Deck Navigation Controls */}
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              title="Previous device"
              className="w-6 h-6 rounded-md bg-gn-surface-raised hover:bg-gn-surface border border-gn-text-dim/15 flex items-center justify-center text-gn-text-dim hover:text-gn-text transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[10px] font-mono text-gn-text-dim min-w-[28px] text-center">
              {safeIndex + 1}/{total}
            </span>
            <button
              onClick={handleNext}
              title="Next device"
              className="w-6 h-6 rounded-md bg-gn-surface-raised hover:bg-gn-surface border border-gn-text-dim/15 flex items-center justify-center text-gn-text-dim hover:text-gn-text transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Stacked Cards Area */}
      {total === 0 ? (
        <div
          onClick={onOpenAdd}
          className="h-44 rounded-2xl border border-dashed border-gn-text-dim/20 bg-gn-surface/40 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:border-gn-green/40 transition-colors group"
        >
          <span className="text-xl mb-1 text-gn-text-dim group-hover:scale-110 transition-transform">
            +
          </span>
          <p className="text-xs text-gn-text-muted">No {title.toLowerCase()} linked</p>
          <span className="text-[10px] font-mono text-gn-green-light mt-1">
            Click to add node
          </span>
        </div>
      ) : (
        <div className="relative h-48 select-none">
          {/* Background layered card shadow 2 (bottom layer) */}
          {total > 2 && (
            <div
              className={[
                "absolute inset-x-2 top-4 h-40 rounded-2xl border transition-all duration-300 pointer-events-none opacity-25",
                isSensor
                  ? "bg-gn-surface-raised/40 border-gn-green/20"
                  : "bg-gn-surface-raised/40 border-gn-amber/20",
              ].join(" ")}
            />
          )}

          {/* Background layered card shadow 1 (middle layer) */}
          {total > 1 && (
            <div
              className={[
                "absolute inset-x-1 top-2 h-42 rounded-2xl border transition-all duration-300 pointer-events-none opacity-50",
                isSensor
                  ? "bg-gn-surface-raised/60 border-gn-green/30"
                  : "bg-gn-surface-raised/60 border-gn-amber/30",
              ].join(" ")}
            />
          )}

          {/* Top Card (Interactive Front Layer) */}
          <AnimatePresence mode="wait">
            {currentDevice && (
              <motion.div
                key={currentDevice.id}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={[
                  "absolute inset-0 rounded-2xl p-4 flex flex-col justify-between shadow-xl backdrop-blur-md border transition-all",
                  isSensor
                    ? "bg-gradient-to-b from-gn-surface-raised to-gn-surface border-gn-green/35 shadow-[0_4px_20px_rgba(46,139,87,0.15)]"
                    : "bg-gradient-to-b from-gn-surface-raised to-gn-surface border-gn-amber/35 shadow-[0_4px_20px_rgba(217,164,65,0.15)]",
                ].join(" ")}
              >
                {/* Card Top Row: Type & Health & Sleep Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        healthConfig[currentDevice.health].dot
                      }`}
                    />
                    <span className="text-[10px] font-mono text-gn-text-dim">
                      {healthConfig[currentDevice.health].label}
                    </span>
                  </div>

                  {/* Sleep / Wake Button */}
                  <button
                    onClick={() => onToggleSleep(currentDevice.id)}
                    className={[
                      "text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1",
                      currentDevice.isAwake
                        ? "bg-gn-green/10 text-gn-green-light border-gn-green/30 hover:bg-gn-green/20"
                        : "bg-gn-amber/10 text-gn-amber border-gn-amber/30 hover:bg-gn-amber/20",
                    ].join(" ")}
                  >
                    <span>{currentDevice.isAwake ? "● Awake" : "○ Sleep"}</span>
                  </button>
                </div>

                {/* Card Middle: Clearly Displayed Device Name */}
                <div className="my-1">
                  <h4 className="text-sm font-heading font-bold text-gn-text tracking-wide truncate">
                    {currentDevice.name}
                  </h4>
                  <p className="text-[10px] font-mono text-gn-text-dim mt-0.5">
                    ID: {currentDevice.id}
                  </p>
                </div>

                {/* Card Bottom: Clearly Displayed Bandwidth and Mode */}
                <div className="space-y-1.5 pt-2 border-t border-gn-text-dim/10">
                  {/* Bandwidth Usage */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-mono text-gn-text-muted flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M4 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Bandwidth
                    </span>
                    <span className="font-mono font-semibold text-gn-text">
                      {currentDevice.bandwidthUsed}
                    </span>
                  </div>

                  {/* Mode Pill */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-mono text-gn-text-muted flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      Mode
                    </span>
                    <span
                      className={[
                        "text-[10px] font-mono px-2 py-0.5 rounded-md border truncate max-w-[140px]",
                        isSensor
                          ? "bg-gn-green/10 text-gn-green-light border-gn-green/25"
                          : "bg-gn-amber/10 text-gn-amber border-gn-amber/25",
                      ].join(" ")}
                    >
                      {currentDevice.mode || (isSensor ? "Continuous Telemetry" : "Autonomous PWM")}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function SubDeviceList({
  devices,
  onToggleSleep,
  onOpenAddDevice,
}: SubDeviceListProps) {
  const sensors = devices.filter((d) => d.type === "sensor");
  const actuators = devices.filter((d) => d.type === "actuator");

  return (
    <div className="space-y-4">
      {/* Side-by-Side Grid: Sensors on Left, Actuators on Right */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left Column: Sensors Stack */}
        <DeviceCardStack
          title="Sensors"
          type="sensor"
          items={sensors}
          onToggleSleep={onToggleSleep}
          onOpenAdd={onOpenAddDevice}
        />

        {/* Right Column: Actuators Stack */}
        <DeviceCardStack
          title="Actuators"
          type="actuator"
          items={actuators}
          onToggleSleep={onToggleSleep}
          onOpenAdd={onOpenAddDevice}
        />
      </div>
    </div>
  );
}
