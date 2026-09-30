"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface DashboardCardProps {
  children: ReactNode;
  variant?: "green" | "amber" | "neutral";
  delay?: number;
  className?: string;
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
}

const borderColors = {
  green: "border-gn-green/20 hover:border-gn-green/40",
  amber: "border-gn-amber/20 hover:border-gn-amber/40",
  neutral: "border-gn-text-dim/10 hover:border-gn-text-dim/20",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-gn-surface-raised" />
      <div className="h-8 w-1/2 rounded bg-gn-surface-raised" />
      <div className="h-3 w-full rounded bg-gn-surface-raised" />
    </div>
  );
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gn-amber">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

export default function DashboardCard({
  children,
  variant = "green",
  delay = 0,
  className = "",
  loading = false,
  error = null,
  onClick,
}: DashboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: delay * 0.065,
        ease: [0.4, 0, 0.2, 1],
      }}
      onClick={onClick}
      className={[
        "p-5 rounded-2xl bg-gn-surface/80 backdrop-blur-sm",
        "border transition-all duration-300",
        borderColors[variant],
        onClick ? "cursor-pointer" : "",
        className,
      ].join(" ")}
    >
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorFallback message={error} />
      ) : (
        children
      )}
    </motion.div>
  );
}
