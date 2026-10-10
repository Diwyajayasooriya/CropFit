// ============================================================
// CropFit — Zustand Dashboard Store
// Holds live dashboard state: sensor tiles, actuator states,
// and WebSocket connection management.
// ============================================================

import { create } from 'zustand';
import type {
  DashboardSummary,
  SensorReading,
} from '@/types';
import { CropFitWebSocket, createWebSocket } from '@/lib/websocket';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/store/toast-store';

interface DashboardState {
  summary: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
  wsConnected: boolean;

  // Actions
  fetchDashboard: (greenhouseId?: number) => Promise<void>;
  updateTile: (sensorId: string, value: number, timestamp: string) => void;
  updateActuator: (actuatorId: string, isActive: boolean) => Promise<void>;

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

  fetchDashboard: async (greenhouseId) => {
    set({ isLoading: true, error: null });

    try {
      const data = await apiFetch.get<DashboardSummary>(`/reports/dashboard/${greenhouseId ? `?greenhouse=${greenhouseId}` : ''}`);
      set({ summary: data, isLoading: false });
    } catch (error) {
      set({ summary: null, isLoading: false, error: error instanceof Error ? error.message : 'Could not load dashboard.' });
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

  updateActuator: async (actuatorId: string, isActive: boolean) => {
    const current = get().summary;
    if (!current) return;

    try {
      // Real API call to edge gateway (assuming it's routed through the same API_BASE or configured differently)
      // For now, following the pattern of wiring to real APIs:
      await apiFetch.post(`/nodes/actuators/${actuatorId}/command/`, {
        action: isActive ? 'ON' : 'OFF',
      });

        // Queue acceptance is not a physical state change. Confirmed state is
        // refreshed separately by the dashboard/command status endpoint.
    } catch (err) {
      console.error('Failed to update actuator:', err);
      toast.error('Could not send command to edge device.', 'Actuator Error');
    }
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
      const current = get().summary;
      if (current) set({ summary: { ...current, actuators: current.actuators.map(a => a.actuator_id === data.actuator_id ? { ...a, is_active: data.is_active } : a) } });
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
