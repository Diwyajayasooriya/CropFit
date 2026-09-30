"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-gn-amber text-gn-bg font-semibold",
    "hover:bg-gn-amber-light hover:shadow-[0_0_24px_rgba(217,164,65,0.4),0_0_48px_rgba(27,94,59,0.2)]",
    "active:bg-gn-amber-dark",
    "focus-visible:ring-2 focus-visible:ring-gn-amber focus-visible:ring-offset-2 focus-visible:ring-offset-gn-bg",
  ].join(" "),

  secondary: [
    "border border-gn-green text-gn-green bg-transparent",
    "hover:bg-gn-green-muted hover:text-gn-green-light hover:shadow-[0_0_20px_rgba(27,94,59,0.3)]",
    "active:bg-gn-green-dark active:text-gn-text",
    "focus-visible:ring-2 focus-visible:ring-gn-green focus-visible:ring-offset-2 focus-visible:ring-offset-gn-bg",
  ].join(" "),

  ghost: [
    "text-gn-text-muted bg-transparent",
    "hover:text-gn-text hover:bg-gn-surface",
    "active:bg-gn-surface-raised",
    "focus-visible:ring-2 focus-visible:ring-gn-green focus-visible:ring-offset-2 focus-visible:ring-offset-gn-bg",
  ].join(" "),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-6 py-3 text-base rounded-xl",
  lg: "px-8 py-4 text-lg rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          "inline-flex items-center justify-center gap-2",
          "font-heading tracking-wide",
          "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
