"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        "relative w-10 h-6 rounded-full border transition-colors cursor-pointer shrink-0",
        checked ? "bg-gn-green/40 border-gn-green-light/60" : "bg-gn-surface border-gn-text-dim/30",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform",
          checked ? "translate-x-4 bg-gn-green-light" : "bg-gn-text-dim",
        ].join(" ")}
      />
    </button>
  );
}
