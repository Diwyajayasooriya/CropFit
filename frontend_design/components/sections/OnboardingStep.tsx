"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { OnboardingStepData } from "@/lib/constants";
import Input from "@/components/ui/Input";

interface OnboardingStepProps {
  step: OnboardingStepData;
  direction: number; // 1 = forward, -1 = backward
}

/**
 * SVG illustrations for each onboarding step.
 */
function StepIllustration({ icon }: { icon: OnboardingStepData["icon"] }) {
  const shared = "w-full max-w-xs mx-auto";

  switch (icon) {
    case "setup":
      return (
        <svg viewBox="0 0 300 240" fill="none" className={shared}>
          {/* Table surface */}
          <rect x="40" y="170" width="220" height="6" rx="3" fill="#182420" />
          {/* GreenNode device */}
          <rect x="95" y="110" width="110" height="60" rx="10" fill="#111916" stroke="#1B5E3B" strokeWidth="2" />
          {/* Power LED */}
          <circle cx="115" cy="140" r="4" fill="#1B5E3B">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Antennas */}
          <line x1="130" y1="110" x2="120" y2="80" stroke="#8A9A8F" strokeWidth="2" strokeLinecap="round" />
          <circle cx="120" cy="78" r="3" fill="#1B5E3B" />
          <line x1="170" y1="110" x2="180" y2="80" stroke="#8A9A8F" strokeWidth="2" strokeLinecap="round" />
          <circle cx="180" cy="78" r="3" fill="#1B5E3B" />
          {/* Power cable */}
          <path d="M205 145 Q230 145 240 160 Q250 175 270 175" stroke="#D9A441" strokeWidth="2" fill="none" strokeDasharray="4 3" />
          {/* Arrow pointing to power port */}
          <path d="M240 125 L210 140" stroke="#D9A441" strokeWidth="1.5" markerEnd="url(#arrowAmber)" />
          <text x="242" y="122" fill="#D9A441" fontSize="10" fontFamily="Inter, sans-serif">Power</text>
          {/* Arrow defs */}
          <defs>
            <marker id="arrowAmber" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#D9A441" />
            </marker>
            <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#1B5E3B" />
            </marker>
          </defs>
        </svg>
      );

    case "network":
      return (
        <svg viewBox="0 0 340 180" fill="none" className={shared}>
          {/* Defs for markers */}
          <defs>
            <marker id="arrowAmberPhone" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#D9A441" />
            </marker>
            <marker id="arrowGreenSent" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#2D8F5E" />
            </marker>
          </defs>

          {/* 1. Phone Icon (Left) */}
          <g>
            <rect x="20" y="50" width="46" height="84" rx="8" fill="#111916" stroke="#8A9A8F" strokeWidth="1.5" />
            <rect x="24" y="58" width="38" height="66" rx="4" fill="#0A0E0D" stroke="#1B5E3B" strokeWidth="0.8" />
            <line x1="38" y1="54" x2="48" y2="54" stroke="#8A9A8F" strokeWidth="1" strokeLinecap="round" />
            <circle cx="43" cy="86" r="3" fill="#D9A441" />
            <path d="M36 80 Q43 74 50 80" stroke="#D9A441" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d="M33 76 Q43 68 53 76" stroke="#D9A441" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
            <text x="43" y="108" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Phone</text>
          </g>

          {/* 2. Arrow Phone -> GreenNode */}
          <g>
            <path d="M72 92 L106 92" stroke="#D9A441" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrowAmberPhone)" />
            <text x="88" y="85" textAnchor="middle" fill="#D9A441" fontSize="7.5" fontFamily="monospace">BLE</text>
          </g>

          {/* 3. GreenNode with Concentric Pulse Rings */}
          <g>
            {/* Concentric Pulse Rings (simulating local pairing signal) */}
            <circle cx="152" cy="92" r="24" stroke="#2D8F5E" strokeWidth="1.2" fill="none" opacity="0.8">
              <animate attributeName="r" values="24;48" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="152" cy="92" r="24" stroke="#2D8F5E" strokeWidth="1.2" fill="none" opacity="0.8">
              <animate attributeName="r" values="24;48" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.4s" begin="0.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="152" cy="92" r="24" stroke="#2D8F5E" strokeWidth="1.2" fill="none" opacity="0.8">
              <animate attributeName="r" values="24;48" dur="2.4s" begin="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.4s" begin="1.6s" repeatCount="indefinite" />
            </circle>

            {/* GreenNode Body */}
            <rect x="122" y="70" width="60" height="44" rx="8" fill="#111916" stroke="#1B5E3B" strokeWidth="2" />
            <text x="152" y="93" textAnchor="middle" fill="#E8E6E3" fontSize="8.5" fontFamily="Space Grotesk, sans-serif" fontWeight="600">GreenNode</text>

            {/* Antennas */}
            <line x1="135" y1="70" x2="130" y2="52" stroke="#8A9A8F" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="130" cy="50" r="2.5" fill="#1B5E3B" />
            <line x1="168" y1="70" x2="173" y2="52" stroke="#8A9A8F" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="173" cy="50" r="2.5" fill="#1B5E3B" />

            {/* Indicator LED */}
            <circle cx="174" cy="78" r="2" fill="#2D8F5E">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* 4. Arrow GreenNode -> Credentials Sent */}
          <g>
            <path d="M188 92 L220 92" stroke="#2D8F5E" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrowGreenSent)" />
            <text x="204" y="85" textAnchor="middle" fill="#2D8F5E" fontSize="7.5" fontFamily="monospace">SYNC</text>
          </g>

          {/* 5. Credentials Sent Confirmation */}
          <g>
            <rect x="228" y="72" width="76" height="40" rx="8" fill="#111916" stroke="#2D8F5E" strokeWidth="1.2" />
            <circle cx="242" cy="92" r="7" fill="#1B5E3B" fillOpacity="0.4" stroke="#2D8F5E" strokeWidth="1" />
            <path d="M239 92 L241.5 94.5 L245.5 89.5" stroke="#2D8F5E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="253" y="89" fill="#E8E6E3" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600">Wi-Fi</text>
            <text x="253" y="100" fill="#2D8F5E" fontSize="7.5" fontFamily="Inter, sans-serif">Transmitted</text>
          </g>
        </svg>
      );

    case "sensor":
      return (
        <svg viewBox="0 0 300 240" fill="none" className={shared}>
          {/* GreenNode */}
          <rect x="95" y="90" width="110" height="60" rx="10" fill="#111916" stroke="#1B5E3B" strokeWidth="2" />
          <text x="150" y="125" textAnchor="middle" fill="#E8E6E3" fontSize="11" fontFamily="Space Grotesk, sans-serif" fontWeight="600">GreenNode</text>
          {/* Sensor port highlights */}
          <rect x="98" y="135" width="14" height="10" rx="2" fill="#1B5E3B" fillOpacity="0.4" stroke="#2D8F5E" strokeWidth="1" />
          <rect x="116" y="135" width="14" height="10" rx="2" fill="#1B5E3B" fillOpacity="0.2" stroke="#8A9A8F" strokeWidth="0.5" />
          <rect x="134" y="135" width="14" height="10" rx="2" fill="#1B5E3B" fillOpacity="0.2" stroke="#8A9A8F" strokeWidth="0.5" />
          {/* Sensor device */}
          <circle cx="70" cy="200" r="25" fill="#111916" stroke="#D9A441" strokeWidth="1.5" />
          <text x="70" y="196" textAnchor="middle" fill="#D9A441" fontSize="14">🌡</text>
          <text x="70" y="210" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Sensor</text>
          {/* Cable from sensor to port */}
          <path d="M85 182 Q100 170 105 148" stroke="#D9A441" strokeWidth="2" fill="none" />
          {/* Arrow pointing to sensor port */}
          <path d="M55 165 L95 140" stroke="#D9A441" strokeWidth="1.5" markerEnd="url(#arrowAmber3)" />
          <text x="30" y="162" fill="#D9A441" fontSize="9" fontFamily="Inter, sans-serif">Plug in</text>
          {/* Auto-detect indicator */}
          <rect x="170" y="155" width="100" height="28" rx="6" fill="#1B5E3B" fillOpacity="0.15" stroke="#1B5E3B" strokeWidth="1" />
          <text x="220" y="173" textAnchor="middle" fill="#2D8F5E" fontSize="9" fontFamily="Inter, sans-serif">✓ Auto-detected</text>
          <defs>
            <marker id="arrowAmber3" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#D9A441" />
            </marker>
          </defs>
        </svg>
      );

    case "actuator":
      return (
        <svg viewBox="0 0 300 240" fill="none" className={shared}>
          {/* GreenNode */}
          <rect x="95" y="90" width="110" height="60" rx="10" fill="#111916" stroke="#1B5E3B" strokeWidth="2" />
          <text x="150" y="125" textAnchor="middle" fill="#E8E6E3" fontSize="11" fontFamily="Space Grotesk, sans-serif" fontWeight="600">GreenNode</text>
          {/* Actuator port */}
          <rect x="172" y="135" width="14" height="10" rx="2" fill="#2D8F5E" fillOpacity="0.4" stroke="#2D8F5E" strokeWidth="1" />
          <rect x="190" y="135" width="14" height="10" rx="2" fill="#1B5E3B" fillOpacity="0.2" stroke="#8A9A8F" strokeWidth="0.5" />
          {/* Actuator device (fan) */}
          <rect x="200" y="180" width="60" height="45" rx="8" fill="#111916" stroke="#2D8F5E" strokeWidth="1.5" />
          <text x="230" y="200" textAnchor="middle" fill="#2D8F5E" fontSize="16">🌀</text>
          <text x="230" y="216" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Fan</text>
          {/* Cable */}
          <path d="M195 148 Q210 165 215 180" stroke="#2D8F5E" strokeWidth="2" fill="none" />
          {/* Arrow */}
          <path d="M255 170 L200 148" stroke="#2D8F5E" strokeWidth="1.5" markerEnd="url(#arrowGreen4)" />
          <text x="258" y="168" fill="#2D8F5E" fontSize="9" fontFamily="Inter, sans-serif">Connect</text>
          {/* AI coordination indicator */}
          <rect x="30" y="165" width="110" height="35" rx="8" fill="#111916" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.5" />
          <text x="85" y="180" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">AI coordinates</text>
          <text x="85" y="192" textAnchor="middle" fill="#2D8F5E" fontSize="8" fontFamily="Inter, sans-serif">sensor → actuator</text>
          <defs>
            <marker id="arrowGreen4" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#2D8F5E" />
            </marker>
          </defs>
        </svg>
      );
  }
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

export default function OnboardingStep({
  step,
  direction,
}: OnboardingStepProps) {
  const [ssid, setSsid] = useState("Greenhouse-WiFi-5G");
  const [password, setPassword] = useState("••••••••••");

  return (
    <motion.div
      key={step.id}
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center text-center px-6"
    >
      {/* Illustration */}
      <div className="mb-6 w-full max-w-sm">
        <StepIllustration icon={step.icon} />
      </div>

      {/* Network Step Inline Mini-Form */}
      {step.icon === "network" && (
        <div className="w-full max-w-xs mb-8 p-4 rounded-2xl bg-gn-surface-raised/80 border border-gn-green/20 backdrop-blur-sm space-y-3 text-left shadow-lg">
          <div className="flex items-center justify-between pb-1.5 border-b border-gn-text-dim/10">
            <span className="text-[11px] font-mono text-gn-amber flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gn-amber animate-pulse" />
              BLE Pairing Active
            </span>
            <span className="text-[10px] font-mono text-gn-green-light">
              NodeMini Hub
            </span>
          </div>

          <div className="space-y-2.5">
            <Input
              label="Network SSID"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              className="text-xs"
            />
            <Input
              label="Wi-Fi Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] text-gn-text-dim font-mono">
            <span>Encrypted transmission</span>
            <span className="text-gn-green-light font-semibold">Ready to pair</span>
          </div>
        </div>
      )}

      {/* Step number */}
      <span className="inline-block text-xs font-heading text-gn-amber tracking-[0.2em] uppercase mb-3">
        Step {step.id} of 4
      </span>

      {/* Title */}
      <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gn-text mb-4">
        {step.title}
      </h2>

      {/* Description */}
      <p className="text-base text-gn-text-muted max-w-lg leading-relaxed">
        {step.description}
      </p>
    </motion.div>
  );
}
