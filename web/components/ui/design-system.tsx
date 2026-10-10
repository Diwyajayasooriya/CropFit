'use client';

import React from 'react';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  RefreshIcon,
  WifiIcon,
  WifiOffIcon,
} from '@/components/icons';

// ============================================================
// 1. Status Badges & Types
// ============================================================
export type CropFitStatus =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'online'
  | 'offline'
  | 'auto'
  | 'on'
  | 'off'
  | 'success'
  | 'pending'
  | 'error'
  | 'neutral';

interface StatusBadgeProps {
  status?: CropFitStatus;
  tone?: 'success' | 'pending' | 'error' | 'neutral'; // backward compatibility
  children?: React.ReactNode;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({
  status,
  tone,
  children,
  className = '',
  showDot = false,
}: StatusBadgeProps) {
  // Normalize
  const resolved: CropFitStatus = status || tone || 'neutral';

  const config: Record<
    CropFitStatus,
    { bg: string; text: string; border: string; label: string; dot: string; icon?: React.ComponentType<{ size?: number; className?: string }> }
  > = {
    healthy: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200/80',
      label: 'Healthy',
      dot: 'bg-emerald-500',
      icon: CheckCircleIcon,
    },
    success: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200/80',
      label: 'Success',
      dot: 'bg-emerald-500',
      icon: CheckCircleIcon,
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200/80',
      label: 'Warning',
      dot: 'bg-amber-500',
      icon: AlertTriangleIcon,
    },
    pending: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200/80',
      label: 'Pending',
      dot: 'bg-amber-500',
      icon: RefreshIcon,
    },
    critical: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200/80',
      label: 'Critical',
      dot: 'bg-rose-500',
      icon: AlertTriangleIcon,
    },
    error: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200/80',
      label: 'Error',
      dot: 'bg-rose-500',
      icon: AlertTriangleIcon,
    },
    online: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200/80',
      label: 'Online',
      dot: 'bg-emerald-500',
      icon: WifiIcon,
    },
    offline: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      label: 'Offline',
      dot: 'bg-slate-400',
      icon: WifiOffIcon,
    },
    auto: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200/80',
      label: 'AUTO',
      dot: 'bg-sky-500',
    },
    on: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200/80',
      label: 'ON',
      dot: 'bg-emerald-500',
    },
    off: {
      bg: 'bg-slate-100',
      text: 'text-slate-500',
      border: 'border-slate-200',
      label: 'OFF',
      dot: 'bg-slate-300',
    },
    neutral: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      label: 'Neutral',
      dot: 'bg-slate-400',
    },
  };

  const item = config[resolved] || config.neutral;
  const content = children || item.label;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${item.bg} ${item.text} ${item.border} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} aria-hidden="true" />
      )}
      {!showDot && Icon && <Icon size={12} className="shrink-0" />}
      <span>{content}</span>
    </span>
  );
}

// ============================================================
// 2. Card Components
// ============================================================
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className = '', hover = false, children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200 ${
        hover ? 'hover:shadow-md hover:border-slate-300' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 sm:p-6 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-base font-bold text-slate-900 tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs sm:text-sm text-slate-500 mt-0.5 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 sm:p-6 pt-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`p-4 sm:p-5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================
// 3. SectionHeader
// ============================================================
export function SectionHeader({
  title,
  subtitle,
  badge,
  action,
  className = '',
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ============================================================
// 4. MetricCard
// ============================================================
export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  status?: CropFitStatus;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable' | null;
  subtext?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  status = 'healthy',
  icon,
  trend,
  subtext,
  className = '',
}: MetricCardProps) {
  const trendLabel = trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable';
  const trendColor = trend === 'up' ? 'text-amber-600' : trend === 'down' ? 'text-sky-600' : 'text-slate-500';

  return (
    <Card hover className={`p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{label}</span>
        {icon && <div className="p-2 rounded-xl bg-slate-50 text-slate-600 shrink-0">{icon}</div>}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</span>
        {unit && <span className="text-sm font-semibold text-slate-500">{unit}</span>}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
        <StatusBadge status={status} showDot />
        {trend && (
          <span className={`font-medium flex items-center gap-1 ${trendColor}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
          </span>
        )}
        {!trend && subtext && <span className="text-slate-400">{subtext}</span>}
      </div>
    </Card>
  );
}

// ============================================================
// 5. Button & IconButton
// ============================================================
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs shadow-emerald-600/20',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs shadow-rose-600/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <RefreshIcon size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  variant = 'outline',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const sizes = {
    sm: 'p-1.5 rounded-lg',
    md: 'p-2 rounded-xl',
    lg: 'p-2.5 rounded-xl',
  };

  return (
    <Button variant={variant} className={`${sizes[size]} ${className}`} {...props}>
      {children}
    </Button>
  );
}

// ============================================================
// 6. Select
// ============================================================
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>}
      <select
        className={`w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-emerald-600 focus:border-emerald-600 cursor-pointer shadow-xs ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

// ============================================================
// 7. Feedback States: LoadingSkeleton, EmptyState, ErrorState
// ============================================================
export function LoadingSkeleton({ className = 'h-24 w-full' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-2xl ${className}`}
      role="status"
      aria-label="Loading..."
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = '',
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`p-8 text-center flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 ${className}`}
    >
      {icon && <div className="mb-3 p-3 rounded-2xl bg-slate-100 text-slate-500">{icon}</div>}
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  retry,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangleIcon size={18} className="text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{title}</p>
          {message && <p className="text-xs text-rose-700 mt-0.5">{message}</p>}
        </div>
      </div>
      {retry && (
        <button
          onClick={retry}
          className="text-xs font-semibold underline hover:no-underline text-rose-800 shrink-0 cursor-pointer"
        >
          Try again
        </button>
      )}
    </div>
  );
}
