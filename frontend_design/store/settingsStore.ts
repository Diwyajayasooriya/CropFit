import { create } from "zustand";
import type { TempUnit, SystemUnit } from "@/api/types";

const STORAGE_KEY = "gn_units";

interface SettingsState {
  temp: TempUnit;
  system: SystemUnit;
  hydrated: boolean;
  hydrate: () => void;
  setTemp: (t: TempUnit) => void;
  setSystem: (s: SystemUnit) => void;
}

function persist(temp: TempUnit, system: SystemUnit) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ temp, system }));
  } catch {
    // storage unavailable — preference lasts for the session only
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  temp: "C",
  system: "metric",
  hydrated: false,

  // Called from an effect so server and first client render agree.
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { temp?: TempUnit; system?: SystemUnit };
        set({
          temp: parsed.temp === "F" ? "F" : "C",
          system: parsed.system === "imperial" ? "imperial" : "metric",
        });
      }
    } catch {
      // ignore corrupt value
    }
    set({ hydrated: true });
  },

  setTemp: (temp) => {
    set({ temp });
    persist(temp, get().system);
  },

  setSystem: (system) => {
    set({ system });
    persist(get().temp, system);
  },
}));
