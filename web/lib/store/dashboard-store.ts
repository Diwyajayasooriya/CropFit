// ============================================================
// CropFit — Zustand Dashboard Store
// Holds live dashboard state: sensor tiles, actuator states,
// and WebSocket connection management.
// ============================================================

import { create } from 'zustand';
import type {
  DashboardSummary,
  DashboardTile,
  ActuatorState,
  SensorReading,
} from '@/types';
import { CropFitWebSocket, createWebSocket } from '@/lib/websocket';
import { apiFetch } from '@/lib/api';
import { mockDashboard } from '@/lib/mock-data';

interface DashboardState {
  summary: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
  wsConnected: boolean;

  // Actions
  fetchDashboard: () => Promise<void>;
  updateTile: (sensorId: string, value: number, timestamp: string) => void;
  updateActuator: (actuatorId: string, isActive: boolean) => void;

  // WebSocket
  ws: CropFitWebSocket | null;
  connectWS: (token: string) => void;
  disconnectWS: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  summary: null,
  isLoading: true,
  error: null,
  wsConnected: false,
  ws: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });

    try {
      const data = await apiFetch.get<DashboardSummary>('/dashboard/summary/');
      set({ summary: data, isLoading: false });
    } catch {
      // Fall back to mock data in dev
      console.warn('[Dashboard] Backend unreachable, using mock data');
      set({ summary: mockDashboard, isLoading: false });
    }
  },

  updateTile: (sensorId: string, value: number, timestamp: string) => {
    const current = get().summary;
    if (!current) return;

    const updatedTiles = current.tiles.map((tile) =>
      tile.sensor_id === sensorId
        ? { ...tile, value, updated_at: timestamp }
        : tile
    );

    set({
      summary: { ...current, tiles: updatedTiles },
    });
  },

  updateActuator: (actuatorId: string, isActive: boolean) => {
    const current = get().summary;
    if (!current) return;

    const updatedActuators = current.actuators.map((act) =>
      act.actuator_id === actuatorId
        ? { ...act, is_active: isActive }
        : act
    );

    set({
      summary: { ...current, actuators: updatedActuators },
    });
  },

  connectWS: (token: string) => {
    // Disconnect any existing connection
    get().disconnectWS();

    const ws = createWebSocket({
      path: '/dashboard/',
      token,
      onOpen: () => {
        set({ wsConnected: true });
      },
      onClose: () => {
        set({ wsConnected: false });
      },
    });

    // Type-specific handlers
    ws.on<SensorReading>('sensor_update', (reading) => {
      get().updateTile(reading.sensor_id, reading.value, reading.timestamp);
    });

    ws.on<{ actuator_id: string; is_active: boolean }>('actuator_update', (data) => {
      get().updateActuator(data.actuator_id, data.is_active);
    });

    ws.on<{ message: string; overall_status: 'healthy' | 'warning' | 'critical' }>(
      'summary_update',
      (data) => {
        const current = get().summary;
        if (current) {
          set({
            summary: {
              ...current,
              message: data.message,
              overall_status: data.overall_status,
            },
          });
        }
      }
    );

    ws.connect();
    set({ ws });
  },

  disconnectWS: () => {
    const { ws } = get();
    if (ws) {
      ws.disconnect();
      set({ ws: null, wsConnected: false });
    }
  },
}));
