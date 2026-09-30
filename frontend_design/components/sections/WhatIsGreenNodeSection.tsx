"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";

/**
 * SVG diagram showing the IoT hub concept — simplified, not a full 3D scene.
 */
function IoTDiagram() {
  return (
    <svg
      viewBox="0 0 400 280"
      fill="none"
      className="w-full max-w-lg mx-auto"
    >
      {/* Central GreenNode hub */}
      <rect
        x="150"
        y="105"
        width="100"
        height="70"
        rx="12"
        fill="#111916"
        stroke="#1B5E3B"
        strokeWidth="2"
      />
      <text
        x="200"
        y="145"
        textAnchor="middle"
        fill="#E8E6E3"
        fontSize="13"
        fontFamily="Space Grotesk, sans-serif"
        fontWeight="600"
      >
        GreenNode
      </text>
      {/* AI label */}
      <rect x="175" y="150" width="50" height="16" rx="4" fill="#1B5E3B" fillOpacity="0.3" />
      <text
        x="200"
        y="161"
        textAnchor="middle"
        fill="#2D8F5E"
        fontSize="9"
        fontFamily="Inter, sans-serif"
      >
        Edge AI
      </text>

      {/* Sensor 1 — Temperature */}
      <circle cx="60" cy="60" r="28" fill="#111916" stroke="#D9A441" strokeWidth="1.5" />
      <text x="60" y="56" textAnchor="middle" fill="#D9A441" fontSize="16">🌡</text>
      <text x="60" y="72" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Temp</text>
      {/* Connection line */}
      <line x1="88" y1="70" x2="150" y2="115" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />

      {/* Sensor 2 — Humidity */}
      <circle cx="60" cy="200" r="28" fill="#111916" stroke="#D9A441" strokeWidth="1.5" />
      <text x="60" y="196" textAnchor="middle" fill="#D9A441" fontSize="16">💧</text>
      <text x="60" y="212" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Humidity</text>
      <line x1="88" y1="195" x2="150" y2="155" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />

      {/* Sensor 3 — Light */}
      <circle cx="200" cy="20" r="28" fill="#111916" stroke="#D9A441" strokeWidth="1.5" />
      <text x="200" y="16" textAnchor="middle" fill="#D9A441" fontSize="16">☀</text>
      <text x="200" y="32" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Light</text>
      <line x1="200" y1="48" x2="200" y2="105" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />

      {/* Actuator 1 — Irrigation */}
      <rect x="312" y="42" width="56" height="56" rx="10" fill="#111916" stroke="#2D8F5E" strokeWidth="1.5" />
      <text x="340" y="66" textAnchor="middle" fill="#2D8F5E" fontSize="16">🚿</text>
      <text x="340" y="82" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Irrigation</text>
      <line x1="250" y1="120" x2="312" y2="75" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />

      {/* Actuator 2 — Ventilation */}
      <rect x="312" y="172" width="56" height="56" rx="10" fill="#111916" stroke="#2D8F5E" strokeWidth="1.5" />
      <text x="340" y="196" textAnchor="middle" fill="#2D8F5E" fontSize="16">🌀</text>
      <text x="340" y="212" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">Vent</text>
      <line x1="250" y1="155" x2="312" y2="195" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="4 3" />

      {/* Cloud connection */}
      <path
        d="M200 175 L200 240 Q200 260 220 260 L250 260"
        stroke="#1B5E3B"
        strokeWidth="1"
        strokeOpacity="0.4"
        strokeDasharray="4 3"
        fill="none"
      />
      <rect x="250" y="246" width="56" height="28" rx="8" fill="#111916" stroke="#1B5E3B" strokeWidth="1" strokeOpacity="0.4" />
      <text x="278" y="264" textAnchor="middle" fill="#8A9A8F" fontSize="8" fontFamily="Inter, sans-serif">☁ Cloud</text>
    </svg>
  );
}

export default function WhatIsGreenNodeSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  const features = [
    {
      title: "Unified Orchestration",
      description:
        "Connect any third-party IoT sensor or actuator. GreenNode speaks every protocol so your greenhouse hardware works as one.",
    },
    {
      title: "Edge AI Intelligence",
      description:
        "On-device machine learning processes sensor data locally — fast decisions, no cloud latency, and your data stays private.",
    },
    {
      title: "Autonomous Care",
      description:
        "Set your targets once. GreenNode continuously optimizes irrigation, ventilation, and lighting without manual intervention.",
    },
  ];

  return (
    <section
      id="what-is-greennode"
      ref={sectionRef}
      className="relative py-32 px-6 overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gn-green/5 blur-[120px] pointer-events-none" />

      <motion.div
        className="max-w-6xl mx-auto"
        variants={staggerContainer}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {/* Label */}
        <motion.span
          variants={fadeInUp}
          className="inline-block text-sm font-heading text-gn-amber tracking-[0.2em] uppercase mb-6"
        >
          What is GreenNode?
        </motion.span>

        {/* Headline */}
        <motion.h2
          variants={fadeInUp}
          className="font-heading text-4xl sm:text-5xl md:text-6xl font-bold text-gn-text mb-6 leading-tight"
        >
          Your greenhouse&apos;s
          <br />
          <span className="text-gn-green">intelligent core</span>
        </motion.h2>

        <motion.p
          variants={fadeInUp}
          className="text-lg text-gn-text-muted max-w-2xl leading-relaxed mb-16"
        >
          An AI-powered edge device that unifies and orchestrates third-party IoT
          sensors and actuators — turning fragmented greenhouse hardware into a
          cohesive, self-managing ecosystem.
        </motion.p>

        {/* Two-column: diagram + features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* SVG Diagram */}
          <motion.div variants={fadeInUp}>
            <IoTDiagram />
          </motion.div>

          {/* Feature cards */}
          <motion.div variants={fadeInUp} className="space-y-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={[
                  "p-6 rounded-2xl border border-gn-green/10 bg-gn-surface/60",
                  "backdrop-blur-sm transition-all duration-500",
                  "hover:border-gn-green/25 hover:bg-gn-surface",
                ].join(" ")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gn-green-muted flex items-center justify-center text-sm font-heading text-gn-green font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-gn-text mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gn-text-muted leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
