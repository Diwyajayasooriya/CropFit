// ============================================================
// CropFit — Mobile Bottom Navigation
// Thumb-friendly bottom tab bar for mobile screens.
// Mirrors the sidebar's main navigation items.
// ============================================================

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DashboardIcon,
  GreenhouseIcon,
  DevicesIcon,
  LightningIcon,
  BellIcon,
  SettingsIcon,
} from '@/components/icons';

interface MobileNavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const mobileNavItems: MobileNavItem[] = [
  { name: 'Home', href: '/', icon: DashboardIcon },
  { name: 'Greenhouses', href: '/greenhouses', icon: GreenhouseIcon },
  { name: 'Devices', href: '/devices', icon: DevicesIcon },
  { name: 'Automation', href: '/automation', icon: LightningIcon },
  { name: 'Alerts', href: '/alerts', icon: BellIcon },
  { name: 'Settings', href: '/settings', icon: SettingsIcon },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-inset-bottom"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {mobileNavItems.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl min-w-0 transition-colors ${
                active
                  ? 'text-emerald-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={20}
                className={active ? 'text-emerald-600' : 'text-slate-400'}
              />
              <span
                className={`text-[10px] font-medium leading-none ${
                  active ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {item.name}
              </span>
              {active && (
                <span className="w-4 h-0.5 rounded-full bg-emerald-500 mt-0.5" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
