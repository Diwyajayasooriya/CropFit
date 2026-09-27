// ============================================================
// CropFit — App Shell & Responsive Navigation (Light / White Theme)
// Desktop sidebar + Topbar + Mobile bottom thumb bar
// Crisp white panels, slate typography, and emerald accents
// ============================================================

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import type { UserRole } from '@/types';
import {
  SproutIcon,
  DashboardIcon,
  DevicesIcon,
  RulesIcon,
  BellIcon,
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
  LogOutIcon,
  MenuIcon,
  CloseIcon,
  ChevronDownIcon,
  ShieldIcon,
} from './icons';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: DashboardIcon },
  { name: 'Devices', href: '/devices', icon: DevicesIcon, badge: '6' },
  { name: 'Rules', href: '/rules', icon: RulesIcon, badge: '2 active' },
  { name: 'Alerts', href: '/alerts', icon: BellIcon, badge: 2 },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, switchRole } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [hubOnline, setHubOnline] = useState(true);

  const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
    farmer: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    technician: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    admin: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  };

  const currentRole = user?.role || 'farmer';
  const roleStyle = roleColors[currentRole];

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    setRoleMenuOpen(false);
    toast.info(`Switched active view to ${role.toUpperCase()}`, 'Role Updated');
  };

  const toggleHubStatus = () => {
    setHubOnline((prev) => {
      const next = !prev;
      if (next) {
        toast.success('Edge Hub restored connection via Wi-Fi Mesh', 'Hub Online');
      } else {
        toast.warning('Simulated Edge Hub offline mode. Operating locally.', 'Hub Offline');
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* ============================================================ */}
      {/* DESKTOP SIDEBAR                                              */}
      {/* ============================================================ */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/90 bg-white shrink-0 sticky top-0 h-screen z-30 shadow-xs">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <SproutIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900">
                  CropFit
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Edge
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Smart Greenhouse Hub
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={isActive ? 'text-emerald-600' : 'text-slate-400'}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Edge Hub Status Card */}
        <div className="p-3 border-t border-slate-100">
          <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">
                Greenhouse A Hub
              </span>
              <button
                onClick={toggleHubStatus}
                title="Click to toggle simulated online/offline status"
                className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              >
                {hubOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-600">Online</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-rose-600">Offline</span>
                  </>
                )}
              </button>
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>ESP32-CH04 Mesh</span>
              <span>192.168.1.100</span>
            </div>
          </div>
        </div>

        {/* User Profile & Role Switcher */}
        <div className="p-3 border-t border-slate-100 relative">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/80 border border-slate-200/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {user?.first_name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'Operator'}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border} hover:opacity-80 transition-opacity cursor-pointer`}
                  >
                    <ShieldIcon size={10} />
                    <span className="capitalize">{currentRole}</span>
                    <ChevronDownIcon size={10} />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOutIcon size={16} />
            </button>
          </div>

          {/* Role Selection Popover */}
          {roleMenuOpen && (
            <div className="absolute bottom-16 left-3 right-3 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-40 space-y-1 animate-in fade-in">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Switch Role View
              </div>
              {(['farmer', 'technician', 'admin'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize flex items-center justify-between transition-colors cursor-pointer ${
                    currentRole === r
                      ? 'bg-emerald-50 text-emerald-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{r}</span>
                  {currentRole === r && <span className="text-[10px] text-emerald-600">● Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MOBILE TOPBAR                                                */}
      {/* ============================================================ */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <SproutIcon size={18} />
          </div>
          <span className="font-bold text-base text-slate-900">CropFit</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleHubStatus}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              hubOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {hubOnline ? <WifiIcon size={12} /> : <WifiOffIcon size={12} />}
            <span>{hubOnline ? 'Online' : 'Offline'}</span>
          </button>

          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
          >
            {currentRole}
          </span>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 bg-white border-b border-slate-200 z-40 p-4 space-y-4 shadow-xl animate-in slide-in-from-top-2">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Active: <strong className="capitalize text-slate-800">{currentRole}</strong>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-50"
            >
              <LogOutIcon size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MAIN CONTENT WORKSPACE                                       */}
      {/* ============================================================ */}
      <main className="flex-1 min-w-0 flex flex-col pb-20 md:pb-6">
        {/* Desktop Topbar */}
        <div className="hidden md:flex items-center justify-between px-8 py-4 border-b border-slate-200/80 bg-white/80 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-slate-900">
              {navItems.find((item) => item.href === pathname)?.name || 'Greenhouse Hub'}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              Zone A — North House
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleHubStatus}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                hubOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              {hubOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <WifiIcon size={14} />
                  <span>Edge Gateway: Active</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <WifiOffIcon size={14} />
                  <span>Edge Gateway: Offline</span>
                </>
              )}
            </button>

            <Link
              href="/alerts"
              className="relative p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="View Alerts"
            >
              <BellIcon size={16} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                2
              </span>
            </Link>
          </div>
        </div>

        {/* Content Children */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* ============================================================ */}
      {/* MOBILE BOTTOM NAVIGATION BAR                                */}
      {/* ============================================================ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 z-30 flex justify-around items-center px-2 py-2 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl relative transition-all ${
                isActive
                  ? 'text-emerald-700 font-bold scale-105'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium">{item.name}</span>
              {item.badge !== undefined && typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
