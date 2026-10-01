"use client";

import Input from "./Input";

interface WifiCredentialsFormProps {
  ssid: string;
  password: string;
  onSsidChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  /** Footer status text, e.g. "Ready to pair". */
  status?: string;
  className?: string;
}

/**
 * Phone-pairing + SSID/password block. Shared by onboarding step 2 and
 * the Device settings "Change network" flow.
 */
export default function WifiCredentialsForm({
  ssid,
  password,
  onSsidChange,
  onPasswordChange,
  status = "Ready to pair",
  className = "",
}: WifiCredentialsFormProps) {
  return (
    <div
      className={`p-4 rounded-2xl bg-gn-surface-raised/80 border border-gn-green/20 backdrop-blur-sm space-y-3 text-left shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-gn-text-dim/10">
        <span className="text-[11px] font-mono text-gn-amber flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gn-amber animate-pulse" />
          BLE Pairing Active
        </span>
        <span className="text-[10px] font-mono text-gn-green-light">NodeMini Hub</span>
      </div>

      <div className="space-y-2.5">
        <Input
          label="Network SSID"
          value={ssid}
          onChange={(e) => onSsidChange(e.target.value)}
          className="text-xs"
        />
        <Input
          label="Wi-Fi Password"
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="text-xs"
        />
      </div>

      <div className="flex items-center justify-between pt-1 text-[10px] text-gn-text-dim font-mono">
        <span>Encrypted transmission</span>
        <span className="text-gn-green-light font-semibold">{status}</span>
      </div>
    </div>
  );
}
