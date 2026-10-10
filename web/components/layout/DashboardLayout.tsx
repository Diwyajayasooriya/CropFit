// ============================================================
// CropFit — Global Dashboard Layout
// Combines Sidebar (desktop) + MobileNav (mobile) + content area
// ============================================================

'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 min-w-0 pb-20 md:pb-8 flex flex-col overflow-x-hidden">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
