"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from "@/api/device";
import type { Schedule, SchedulePayload, SubDevice } from "@/api/types";
import DashboardCard from "@/components/dashboard/DashboardCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ListRow from "@/components/ui/ListRow";
import Toggle from "@/components/ui/Toggle";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SectionHeader from "./SectionHeader";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ACTIONS = ["Turn On", "Open", "Start Cycle"];

/* ── Conflict heuristic (client-side) ──
 * Two enabled schedules conflict when they target the same actuator, can fall on
 * the same day, and their [start, start + duration) windows overlap. This is a
 * hint only; the backend remains the source of truth. */
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const weekdayOf = (isoDate: string) => new Date(`${isoDate}T00:00:00`).getDay();

function daysOf(s: Schedule): number[] {
  return s.recurrence.kind === "recurring" ? s.recurrence.days : [weekdayOf(s.recurrence.date)];
}

function conflicts(a: Schedule, b: Schedule) {
  if (a.id === b.id || !a.enabled || !b.enabled || a.actuatorId !== b.actuatorId) return false;
  if (a.recurrence.kind === "once" && b.recurrence.kind === "once" && a.recurrence.date !== b.recurrence.date) {
    return false;
  }
  if (!daysOf(a).some((d) => daysOf(b).includes(d))) return false;
  const aStart = toMinutes(a.time);
  const bStart = toMinutes(b.time);
  return aStart < bStart + b.durationMin && bStart < aStart + a.durationMin;
}

function describe(s: Schedule) {
  const when =
    s.recurrence.kind === "once"
      ? new Date(`${s.recurrence.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : s.recurrence.days.length === 7
        ? "Every day"
        : s.recurrence.days.map((d) => DAY_NAMES[d]).join(", ");
  return `${when} · ${s.time} · ${s.durationMin} min`;
}

const today = () => new Date().toISOString().slice(0, 10);

const selectClass =
  "w-full bg-gn-surface/80 text-gn-text rounded-xl px-4 py-3 text-sm font-body border border-gn-text-dim/30 outline-none focus:border-gn-green transition-colors";

function ScheduleForm({
  actuators,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  actuators: SubDevice[];
  initial: Schedule | null;
  busy: boolean;
  onSave: (p: SchedulePayload) => void;
  onCancel: () => void;
}) {
  const [actuatorId, setActuatorId] = useState(initial?.actuatorId ?? actuators[0]?.id ?? "");
  const [action, setAction] = useState(initial?.action ?? ACTIONS[0]);
  const [kind, setKind] = useState<"once" | "recurring">(initial?.recurrence.kind ?? "recurring");
  const [date, setDate] = useState(initial?.recurrence.kind === "once" ? initial.recurrence.date : today());
  const [days, setDays] = useState<number[]>(initial?.recurrence.kind === "recurring" ? initial.recurrence.days : [1, 2, 3, 4, 5]);
  const [time, setTime] = useState(initial?.time ?? "06:00");
  const [duration, setDuration] = useState(String(initial?.durationMin ?? 15));

  const durationNum = parseInt(duration, 10);
  const valid =
    !!actuatorId && !!time && durationNum > 0 && (kind === "once" ? !!date : days.length > 0);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      actuatorId,
      action,
      time,
      durationMin: durationNum,
      enabled: initial?.enabled ?? true,
      recurrence: kind === "once" ? { kind: "once", date } : { kind: "recurring", days },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4 rounded-2xl bg-gn-surface-raised/70 border border-gn-amber/25 mb-4">
      <p className="text-xs font-heading font-semibold uppercase tracking-wider text-gn-amber">
        {initial ? "Edit schedule" : "New schedule"}
      </p>

      {/* Step 1: actuator + action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gn-text-muted">Actuator</span>
          <select className={selectClass} value={actuatorId} onChange={(e) => setActuatorId(e.target.value)}>
            {actuators.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 block">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gn-text-muted">Action</span>
          <select className={selectClass} value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Step 2: one-time or recurring */}
      <SegmentedControl
        label="Schedule type"
        value={kind}
        onChange={setKind}
        options={[
          { value: "recurring", label: "Recurring" },
          { value: "once", label: "One-time" },
        ]}
      />

      {/* Step 3: when */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kind === "once" ? (
          <Input label="Date" type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        ) : (
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gn-text-muted">Repeat on</span>
            <div className="flex gap-1" role="group" aria-label="Days of week">
              {DAYS.map((label, d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={[
                    "w-8 h-8 rounded-lg border text-xs font-mono cursor-pointer transition-colors",
                    days.includes(d)
                      ? "bg-gn-green/25 border-gn-green-light/60 text-gn-green-light"
                      : "border-gn-text-dim/25 text-gn-text-dim hover:text-gn-text",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <Input label="Start time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Input
          label="Duration (min)"
          type="number"
          min="1"
          inputMode="numeric"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2.5">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!valid || busy}>
          {busy ? "Saving…" : "Save schedule"}
        </Button>
      </div>
    </form>
  );
}

export default function AutomationTab() {
  const { deviceId, subDevices, fetchSubDevices } = useDashboardStore();

  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!subDevices.data) fetchSubDevices();
  }, [subDevices.data, fetchSubDevices]);

  useEffect(() => {
    getSchedules(deviceId)
      .then(setSchedules)
      .catch(() => setError("Failed to load schedules"));
  }, [deviceId]);

  const actuators = useMemo(() => (subDevices.data ?? []).filter((d) => d.type === "actuator"), [subDevices.data]);
  const actuatorName = (id: string) => actuators.find((a) => a.id === id)?.name ?? id;

  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const list = schedules ?? [];
    for (const a of list) {
      const others = list.filter((b) => conflicts(a, b)).map((b) => `${b.action} at ${b.time}`);
      if (others.length) map.set(a.id, others);
    }
    return map;
  }, [schedules]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Schedule) => {
    setEditing(s);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const save = async (payload: SchedulePayload) => {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateSchedule(deviceId, editing.id, payload);
        setSchedules((prev) => prev?.map((s) => (s.id === editing.id ? { ...s, ...payload } : s)) ?? prev);
      } else {
        const created = await createSchedule(deviceId, payload);
        setSchedules((prev) => [...(prev ?? []), created]);
      }
      closeForm();
    } catch {
      setError("Could not save schedule");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s: Schedule, enabled: boolean) => {
    const previous = schedules;
    setSchedules((prev) => prev?.map((x) => (x.id === s.id ? { ...x, enabled } : x)) ?? prev);
    try {
      await updateSchedule(deviceId, s.id, { enabled });
    } catch {
      setSchedules(previous);
      setError("Could not update schedule");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSchedule(deviceId, toDelete.id);
      setSchedules((prev) => prev?.filter((s) => s.id !== toDelete.id) ?? prev);
    } catch {
      setError("Could not delete schedule");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <DashboardCard variant="amber" delay={0} loading={schedules === null && !error}>
      <SectionHeader
        title="Scheduled automations"
        hint="Run actuators automatically. Disable a rule to pause it without deleting."
        action={
          !formOpen && (
            <Button size="sm" onClick={openNew} disabled={actuators.length === 0}>
              + New schedule
            </Button>
          )
        }
      />

      {formOpen && (
        <ScheduleForm
          key={editing?.id ?? "new"}
          actuators={actuators}
          initial={editing}
          busy={saving}
          onSave={save}
          onCancel={closeForm}
        />
      )}

      {error && (
        <p className="text-xs text-gn-amber mb-3" role="alert">
          {error}
        </p>
      )}

      {schedules && schedules.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gn-text-dim/20 p-8 text-center text-sm text-gn-text-muted">
          No schedules yet.
        </div>
      )}
      {actuators.length === 0 && subDevices.data && (
        <p className="text-xs text-gn-text-dim mb-3">Connect an actuator to create schedules.</p>
      )}

      <div className="space-y-2.5">
        {schedules?.map((s) => {
          const clash = conflictMap.get(s.id);
          return (
            <ListRow
              key={s.id}
              accent="amber"
              dimmed={!s.enabled}
              title={`${s.action} · ${actuatorName(s.actuatorId)}`}
              subtitle={describe(s)}
              leading={
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.enabled ? "bg-gn-amber" : "bg-gn-text-dim/50"}`} />
              }
              badges={
                <>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-gn-text-dim/20 text-gn-text-muted">
                    {s.recurrence.kind === "once" ? "One-time" : "Recurring"}
                  </span>
                  {clash && (
                    <span
                      title={`Overlaps with: ${clash.join("; ")}`}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md border border-gn-amber/40 bg-gn-amber/10 text-gn-amber"
                    >
                      ⚠ May overlap
                    </span>
                  )}
                </>
              }
              actions={
                <>
                  <Toggle checked={s.enabled} onChange={(v) => toggle(s, v)} label={`Enable ${s.action}`} />
                  <button
                    onClick={() => openEdit(s)}
                    aria-label="Edit schedule"
                    className="text-xs text-gn-text-muted hover:text-gn-text px-2 py-1 rounded-md hover:bg-gn-surface cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setToDelete(s)}
                    aria-label="Delete schedule"
                    className="text-xs text-red-400/80 hover:text-red-400 px-2 py-1 rounded-md hover:bg-red-500/10 cursor-pointer"
                  >
                    Delete
                  </button>
                </>
              }
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this schedule?"
        message={toDelete ? `“${toDelete.action} · ${actuatorName(toDelete.actuatorId)}” will no longer run.` : ""}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </DashboardCard>
  );
}
