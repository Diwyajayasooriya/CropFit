"use client";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-xl bg-gn-surface p-1 border border-gn-green/10"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={[
            "px-4 py-1.5 text-sm font-heading rounded-lg border transition-colors cursor-pointer",
            value === o.value
              ? "bg-gn-green/15 border-gn-green/25 text-gn-text"
              : "border-transparent text-gn-text-dim hover:text-gn-text-muted",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
