import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-gn-text tracking-wide">{title}</h3>
        {hint && <p className="text-xs text-gn-text-muted mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
