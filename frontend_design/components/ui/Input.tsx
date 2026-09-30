"use client";

import { type InputHTMLAttributes, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  accent?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, accent = false, id, className = "", ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const hasValue = !!props.value && String(props.value).length > 0;

    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

    const borderColor = error
      ? "border-red-500"
      : accent
        ? focused
          ? "border-gn-amber shadow-[0_0_16px_rgba(217,164,65,0.2)]"
          : "border-gn-amber/40"
        : focused
          ? "border-gn-green shadow-[0_0_12px_rgba(27,94,59,0.15)]"
          : "border-gn-text-dim/30";

    return (
      <div className={`relative ${className}`}>
        <input
          ref={ref}
          id={inputId}
          className={[
            "peer w-full bg-gn-surface/80 text-gn-text rounded-xl",
            "px-4 pt-6 pb-2 text-base font-body",
            "border transition-all duration-400",
            "outline-none",
            "placeholder-transparent",
            borderColor,
          ].join(" ")}
          placeholder={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />

        {/* Floating label */}
        <label
          htmlFor={inputId}
          className={[
            "absolute left-4 transition-all duration-300 pointer-events-none font-body",
            focused || hasValue
              ? "top-2 text-xs"
              : "top-1/2 -translate-y-1/2 text-base",
            error
              ? "text-red-400"
              : accent
                ? "text-gn-amber"
                : focused
                  ? "text-gn-green-light"
                  : "text-gn-text-dim",
          ].join(" ")}
        >
          {label}
        </label>

        {/* Error message */}
        {error && (
          <p className="mt-1.5 ml-1 text-xs text-red-400 font-body">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
