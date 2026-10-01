"use client";

import { useEffect, useState } from "react";
import Button from "./Button";
import Input from "./Input";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** When set, the user must type this exact phrase before confirming. */
  requireText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Mounts the dialog body only while open, so typed confirmation resets each time. */
export default function ConfirmDialog(props: ConfirmDialogProps) {
  return props.open ? <ConfirmDialogBody {...props} /> : null;
}

function ConfirmDialogBody({
  title,
  message,
  confirmLabel = "Confirm",
  requireText,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canConfirm = !busy && (!requireText || typed === requireText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-gn-surface-raised border border-red-500/40 p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-red-500/10 border border-red-500/40 flex items-center justify-center text-red-400">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5L15 14H1L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 6v3.5M8 11.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 id="confirm-title" className="text-base font-heading font-semibold text-gn-text">
              {title}
            </h3>
            <p className="text-sm text-gn-text-muted mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        {requireText && (
          <div className="space-y-1.5">
            <p className="text-xs text-gn-text-muted">
              Type <span className="font-mono text-red-400">{requireText}</span> to confirm.
            </p>
            <Input
              label="Confirmation"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="text-sm"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm rounded-lg font-heading font-semibold tracking-wide bg-red-500/90 text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-w-[110px]"
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
