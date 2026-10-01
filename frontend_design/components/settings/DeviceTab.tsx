"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  getDeviceInfo,
  updateDeviceName,
  updateWifi,
  checkFirmware,
  startFirmwareUpdate,
  removeDevice,
  factoryResetDevice,
} from "@/api/device";
import { getSubscription, changePlan } from "@/api/account";
import type { DeviceInfo, FirmwareStatus, Plan, Subscription } from "@/api/types";
import DashboardCard from "@/components/dashboard/DashboardCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import WifiCredentialsForm from "@/components/ui/WifiCredentialsForm";
import SectionHeader from "./SectionHeader";

function maskSsid(ssid: string) {
  if (ssid.length <= 4) return "••••";
  return `${ssid.slice(0, 3)}${"•".repeat(Math.min(ssid.length - 5, 8))}${ssid.slice(-2)}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-gn-surface-raised/60 border border-gn-text-dim/10">
      <p className="text-[10px] uppercase tracking-wider font-mono text-gn-text-muted">{label}</p>
      <p className="text-sm font-mono text-gn-text mt-1 break-all">{value}</p>
    </div>
  );
}

function UsageBar({ label, used, limit, suffix }: { label: string; used: number; limit: number; suffix: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gn-text-muted">{label}</span>
        <span className="font-mono text-gn-text">
          {used} / {limit} {suffix}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gn-surface-raised overflow-hidden">
        <div
          className={`h-full rounded-full ${pct > 85 ? "bg-gn-amber" : "bg-gn-green-light"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanDialog({
  plans,
  currentId,
  busy,
  onSelect,
  onClose,
}: {
  plans: Plan[];
  currentId: string;
  busy: boolean;
  onSelect: (id: Plan["id"]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare plans"
        className="relative z-10 w-full max-w-3xl rounded-2xl bg-gn-surface-raised border border-gn-green/30 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-heading font-semibold text-gn-text">Compare plans</h3>
          <button onClick={onClose} aria-label="Close" className="text-gn-text-dim hover:text-gn-text p-1 rounded-lg hover:bg-gn-surface">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {plans.map((plan) => {
            const current = plan.id === currentId;
            return (
              <div
                key={plan.id}
                className={[
                  "p-4 rounded-2xl border flex flex-col gap-3",
                  current ? "border-gn-amber/50 bg-gn-amber/5" : "border-gn-text-dim/15 bg-gn-surface/60",
                ].join(" ")}
              >
                <div>
                  <p className="font-heading font-bold text-gn-text">{plan.name}</p>
                  <p className="text-sm font-mono text-gn-amber mt-0.5">{plan.priceLabel}</p>
                </div>
                <ul className="text-xs text-gn-text-muted space-y-1.5 flex-1">
                  <li>Up to {plan.deviceLimit} devices</li>
                  <li>{plan.retentionDays}-day data retention</li>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={current ? "ghost" : "secondary"}
                  disabled={current || busy}
                  onClick={() => onSelect(plan.id)}
                >
                  {current ? "Current plan" : "Switch to this plan"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DeviceTab() {
  const router = useRouter();
  const { deviceId, deviceName, setDeviceName } = useDashboardStore();

  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [name, setName] = useState(deviceName);
  const [nameNote, setNameNote] = useState<string | null>(null);

  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansOpen, setPlansOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);

  const [wifiOpen, setWifiOpen] = useState(false);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [wifiBusy, setWifiBusy] = useState(false);

  const [fw, setFw] = useState<FirmwareStatus | null>(null);
  const [fwBusy, setFwBusy] = useState(false);

  const [danger, setDanger] = useState<"remove" | "reset" | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    getDeviceInfo(deviceId).then((d) => {
      setInfo(d);
      setSsid(d.wifiSsid);
    });
    getSubscription().then((r) => {
      setSub(r.subscription);
      setPlans(r.plans);
    });
  }, [deviceId]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setNameNote(null);
    try {
      const res = await updateDeviceName(deviceId, trimmed);
      setDeviceName(res.name);
      setName(res.name);
      setNameNote("Saved");
    } catch {
      setNameNote("Could not save name");
    }
  };

  const selectPlan = async (id: Plan["id"]) => {
    setPlanBusy(true);
    try {
      setSub(await changePlan(id));
      setPlansOpen(false);
    } finally {
      setPlanBusy(false);
    }
  };

  const saveWifi = async () => {
    setWifiBusy(true);
    try {
      const res = await updateWifi(deviceId, { ssid, password });
      setInfo((prev) => (prev ? { ...prev, wifiSsid: res.ssid } : prev));
      setPassword("");
      setWifiOpen(false);
    } finally {
      setWifiBusy(false);
    }
  };

  const runFirmwareCheck = async () => {
    setFwBusy(true);
    try {
      setFw(await checkFirmware(deviceId));
    } finally {
      setFwBusy(false);
    }
  };

  const installFirmware = async () => {
    setFwBusy(true);
    try {
      const res = await startFirmwareUpdate(deviceId);
      setFw({ ...res, state: "done", current: res.latest, updateAvailable: false });
      setInfo((prev) => (prev ? { ...prev, firmwareVersion: res.latest } : prev));
    } finally {
      setFwBusy(false);
    }
  };

  const confirmDanger = useCallback(async () => {
    if (!danger) return;
    setDangerBusy(true);
    try {
      if (danger === "remove") await removeDevice(deviceId);
      else await factoryResetDevice(deviceId);
      router.push("/onboarding");
    } finally {
      setDangerBusy(false);
      setDanger(null);
    }
  }, [danger, deviceId, router]);

  return (
    <div className="space-y-5">
      {/* 1. Identity */}
      <DashboardCard variant="green" delay={0}>
        <SectionHeader title="Device identity" hint="Name shown across the dashboard." />
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
          <Input label="Device name" value={name} onChange={(e) => { setName(e.target.value); setNameNote(null); }} />
          <Button onClick={saveName} disabled={!name.trim() || name.trim() === deviceName} className="h-[58px]">
            Save name
          </Button>
        </div>
        {nameNote && <p className="text-xs text-gn-green-light mt-2 ml-1" role="status">{nameNote}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Field label="Model" value={info?.model ?? "—"} />
          <Field label="Serial / activation reference" value={info?.serial ?? "—"} />
        </div>
      </DashboardCard>

      {/* 2. Subscription */}
      <DashboardCard variant="amber" delay={1} loading={!sub}>
        {sub && (
          <>
            <SectionHeader
              title="Subscription plan"
              hint={sub.tier}
              action={
                <Button size="sm" variant="secondary" onClick={() => setPlansOpen(true)}>
                  Change plan
                </Button>
              }
            />
            <p className="text-xl font-heading font-bold text-gn-text mb-4">{sub.planName}</p>
            <div className="space-y-3">
              <UsageBar label="Devices" used={sub.usage.devices} limit={sub.usage.deviceLimit} suffix="devices" />
              <UsageBar label="Data retained" used={sub.usage.retentionDays} limit={sub.usage.retentionLimitDays} suffix="days" />
            </div>
          </>
        )}
      </DashboardCard>

      {/* 3. WiFi */}
      <DashboardCard variant="green" delay={2}>
        <SectionHeader
          title="Wi-Fi network"
          hint="Credentials are sent to the hub over Bluetooth."
          action={
            !wifiOpen && (
              <Button size="sm" variant="secondary" onClick={() => setWifiOpen(true)}>
                Change network
              </Button>
            )
          }
        />
        <Field label="Current network" value={info ? maskSsid(info.wifiSsid) : "—"} />
        {wifiOpen && (
          <div className="mt-4 space-y-3">
            <WifiCredentialsForm
              ssid={ssid}
              password={password}
              onSsidChange={setSsid}
              onPasswordChange={setPassword}
              status={wifiBusy ? "Sending…" : "Ready to pair"}
            />
            <div className="flex justify-end gap-2.5">
              <Button size="sm" variant="ghost" onClick={() => setWifiOpen(false)} disabled={wifiBusy}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveWifi} disabled={wifiBusy || !ssid.trim() || !password}>
                {wifiBusy ? "Pairing…" : "Update network"}
              </Button>
            </div>
          </div>
        )}
      </DashboardCard>

      {/* 4. Firmware */}
      <DashboardCard variant="green" delay={3}>
        <SectionHeader
          title="Firmware"
          action={
            <Button size="sm" variant="secondary" onClick={runFirmwareCheck} disabled={fwBusy}>
              {fwBusy && !fw ? "Checking…" : "Check for updates"}
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Field label="Installed version" value={fw?.current ?? info?.firmwareVersion ?? "—"} />
          {fw && (
            <p className="text-sm" role="status">
              {fw.state === "done" ? (
                <span className="text-gn-green-light">Updated to {fw.current}.</span>
              ) : fw.updateAvailable ? (
                <span className="text-gn-amber">Version {fw.latest} is available.</span>
              ) : (
                <span className="text-gn-green-light">You are up to date.</span>
              )}
            </p>
          )}
        </div>
        {fw?.updateAvailable && (
          <Button size="sm" className="mt-4" onClick={installFirmware} disabled={fwBusy}>
            {fwBusy ? "Installing…" : `Install ${fw.latest}`}
          </Button>
        )}
      </DashboardCard>

      {/* 5. Danger zone — deliberately outside the green/amber palette */}
      <section className="p-5 rounded-2xl border border-red-500/40 bg-red-500/5">
        <SectionHeader title="Danger zone" hint="These actions cannot be undone." />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gn-text">Remove device</p>
              <p className="text-xs text-gn-text-muted">Unpair this hub from your account.</p>
            </div>
            <button onClick={() => setDanger("remove")} className="px-4 py-2 text-sm rounded-lg border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer font-heading">
              Remove device
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-red-500/20">
            <div>
              <p className="text-sm font-medium text-gn-text">Factory reset</p>
              <p className="text-xs text-gn-text-muted">Erase settings, schedules and layout on the hub.</p>
            </div>
            <button onClick={() => setDanger("reset")} className="px-4 py-2 text-sm rounded-lg border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer font-heading">
              Factory reset
            </button>
          </div>
        </div>
      </section>

      {plansOpen && sub && (
        <PlanDialog plans={plans} currentId={sub.planId} busy={planBusy} onSelect={selectPlan} onClose={() => setPlansOpen(false)} />
      )}

      <ConfirmDialog
        open={danger !== null}
        title={danger === "remove" ? "Remove this device?" : "Factory reset this device?"}
        message={
          danger === "remove"
            ? "The hub will be unpaired and stop reporting to your dashboard."
            : "All settings, schedules and layout data on the hub will be erased."
        }
        confirmLabel={danger === "remove" ? "Remove" : "Reset"}
        requireText={danger === "remove" ? "REMOVE" : "RESET"}
        busy={dangerBusy}
        onConfirm={confirmDanger}
        onCancel={() => setDanger(null)}
      />
    </div>
  );
}
