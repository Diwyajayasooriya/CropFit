"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";

export default function DashboardHeader() {
  const router = useRouter();
  const { username, logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName = username || "Operator";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gn-text-dim/10 bg-gn-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gn-green/20 border border-gn-green/40 flex items-center justify-center text-gn-green-light group-hover:scale-105 transition-transform shadow-[0_0_12px_rgba(46,139,87,0.3)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-base tracking-tight text-gn-text">
              Green<span className="text-gn-green-light">Node</span>
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gn-surface-raised border border-gn-text-dim/15 text-gn-text-dim">
              Edge OS
            </span>
          </div>
        </Link>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-full bg-gn-surface-raised/70 border border-gn-text-dim/15 hover:border-gn-green/40 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-gn-green/20 border border-gn-green/40 flex items-center justify-center text-[11px] font-mono font-semibold text-gn-green-light">
              {initials}
            </div>
            <span className="text-xs font-medium text-gn-text hidden sm:inline-block">
              {displayName}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className={`text-gn-text-dim transition-transform ${
                dropdownOpen ? "rotate-180" : ""
              }`}
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-gn-surface-raised border border-gn-text-dim/20 shadow-xl py-1.5 z-40 backdrop-blur-md">
                <div className="px-3 py-2 border-b border-gn-text-dim/10">
                  <p className="text-xs font-medium text-gn-text truncate">
                    {displayName}
                  </p>
                  <p className="text-[10px] font-mono text-gn-text-dim">
                    Role: Agronomist Admin
                  </p>
                </div>

                <Link
                  href="/onboarding"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-gn-text-muted hover:text-gn-text hover:bg-gn-surface/50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Pair New Device
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gn-amber hover:text-red-400 hover:bg-gn-surface/50 transition-colors text-left"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
