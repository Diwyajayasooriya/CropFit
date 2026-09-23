// ============================================================
// CropFit — Mock Data
// Hardcoded data that mirrors the Django backend's API shapes.
// Swap for real API calls when backend is ready.
// ============================================================

import type {
  User,
  UserRole,
  Sensor,
  Actuator,
  Hub,
  DashboardSummary,
  SensorReading,
  Rule,
  Alert,
} from '@/types';

// ---- User ----

export const mockUsersByRole: Record<UserRole, User> = {
  farmer: {
    id: 1,
    email: 'farmer@cropfit.io',
    first_name: 'Dulaj',
    last_name: 'Jayasooriya',
    role: 'farmer',
  },
  technician: {
    id: 2,
    email: 'tech@cropfit.io',
    first_name: 'Kasun',
    last_name: 'Perera',
    role: 'technician',
  },
  admin: {
    id: 3,
    email: 'admin@cropfit.io',
    first_name: 'Saman',
    last_name: 'Silva',
    role: 'admin',
  },
};

export const mockUser: User = mockUsersByRole.farmer;

// ---- Devices ----

export const mockHub: Hub = {
  id: 'hub-001',
  name: 'Greenhouse A Hub',
  type: 'hub',
  protocol: 'wifi',
  status: 'online',
  last_seen: new Date().toISOString(),
  created_at: '2026-01-15T08:00:00Z',
  firmware_version: '1.2.0',
  location: 'Greenhouse A — Main',
  connected_devices: 6,
  ip_address: '192.168.1.100',
};

export const mockSensors: Sensor[] = [
  {
    id: 'sensor-temp-01',
    name: 'Temperature Sensor A1',
    type: 'sensor',
    sensor_kind: 'temperature',
    protocol: 'mqtt',
    status: 'online',
    hub_id: 'hub-001',
    unit: '°C',
    last_value: 27.4,
    min_threshold: 18,
    max_threshold: 35,
    last_seen: new Date().toISOString(),
    created_at: '2026-01-15T08:00:00Z',
    location: 'Zone A — North Wall',
  },
  {
    id: 'sensor-hum-01',
    name: 'Humidity Sensor A1',
    type: 'sensor',
    sensor_kind: 'humidity',
    protocol: 'mqtt',
    status: 'online',
    hub_id: 'hub-001',
    unit: '%',
    last_value: 68,
    min_threshold: 40,
    max_threshold: 85,
    last_seen: new Date().toISOString(),
    created_at: '2026-01-15T08:00:00Z',
    location: 'Zone A — Center',
  },
  {
    id: 'sensor-soil-01',
    name: 'Soil Moisture Sensor A1',
    type: 'sensor',
    sensor_kind: 'soil_moisture',
    protocol: 'zigbee',
    status: 'online',
    hub_id: 'hub-001',
    unit: '%',
    last_value: 42,
    min_threshold: 20,
    max_threshold: 70,
    last_seen: new Date().toISOString(),
    created_at: '2026-02-01T08:00:00Z',
    location: 'Zone A — Bed 3',
  },
  {
    id: 'sensor-light-01',
    name: 'Light Sensor A1',
    type: 'sensor',
    sensor_kind: 'light',
    protocol: 'wifi',
    status: 'online',
    hub_id: 'hub-001',
    unit: 'lux',
    last_value: 12400,
    min_threshold: 5000,
    max_threshold: 50000,
    last_seen: new Date().toISOString(),
    created_at: '2026-02-01T08:00:00Z',
    location: 'Zone A — Ceiling',
  },
  {
    id: 'sensor-co2-01',
    name: 'CO₂ Sensor A1',
    type: 'sensor',
    sensor_kind: 'co2',
    protocol: 'mqtt',
    status: 'offline',
    hub_id: 'hub-001',
    unit: 'ppm',
    last_value: 620,
    min_threshold: 300,
    max_threshold: 1000,
    last_seen: new Date(Date.now() - 3600_000).toISOString(),
    created_at: '2026-03-10T08:00:00Z',
    location: 'Zone A — South Wall',
  },
];

export const mockActuators: Actuator[] = [
  {
    id: 'act-pump-01',
    name: 'Irrigation Pump A1',
    type: 'actuator',
    actuator_kind: 'pump',
    protocol: 'mqtt',
    status: 'online',
    hub_id: 'hub-001',
    is_active: true,
    auto_mode: true,
    last_seen: new Date().toISOString(),
    created_at: '2026-01-15T08:00:00Z',
    location: 'Zone A — Water Main',
  },
  {
    id: 'act-fan-01',
    name: 'Exhaust Fan A1',
    type: 'actuator',
    actuator_kind: 'fan',
    protocol: 'wifi',
    status: 'online',
    hub_id: 'hub-001',
    is_active: false,
    auto_mode: true,
    last_seen: new Date().toISOString(),
    created_at: '2026-01-15T08:00:00Z',
    location: 'Zone A — North Wall',
  },
  {
    id: 'act-vent-01',
    name: 'Roof Vent A1',
    type: 'actuator',
    actuator_kind: 'vent',
    protocol: 'zigbee',
    status: 'online',
    hub_id: 'hub-001',
    is_active: false,
    auto_mode: false,
    last_seen: new Date().toISOString(),
    created_at: '2026-02-01T08:00:00Z',
    location: 'Zone A — Roof',
  },
];

// ---- Dashboard ----

export const mockDashboard: DashboardSummary = {
  message: 'Irrigation active — soil moisture at 42%. All systems healthy.',
  overall_status: 'healthy',
  tiles: mockSensors.map((s) => ({
    sensor_id: s.id,
    sensor_name: s.name,
    sensor_kind: s.sensor_kind,
    value: s.last_value ?? 0,
    unit: s.unit,
    status: s.status,
    trend: 'stable' as const,
    updated_at: s.last_seen,
  })),
  actuators: mockActuators.map((a) => ({
    actuator_id: a.id,
    name: a.name,
    actuator_kind: a.actuator_kind,
    is_active: a.is_active,
    auto_mode: a.auto_mode,
    status: a.status,
  })),
};

// ---- Telemetry (generate fake time series) ----

function generateReadings(
  sensorId: string,
  baseValue: number,
  unit: string,
  variance: number,
  hours: number = 24
): SensorReading[] {
  const readings: SensorReading[] = [];
  const now = Date.now();

  for (let i = hours; i >= 0; i--) {
    const jitter = (Math.random() - 0.5) * 2 * variance;
    readings.push({
      id: `${sensorId}-reading-${i}`,
      sensor_id: sensorId,
      value: Math.round((baseValue + jitter) * 10) / 10,
      unit,
      timestamp: new Date(now - i * 3600_000).toISOString(),
    });
  }
  return readings;
}

export const mockTemperatureReadings = generateReadings('sensor-temp-01', 27, '°C', 3);
export const mockHumidityReadings = generateReadings('sensor-hum-01', 68, '%', 8);
export const mockSoilMoistureReadings = generateReadings('sensor-soil-01', 42, '%', 5);
export const mockLightReadings = generateReadings('sensor-light-01', 12000, 'lux', 4000);

// ---- Rules ----

export const mockRules: Rule[] = [
  {
    id: 'rule-001',
    name: 'Low Moisture Irrigation',
    description: 'When soil moisture drops below 25%, turn on the irrigation pump.',
    condition: {
      sensor_id: 'sensor-soil-01',
      sensor_kind: 'soil_moisture',
      operator: 'lt',
      threshold: 25,
    },
    action: {
      actuator_id: 'act-pump-01',
      actuator_kind: 'pump',
      action: 'turn_on',
    },
    is_active: true,
    last_triggered: new Date(Date.now() - 7200_000).toISOString(),
    created_at: '2026-02-15T08:00:00Z',
  },
  {
    id: 'rule-002',
    name: 'High Temperature Ventilation',
    description: 'When temperature exceeds 32°C, open the roof vent and start the exhaust fan.',
    condition: {
      sensor_id: 'sensor-temp-01',
      sensor_kind: 'temperature',
      operator: 'gt',
      threshold: 32,
    },
    action: {
      actuator_id: 'act-vent-01',
      actuator_kind: 'vent',
      action: 'turn_on',
    },
    is_active: true,
    last_triggered: undefined,
    created_at: '2026-02-15T08:00:00Z',
  },
  {
    id: 'rule-003',
    name: 'Night Light Off',
    description: 'When light level is above 10,000 lux, turn off supplemental lighting.',
    condition: {
      sensor_id: 'sensor-light-01',
      sensor_kind: 'light',
      operator: 'gt',
      threshold: 10000,
    },
    action: {
      actuator_id: 'act-fan-01', // placeholder
      actuator_kind: 'light',
      action: 'turn_off',
    },
    is_active: false,
    created_at: '2026-03-01T08:00:00Z',
  },
];

// ---- Alerts ----

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    title: 'CO₂ Sensor Offline',
    message: 'CO₂ Sensor A1 has been unreachable for over 1 hour. Check connectivity.',
    severity: 'warning',
    is_read: false,
    device_id: 'sensor-co2-01',
    created_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'alert-002',
    title: 'Irrigation Activated',
    message: 'Rule "Low Moisture Irrigation" triggered — pump started. Soil moisture was at 22%.',
    severity: 'info',
    is_read: false,
    rule_id: 'rule-001',
    created_at: new Date(Date.now() - 7200_000).toISOString(),
  },
  {
    id: 'alert-003',
    title: 'High Temperature Warning',
    message: 'Temperature in Zone A reached 34.2°C, exceeding the 32°C threshold.',
    severity: 'critical',
    is_read: true,
    device_id: 'sensor-temp-01',
    rule_id: 'rule-002',
    created_at: new Date(Date.now() - 86400_000).toISOString(),
  },
];
