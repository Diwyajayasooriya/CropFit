import { AlertTriangleIcon, CheckCircleIcon, RefreshIcon } from '@/components/icons';

// Adapted from the Status Badge design retrieved through the configured 21st
// MCP server: https://21st.dev/@arihantcodes_1f7b8c4d/components/status-badge
// Uses CropFit icons, readable contrast, and content-sized badges.
export function StatusBadge({ tone, children }: { tone: 'success' | 'pending' | 'error' | 'neutral'; children: React.ReactNode }) {
  const colors = { success: 'bg-emerald-50 text-emerald-800', pending: 'bg-amber-50 text-amber-800', error: 'bg-rose-50 text-rose-800', neutral: 'bg-slate-100 text-slate-600' };
  const Icon = tone === 'success' ? CheckCircleIcon : tone === 'pending' ? RefreshIcon : AlertTriangleIcon;
  return <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}><Icon size={14} aria-hidden="true" />{children}</span>;
}
