'use client';

import React from 'react';
import {
  SproutIcon,
  WifiIcon,
  ThermometerIcon,
  DropletIcon,
  LeafIcon,
  ShieldIcon,
} from '@/components/icons';

export function BrandPanel() {
  return (
    <aside
      className="relative flex flex-col justify-between p-8 lg:p-12 xl:p-16 text-white overflow-hidden select-none bg-[#052e23]"
      style={{
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 90% 80%, rgba(20, 184, 166, 0.07) 0%, transparent 45%),
          linear-gradient(to bottom, #06382b, #04241b)
        `,
      }}
      aria-label="CropFit brand information"
    >
      {/* Subtle architectural dot grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      {/* Top Brand Identity */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600/90 border border-emerald-400/30 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
            <SproutIcon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">CropFit</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-950/60 border border-emerald-700/40 rounded-full">
                SaaS & Edge
              </span>
            </div>
            <p className="text-xs font-medium text-emerald-200/80">
              Smart Greenhouse Management
            </p>
          </div>
        </div>

        <div className="pt-3 max-w-md">
          <p className="text-sm lg:text-base text-emerald-100/90 leading-relaxed font-normal">
            Monitor crops, automate greenhouse operations, and manage your GreenNodes from one place.
          </p>
        </div>
      </div>

      {/* Central Visual: Precision Smart Greenhouse & IoT Mesh Illustration */}
      <div className="relative z-10 my-8 py-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg relative">
          {/* Subtle Ambient Backing Glow */}
          <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-2xl pointer-events-none -z-10" />

          {/* Precision Architectural Greenhouse Vector Graphic */}
          <div className="w-full bg-[#032018]/80 border border-emerald-500/20 rounded-2xl p-6 shadow-2xl backdrop-blur-xs relative overflow-hidden">
            {/* Header telemetry status bar */}
            <div className="flex items-center justify-between pb-4 border-b border-emerald-900/40 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] text-emerald-200">GREENNODE MESH • ACTIVE</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-300/80 font-mono text-[11px]">
                <WifiIcon size={13} />
                <span>915 MHz RF LINK</span>
              </div>
            </div>

            {/* Greenhouse SVG wireframe & canopy */}
            <div className="py-4 flex justify-center">
              <svg
                viewBox="0 0 380 180"
                className="w-full max-h-48 text-emerald-400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Ground plane */}
                <line x1="20" y1="160" x2="360" y2="160" stroke="#064e3b" strokeWidth="1.5" />
                
                {/* Structural Gable Profiles */}
                {/* Bay 1 */}
                <path
                  d="M40 160V90L100 50L160 90V160"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />
                <line x1="100" y1="50" x2="100" y2="160" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3" />
                
                {/* Bay 2 (Central main bay) */}
                <path
                  d="M130 160V80L190 35L250 80V160"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeOpacity="0.8"
                />
                <line x1="190" y1="35" x2="190" y2="160" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 4" />

                {/* Bay 3 */}
                <path
                  d="M220 160V90L280 50L340 90V160"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />
                <line x1="280" y1="50" x2="280" y2="160" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3" />

                {/* Horizontal ridge lines connecting spans */}
                <line x1="100" y1="50" x2="190" y2="35" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
                <line x1="190" y1="35" x2="280" y2="50" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
                <line x1="160" y1="90" x2="220" y2="90" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />

                {/* Subtle Plant Silhouettes inside Bay 2 */}
                <path
                  d="M175 160c0-15 4-25 15-28c11 3 15 13 15 28"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                />
                <path
                  d="M190 145c-6-4-10-12-8-18c6 1 12 6 12 10"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                />
                <path
                  d="M190 140c6-4 10-12 8-18c-6 1-12 6-12 10"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                />

                {/* Micro IoT Sensor Nodes (Nodes positioned within bays) */}
                {/* Node 1 - Central Node */}
                <circle cx="190" cy="75" r="4.5" fill="#10b981" />
                <circle cx="190" cy="75" r="9" stroke="#10b981" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 2" />

                {/* Node 2 - Left Bay Sensor */}
                <circle cx="100" cy="95" r="3.5" fill="#34d399" strokeOpacity="0.8" />

                {/* Node 3 - Right Bay Actuator */}
                <circle cx="280" cy="95" r="3.5" fill="#34d399" strokeOpacity="0.8" />

                {/* Mesh Wireless Links */}
                <line x1="100" y1="95" x2="190" y2="75" stroke="#34d399" strokeWidth="1" strokeDasharray="2 3" strokeOpacity="0.6" />
                <line x1="190" y1="75" x2="280" y2="95" stroke="#34d399" strokeWidth="1" strokeDasharray="2 3" strokeOpacity="0.6" />
              </svg>
            </div>

            {/* Subtle Sensor Telemetry Micro-Indicators */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-emerald-900/40 text-center">
              <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg py-1.5 px-2">
                <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-300/80 mb-0.5">
                  <ThermometerIcon size={12} />
                  <span>Climate</span>
                </div>
                <div className="text-xs font-semibold text-white font-mono">24.2 °C</div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg py-1.5 px-2">
                <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-300/80 mb-0.5">
                  <DropletIcon size={12} />
                  <span>Humidity</span>
                </div>
                <div className="text-xs font-semibold text-white font-mono">68.5 %</div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg py-1.5 px-2">
                <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-300/80 mb-0.5">
                  <LeafIcon size={12} />
                  <span>VPD Target</span>
                </div>
                <div className="text-xs font-semibold text-white font-mono">1.12 kPa</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Bullet Points / Operational Capabilities */}
      <div className="relative z-10 space-y-3 pt-2">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-md bg-emerald-900/60 border border-emerald-600/30 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
            <WifiIcon size={12} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Edge-First Resilience</h4>
            <p className="text-[11px] text-emerald-200/70 leading-normal">
              GreenNodes automate irrigation and venting locally, even when internet goes down.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-md bg-emerald-900/60 border border-emerald-600/30 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
            <ShieldIcon size={12} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Role-Based Access</h4>
            <p className="text-[11px] text-emerald-200/70 leading-normal">
              Unified login portal tailored for commercial growers, field technicians, and system administrators.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Footer Note */}
      <div className="relative z-10 pt-6 mt-4 border-t border-emerald-900/40 flex items-center justify-between text-[11px] text-emerald-300/60">
        <span>CropFit Precision AgriTech • Hub OS 2.4</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Gateway Online</span>
        </span>
      </div>
    </aside>
  );
}
