"use client";

interface TabToggleProps {
  options: [string, string];
  activeIndex: number;
  onChange: (index: number) => void;
}

export default function TabToggle({
  options,
  activeIndex,
  onChange,
}: TabToggleProps) {
  return (
    <div className="relative flex items-center rounded-xl bg-gn-surface p-1 border border-gn-green/10">
      {/* Sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-lg bg-gn-green/15 border border-gn-green/25 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: `calc(50% - 4px)`,
          left: activeIndex === 0 ? "4px" : "calc(50%)",
        }}
      />

      {options.map((option, i) => (
        <button
          key={option}
          onClick={() => onChange(i)}
          className={[
            "relative z-10 flex-1 py-2.5 text-sm font-heading font-medium tracking-wide",
            "rounded-lg transition-colors duration-400 cursor-pointer",
            activeIndex === i ? "text-gn-text" : "text-gn-text-dim hover:text-gn-text-muted",
          ].join(" ")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
