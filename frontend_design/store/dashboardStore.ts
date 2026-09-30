import { create } from "zustand";
import type {
  DeviceHealth,
  SubDevice,
  GreenhouseData,
  ActionPanelData,
} from "@/api/types";
import {
  getDeviceHealth,
  getSubDevices,
  toggleSubDeviceSleep,
  getGreenhouseMetrics,
  getSuggestedActions,
  runAction,
} from "@/api/device";

interface AsyncSlice<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface DashboardState {
  deviceId: string;
  deviceName: string;

  health: AsyncSlice<DeviceHealth>;
  subDevices: AsyncSlice<SubDevice[]>;
  greenhouse: AsyncSlice<GreenhouseData>;
  actionPanel: AsyncSlice<ActionPanelData>;

  setDeviceName: (name: string) => void;

  fetchHealth: () => Promise<void>;
  fetchSubDevices: () => Promise<void>;
  fetchGreenhouse: () => Promise<void>;
  fetchActionPanel: () => Promise<void>;

  toggleMode: () => void;
  toggleSleep: (subDeviceId: string) => Promise<void>;
  executeAction: (actionId: string) => Promise<void>;
  addDevice: (device: SubDevice) => void;
}

const initialAsync = <T>(): AsyncSlice<T> => ({
  data: null,
  loading: false,
  error: null,
});

export const useDashboardStore = create<DashboardState>((set, get) => ({
  deviceId: "GN-HUB-PERA-01",
  deviceName: "GreenNode Hub Alpha",

  health: initialAsync<DeviceHealth>(),
  subDevices: initialAsync<SubDevice[]>(),
  greenhouse: initialAsync<GreenhouseData>(),
  actionPanel: initialAsync<ActionPanelData>(),

  setDeviceName: (name) => set({ deviceName: name }),

  fetchHealth: async () => {
    set({ health: { data: get().health.data, loading: true, error: null } });
    try {
      const data = await getDeviceHealth(get().deviceId);
      set({ health: { data, loading: false, error: null } });
    } catch {
      set({
        health: {
          data: null,
          loading: false,
          error: "Failed to fetch device health",
        },
      });
    }
  },

  fetchSubDevices: async () => {
    set({
      subDevices: {
        data: get().subDevices.data,
        loading: true,
        error: null,
      },
    });
    try {
      const data = await getSubDevices(get().deviceId);
      set({ subDevices: { data, loading: false, error: null } });
    } catch {
      set({
        subDevices: {
          data: null,
          loading: false,
          error: "Failed to fetch sub-devices",
        },
      });
    }
  },

  fetchGreenhouse: async () => {
    set({
      greenhouse: {
        data: get().greenhouse.data,
        loading: true,
        error: null,
      },
    });
    try {
      const data = await getGreenhouseMetrics(get().deviceId);
      set({ greenhouse: { data, loading: false, error: null } });
    } catch {
      set({
        greenhouse: {
          data: null,
          loading: false,
          error: "Failed to fetch greenhouse metrics",
        },
      });
    }
  },

  fetchActionPanel: async () => {
    set({
      actionPanel: {
        data: get().actionPanel.data,
        loading: true,
        error: null,
      },
    });
    try {
      const data = await getSuggestedActions(get().deviceId);
      set({ actionPanel: { data, loading: false, error: null } });
    } catch {
      set({
        actionPanel: {
          data: null,
          loading: false,
          error: "Failed to fetch action panel data",
        },
      });
    }
  },

  toggleMode: () => {
    const current = get().health.data;
    if (!current) return;
    const newMode = current.mode === "manual" ? "scareclaw" : "manual";
    set({
      health: {
        ...get().health,
        data: { ...current, mode: newMode as "manual" | "scareclaw" },
      },
    });
  },

  toggleSleep: async (subDeviceId) => {
    try {
      const updated = await toggleSubDeviceSleep(get().deviceId, subDeviceId);
      const current = get().subDevices.data;
      if (current) {
        set({
          subDevices: {
            ...get().subDevices,
            data: current.map((d) =>
              d.id === subDeviceId ? { ...d, isAwake: !d.isAwake } : d
            ),
          },
        });
      }
      return void updated;
    } catch {
      // Silently fail — could add toast notification
    }
  },

  executeAction: async (actionId) => {
    try {
      await runAction(get().deviceId, actionId);
      const current = get().actionPanel.data;
      if (current) {
        set({
          actionPanel: {
            ...get().actionPanel,
            data: {
              ...current,
              suggestedActions: current.suggestedActions.map((a) =>
                a.id === actionId ? { ...a, status: "running" as const } : a
              ),
            },
          },
        });
      }
    } catch {
      // Silently fail
    }
  },

  addDevice: (newDevice) => {
    const currentSubDevices = get().subDevices.data || [];
    const currentHealth = get().health.data;
    set({
      subDevices: {
        ...get().subDevices,
        data: [newDevice, ...currentSubDevices],
      },
      health: currentHealth
        ? {
            ...get().health,
            data: {
              ...currentHealth,
              connectedSubDevices: currentHealth.connectedSubDevices + 1,
            },
          }
        : get().health,
    });
  },
}));
