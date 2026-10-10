// ============================================================
// CropFit — Sidebar Navigation
// Modern agricultural sidebar matching CropFit design system:
// Brand -> Primary nav -> Hub status -> User profile & role
// ============================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import type { UserRole } from '@/types';
import {
  SproutIcon,
  DashboardIcon,
  GreenhouseIcon,
  DevicesIcon,
  LightningIcon,
  BellIcon,
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
  LogOutIcon,
} from '@/components/icons';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: DashboardIcon },
  { name: 'Greenhouses', href: '/greenhouses', icon: GreenhouseIcon },
  { name: 'Devices', href: '/devices', icon: DevicesIcon },
  { name: 'Automation', href: '/automation', icon: LightningIcon },
  { name: 'Alerts', href: '/alerts', icon: BellIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
  farmer: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  technician: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  admin: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

interface SidebarProps {
  hubOnline?: boolean;
  hubId?: string;
  hubName?: string;
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({ hubOnline = true, hubId = 'GN-HUB-C554', hubName = 'GreenNode' }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const currentRole = user?.role || 'farmer';
  const roleStyle = roleColors[currentRole] ?? roleColors.farmer;

  return (
    <aside
      className="hidden md:flex flex-col w-64 border-r border-slate-200/80 bg-white shrink-0 sticky top-0 h-screen z-30 shadow-xs"
      aria-label="Main navigation"
    >
      {/* ── Brand Header ── */}
      <div className="p-6 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
            <SproutIcon size={22} />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-slate-900 block leading-tight">
              CropFit
            </span>
            <p className="text-[11px] font-medium text-slate-400">
              Smart Greenhouse
            </p>
          </div>
        </Link>
      </div>

      {/* ── Main Navigation ── */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto" aria-label="Primary">
        {mainNavItems.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={18}
                className={active ? 'text-emerald-600' : 'text-slate-400'}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Section ── */}
      <div className="mt-auto border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
        {/* ── GreenNode Status Card ── */}
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  hubOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
              <span className="text-xs font-semibold text-slate-800">
                {hubName} {hubOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {hubOnline ? (
              <WifiIcon size={14} className="text-emerald-600" />
            ) : (
              <WifiOffIcon size={14} className="text-slate-400" />
            )}
          </div>
          <p className="text-[11px] font-mono text-slate-400 mt-1 pl-4">
            {hubId || 'GN-HUB-C554'}
          </p>
        </div>

        {/* ── User Info & Role ── */}
        <div className="p-2.5 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Nimal'}
            </p>
            <span
              className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}
            >
              {currentRole}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOutIcon size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
