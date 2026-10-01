"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getGreenhouseLayout, setGreenhouseLayout } from "@/api/device";
import type { GreenhouseLayout, LayoutPin, SubDevice, SystemUnit } from "@/api/types";
import DashboardCard from "@/components/dashboard/DashboardCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SectionHeader from "./SectionHeader";

const FT_PER_M = 3.28084;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const toDisplay = (m: number, sys: SystemUnit) =>
  String(Math.round((sys === "imperial" ? m * FT_PER_M : m) * 10) / 10);
const toMetres = (str: string, sys: SystemUnit) => {
  const v = parseFloat(str);
  if (!Number.isFinite(v) || v <= 0) return null;
  return sys === "imperial" ? v / FT_PER_M : v;
};

interface DragState {
  deviceId: string;
  x: number; // client coords, for the floating ghost
  y: number;
}

function PinDot({ device, active }: { device: SubDevice | undefined; active?: boolean }) {
  const isSensor = device?.type !== "actuator";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-mono whitespace-nowrap select-none",
        isSensor
          ? "bg-gn-green/20 border-gn-green-light/60 text-gn-green-light"
          : "bg-gn-amber/15 border-gn-amber/60 text-gn-amber",
        active ? "shadow-[0_0_14px_rgba(217,164,65,0.35)]" : "",
      ].join(" ")}
    >
      <span className={`w-2 h-2 rounded-full ${isSensor ? "bg-gn-green-light" : "bg-gn-amber"}`} />
      {device?.name ?? "Unknown"}
    </span>
  );
}

export default function GreenhouseTab() {
  const { deviceId, subDevices, fetchSubDevices } = useDashboardStore();
  const { temp, system, setTemp, setSystem } = useSettingsStore();

  const [name, setName] = useState("");
  const [lengthStr, setLengthStr] = useState("12");
  const [widthStr, setWidthStr] = useState("6");
  const [pins, setPins] = useState<LayoutPin[]>([]);
  const [location, setLocation] = useState<GreenhouseLayout["location"]>(null);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [drag, setDrag] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef(system);

  useEffect(() => {
    if (!subDevices.data) fetchSubDevices();
  }, [subDevices.data, fetchSubDevices]);

  useEffect(() => {
    getGreenhouseLayout(deviceId).then((l) => {
      setName(l.name);
      setLengthStr(toDisplay(l.lengthM, systemRef.current));
      setWidthStr(toDisplay(l.widthM, systemRef.current));
      setPins(l.pins);
      setLocation(l.location);
      setLoaded(true);
    });
  }, [deviceId]);

  const devices = subDevices.data ?? [];
  const byId = (id: string) => devices.find((d) => d.id === id);
  const unplaced = devices.filter((d) => !pins.some((p) => p.deviceId === d.id));

  const changeSystem = (next: SystemUnit) => {
    // Re-express the typed dimensions in the new unit so the physical size stays the same.
    const l = toMetres(lengthStr, system);
    const w = toMetres(widthStr, system);
    if (l) setLengthStr(toDisplay(l, next));
    if (w) setWidthStr(toDisplay(w, next));
    systemRef.current = next;
    setSystem(next);
  };

  const lengthM = toMetres(lengthStr, system);
  const widthM = toMetres(widthStr, system);
  const ratio = lengthM && widthM ? lengthM / widthM : 2;
  const dimsValid = lengthM !== null && widthM !== null;

  /* ── Drag & drop with plain pointer events ── */
  const pointToFraction = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const inside =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    return {
      inside,
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    setDrag({ deviceId: id, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!drag) return;
    const id = drag.deviceId;

    const onMove = (e: PointerEvent) => {
      setDrag({ deviceId: id, x: e.clientX, y: e.clientY });
      const pt = pointToFraction(e.clientX, e.clientY);
      // Existing pins follow the pointer live while it is over the canvas.
      if (pt?.inside) {
        setPins((prev) =>
          prev.some((p) => p.deviceId === id)
            ? prev.map((p) => (p.deviceId === id ? { ...p, x: pt.x, y: pt.y } : p))
            : prev
        );
      }
    };
    const onUp = (e: PointerEvent) => {
      const pt = pointToFraction(e.clientX, e.clientY);
      if (pt?.inside) {
        setPins((prev) =>
          prev.some((p) => p.deviceId === id)
            ? prev.map((p) => (p.deviceId === id ? { ...p, x: pt.x, y: pt.y } : p))
            : [...prev, { deviceId: id, x: pt.x, y: pt.y }]
        );
        setNote(null);
      }
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // Only (re)bind when a drag starts or ends, not on every pointer move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.deviceId, pointToFraction]);

  const nudgePin = (e: React.KeyboardEvent, id: string) => {
    const step = 0.02;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
      e.key as "ArrowLeft"
    ];
    if (e.key === "Delete" || e.key === "Backspace") {
      setPins((prev) => prev.filter((p) => p.deviceId !== id));
      return;
    }
    if (!d) return;
    e.preventDefault();
    setPins((prev) =>
      prev.map((p) => (p.deviceId === id ? { ...p, x: clamp01(p.x + d[0]), y: clamp01(p.y + d[1]) } : p))
    );
  };

  const removePin = (id: string) => setPins((prev) => prev.filter((p) => p.deviceId !== id));

  /* ── Location ── */
  const resetLocation = () => {
    setLocNote(null);
    if (!navigator.geolocation) {
      setLocNote("Geolocation is not supported in this browser.");
      return;
    }
    setLocNote("Waiting for permission…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocNote(null);
      },
      () => setLocNote("Location permission was denied or unavailable."),
      { timeout: 10000 }
    );
  };

  /* ── Save ── */
  const save = async () => {
    if (!name.trim() || lengthM === null || widthM === null) return;
    setSaving(true);
    setNote(null);
    try {
      await setGreenhouseLayout(deviceId, { name: name.trim(), lengthM, widthM, pins, location });
      setNote("Layout saved");
    } catch {
      setNote("Could not save layout");
    } finally {
      setSaving(false);
    }
  };

  const unitLabel = system === "imperial" ? "ft" : "m";

  return (
    <div className="space-y-5">
      {/* 1. Identity */}
      <DashboardCard variant="green" delay={0}>
        <SectionHeader title="Greenhouse identity" hint="Dimensions set the proportions of the layout canvas." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Greenhouse name" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-1" />
          <Input
            label={`Length (${unitLabel})`}
            type="number"
            inputMode="decimal"
            min="0"
            value={lengthStr}
            onChange={(e) => setLengthStr(e.target.value)}
            error={lengthM === null ? "Enter a positive number" : undefined}
          />
          <Input
            label={`Width (${unitLabel})`}
            type="number"
            inputMode="decimal"
            min="0"
            value={widthStr}
            onChange={(e) => setWidthStr(e.target.value)}
            error={widthM === null ? "Enter a positive number" : undefined}
          />
        </div>
      </DashboardCard>

      {/* 2. Layout designer */}
      <DashboardCard variant="amber" delay={1} loading={!loaded}>
        <SectionHeader
          title="Layout designer"
          hint="Drag a device onto the canvas. A rough position is enough — arrow keys nudge a focused pin, Delete removes it."
          action={
            <Button size="sm" onClick={save} disabled={saving || !name.trim() || !dimsValid}>
              {saving ? "Saving…" : "Save layout"}
            </Button>
          }
        />

        {/* Unplaced devices */}
        <div className="mb-4 min-h-10">
          <p className="text-[10px] uppercase tracking-wider font-mono text-gn-text-muted mb-2">
            Not placed ({unplaced.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unplaced.length === 0 && (
              <span className="text-xs text-gn-text-dim">
                {devices.length === 0 ? "No devices connected yet." : "All devices are placed."}
              </span>
            )}
            {unplaced.map((d) => (
              <div
                key={d.id}
                onPointerDown={(e) => startDrag(e, d.id)}
                style={{ touchAction: "none" }}
                className="cursor-grab active:cursor-grabbing"
                title="Drag onto the canvas"
              >
                <PinDot device={d} />
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="mx-auto w-full" style={{ maxWidth: `${Math.round(380 * ratio)}px` }}>
          <div
            ref={canvasRef}
            data-testid="layout-canvas"
            className={[
              "relative w-full rounded-xl border-2 border-dashed overflow-hidden",
              "bg-gn-bg-deep bg-[radial-gradient(circle,rgba(86,107,94,0.28)_1px,transparent_1px)] bg-size-[24px_24px]",
              drag ? "border-gn-amber/60" : "border-gn-green/40",
            ].join(" ")}
            style={{ aspectRatio: String(ratio) }}
          >
            {pins.map((p) => {
              const dev = byId(p.deviceId);
              return (
                <div
                  key={p.deviceId}
                  tabIndex={0}
                  role="button"
                  aria-label={`${dev?.name ?? "Device"} pin. Arrow keys to move, Delete to remove.`}
                  onPointerDown={(e) => startDrag(e, p.deviceId)}
                  onKeyDown={(e) => nudgePin(e, p.deviceId)}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, touchAction: "none" }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-gn-amber rounded-full"
                >
                  <PinDot device={dev} active={drag?.deviceId === p.deviceId} />
                </div>
              );
            })}
            {pins.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-gn-text-dim pointer-events-none">
                Drop devices here
              </p>
            )}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-gn-text-dim mt-1.5 px-0.5">
            <span>
              {lengthStr || "—"} {unitLabel}
            </span>
            <span>
              {widthStr || "—"} {unitLabel} wide
            </span>
          </div>
        </div>

        {/* Placed list, for removal without dragging */}
        {pins.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pins.map((p) => (
              <button
                key={p.deviceId}
                onClick={() => removePin(p.deviceId)}
                className="text-[11px] font-mono px-2 py-1 rounded-md border border-gn-text-dim/20 text-gn-text-muted hover:text-gn-text hover:border-gn-amber/40 cursor-pointer"
                aria-label={`Remove ${byId(p.deviceId)?.name ?? "device"} from canvas`}
              >
                {byId(p.deviceId)?.name ?? p.deviceId} ✕
              </button>
            ))}
          </div>
        )}
        {note && (
          <p className="text-xs text-gn-green-light mt-3" role="status">
            {note}
          </p>
        )}
      </DashboardCard>

      {/* 3. Location */}
      <DashboardCard variant="green" delay={2}>
        <SectionHeader
          title="Location"
          hint="Used for weather context and sunrise / sunset."
          action={
            <Button size="sm" variant="secondary" onClick={resetLocation}>
              {location ? "Reset location" : "Set location"}
            </Button>
          }
        />
        <p className="text-sm font-mono text-gn-text">
          {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Not set"}
        </p>
        {locNote && (
          <p className="text-xs text-gn-amber mt-2" role="status">
            {locNote}
          </p>
        )}
      </DashboardCard>

      {/* 4. Units */}
      <DashboardCard variant="green" delay={3}>
        <SectionHeader title="Units" hint="Applies to every metric on the dashboard." />
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-mono text-gn-text-muted">Temperature</p>
            <SegmentedControl
              label="Temperature unit"
              value={temp}
              onChange={setTemp}
              options={[
                { value: "C", label: "°C" },
                { value: "F", label: "°F" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-mono text-gn-text-muted">Measurements</p>
            <SegmentedControl
              label="Measurement system"
              value={system}
              onChange={changeSystem}
              options={[
                { value: "metric", label: "Metric" },
                { value: "imperial", label: "Imperial" },
              ]}
            />
          </div>
        </div>
      </DashboardCard>

      {/* Floating ghost while dragging */}
      {drag && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: drag.x, top: drag.y }}
        >
          <PinDot device={byId(drag.deviceId)} active />
        </div>
      )}
    </div>
  );
}
