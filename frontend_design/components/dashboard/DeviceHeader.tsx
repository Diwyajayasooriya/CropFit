"use client";

import { useState, useRef, useEffect } from "react";

interface DeviceHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
}

export default function DeviceHeader({ name, onNameChange }: DeviceHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onNameChange(trimmed);
    } else {
      setDraft(name);
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="bg-transparent border-b border-gn-green text-xl font-heading font-bold text-gn-text outline-none px-0 py-0.5 max-w-[200px]"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="text-xl font-heading font-bold text-gn-text hover:text-gn-green-light transition-colors cursor-text group flex items-center gap-2"
          title="Click to rename"
        >
          {name}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="opacity-0 group-hover:opacity-50 transition-opacity"
          >
            <path
              d="M11.5 2.5L13.5 4.5M2 14L2.5 11.5L12 2L14 4L3.5 13.5L2 14Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-gn-surface-raised text-gn-text-muted border border-gn-text-dim/15">
        NodeMini
      </span>
    </div>
  );
}
