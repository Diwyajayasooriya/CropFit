"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import HeroSection from "@/components/sections/HeroSection";
import WhoWeAreSection from "@/components/sections/WhoWeAreSection";
import WhatIsGreenNodeSection from "@/components/sections/WhatIsGreenNodeSection";
import AuthPanel from "@/components/sections/AuthPanel";
import { fadeIn } from "@/lib/animations";

// Dynamic import with ssr: false for R3F Canvas
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
});

export default function Home() {
  const { mode, setMode } = useAuthStore();

  return (
    <main className="relative min-h-screen bg-[#0A0E0D] text-[#E8E6E3] overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0A0E0D]/60 border-b border-[#1B5E3B]/15">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div
            onClick={() => setMode("landing")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#111916] border border-[#1B5E3B]/40 flex items-center justify-center shadow-[0_0_12px_rgba(27,94,59,0.3)] group-hover:border-[#2D8F5E] transition-all duration-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1B5E3B] group-hover:bg-[#2D8F5E] group-hover:shadow-[0_0_8px_rgba(45,143,94,0.8)] transition-all duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-lg tracking-tight text-[#E8E6E3]">
                GreenNode<span className="text-[#1B5E3B]">.</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase font-mono text-[#8A9A8F]">
                BlueCircle IoT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {mode === "auth" ? (
              <button
                onClick={() => setMode("landing")}
                className="text-xs font-heading tracking-wider uppercase text-[#8A9A8F] hover:text-[#E8E6E3] flex items-center gap-1.5 transition-colors duration-300 px-3 py-1.5 rounded-lg hover:bg-[#111916]"
              >
                ← Back to overview
              </button>
            ) : (
              <nav className="hidden sm:flex items-center gap-6">
                <a
                  href="#who-we-are"
                  className="text-xs font-heading tracking-wider uppercase text-[#8A9A8F] hover:text-[#E8E6E3] transition-colors duration-300"
                >
                  Who We Are
                </a>
                <a
                  href="#what-is-greennode"
                  className="text-xs font-heading tracking-wider uppercase text-[#8A9A8F] hover:text-[#E8E6E3] transition-colors duration-300"
                >
                  Architecture
                </a>
                <button
                  onClick={() => setMode("auth")}
                  className="text-xs font-heading tracking-wider uppercase px-4 py-2 rounded-lg border border-[#D9A441]/40 text-[#D9A441] hover:bg-[#D9A441]/10 transition-all duration-300"
                >
                  Sign In / Activate
                </button>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Hero & Auth Combined Interactive Stage */}
      <section className="relative min-h-screen w-full flex items-center justify-center pt-20">
        {/* 3D Scene Layer (Always present, positions adapt to mode) */}
        <div className="absolute inset-0 z-0">
          <HeroScene mode={mode} />
        </div>

        {/* Dynamic Foreground Content */}
        <AnimatePresence mode="wait">
          {mode === "landing" ? (
            <motion.div
              key="landing-hero"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="relative z-10 w-full"
            >
              <HeroSection onGetStarted={() => setMode("auth")} />
            </motion.div>
          ) : (
            <motion.div
              key="auth-panel-wrapper"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row items-center justify-between min-h-[calc(100vh-5rem)]"
            >
              {/* Left Column: Visual copy for unboxing / activation */}
              <div className="w-full lg:w-1/2 mb-10 lg:mb-0 lg:pr-12 pointer-events-none select-none">
                <span className="inline-block text-xs font-heading text-[#D9A441] tracking-[0.25em] uppercase mb-4">
                  Hardware Activation
                </span>
                <h2 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-[#E8E6E3] mb-4">
                  Unbox. Bind.
                  <br />
                  <span className="text-[#1B5E3B]">Orchestrate.</span>
                </h2>
                <p className="text-sm sm:text-base text-[#8A9A8F] max-w-md leading-relaxed">
                  Enter your unique alphanumeric activation key to pair this hub
                  with your greenhouse cluster and establish edge-AI orchestration.
                </p>
              </div>

              {/* Right Column: Interactive Form Panel */}
              <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
                <AuthPanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Scroll Sections (Only relevant in Landing Mode) */}
      {mode === "landing" && (
        <div className="relative z-10 bg-gradient-to-b from-transparent via-[#0A0E0D] to-[#060908]">
          <WhoWeAreSection />
          <WhatIsGreenNodeSection />

          {/* Footer */}
          <footer className="border-t border-[#1B5E3B]/15 py-12 px-6 bg-[#060908]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-[#111916] border border-[#1B5E3B]/30 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#1B5E3B]" />
                </div>
                <span className="text-sm font-heading font-semibold text-[#E8E6E3]">
                  GreenNode
                </span>
                <span className="text-xs text-[#8A9A8F]">
                  by BlueCircle • University of Peradeniya
                </span>
              </div>
              <p className="text-xs text-[#8A9A8F] font-body">
                © {new Date().getFullYear()} BlueCircle. Department of Computer Engineering.
              </p>
            </div>
          </footer>
        </div>
      )}
    </main>
  );
}
