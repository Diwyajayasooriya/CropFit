// ============================================================
// CropFit — Smart Greenhouse Login (`/login`)
// Enterprise SaaS split-screen authentication page
// Features: Accessible split-screen layout, smart IoT greenhouse graphics,
// robust validation, remember-me persistence, and seamless session hydration.
// ============================================================

'use client';

import React from 'react';
import { BrandPanel, LoginForm } from '@/components/auth';
import { SproutIcon } from '@/components/icons';

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex flex-col md:flex-row bg-[#f8fafc] text-slate-900 selection:bg-emerald-700 selection:text-white">
      {/* ── LEFT COLUMN: Brand Identity & Precision Greenhouse Illustration (Desktop/Tablet) ── */}
      <div className="hidden md:flex md:w-5/12 lg:w-1/2 xl:w-[52%] shrink-0">
        <BrandPanel />
      </div>

      {/* ── RIGHT COLUMN: Centered SaaS Login Area ── */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-16 relative overflow-y-auto">
        {/* Subtle organic ambient glow */}
        <div
          className="absolute top-0 right-0 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -z-10"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 bg-teal-50/50 rounded-full blur-2xl pointer-events-none -z-10"
          aria-hidden="true"
        />

        {/* Mobile Brand Header: Displayed on mobile screens (<md) where left panel is hidden */}
        <header className="md:hidden flex flex-col items-center pt-4 pb-6 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-[#065f46] text-white flex items-center justify-center shadow-lg shadow-emerald-950/20">
            <SproutIcon size={26} />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">CropFit</span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                Greenhouse Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Smart Greenhouse Management</p>
          </div>
        </header>

        {/* Center Section: Login Form Card */}
        <section
          aria-label="Account sign in"
          className="w-full max-w-md mx-auto my-auto py-2"
        >
          <LoginForm />
        </section>

        {/* Right Column Footer: Security & Hardware Telemetry Badge */}
        <footer className="w-full max-w-md mx-auto pt-6 text-center space-y-1">
          <p className="text-[11px] text-slate-400">
            CropFit Greenhouse Operating System • Edge Mesh v2.4
          </p>
          <p className="text-[10px] text-slate-400">
            Hardware authenticated via 256-bit TLS encrypted session
          </p>
        </footer>
      </div>
    </main>
  );
}
