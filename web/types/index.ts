// ============================================================
// CropFit — Shared TypeScript Types
// Matches Django backend models: accounts, devices, telemetry,
// rules, alerts
// ============================================================

// ---- Auth / Accounts ----

export type UserRole = 'farmer' | 'admin' | 'technician';

export interface User {
  id: number;
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url?: string;
  onboarding_completed?: boolean;
  onboarding_step?: 'CREATE_GREENHOUSE' | 'CLAIM_HUB' | 'CONFIGURE_DEVICES' | 'COMPLETED';
}


export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ---- Greenhouse ----

export interface Greenhouse {
  id: number;
  user: number;
  name: string;
  location: string;
  crop: string;
  plantation_date?: string;
  created_at: string;
  node_count: number;
}

// ---- Recommendation ----

export interface Recommendation {
  id: string;
  title: string;
  message: string;
  metrics?: Record<string, string>;
  action_label?: string;
  action_url?: string;
  created_at: string;
}

// ---- Devices ----

export type DeviceProtocol = 'wifi' | 'ble' | 'zigbee' | 'mqtt';
export type DeviceStatus = 'online' | 'offline' | 'error';
export type DeviceType = 'hub' | 'sensor' | 'actuator';
export type SensorKind = 'temperature' | 'humidity' | 'soil_moisture' | 'light' | 'co2' | 'ph';
export type ActuatorKind = 'pump' | 'fan' | 'vent' | 'light' | 'heater';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  protocol: DeviceProtocol;
  status: DeviceStatus;
  hub_id?: string;
  last_seen: string;        // ISO 8601
  created_at: string;
  firmware_version?: string;
  location?: string;
}

export interface Sensor extends Device {
  type: 'sensor';
  sensor_kind: SensorKind;
  unit: string;             // e.g. "°C", "%", "lux"
  last_value?: number;
  min_threshold?: number;
  max_threshold?: number;
}

export interface Actuator extends Device {
  type: 'actuator';
  actuator_kind: ActuatorKind;
  is_active: boolean;
  auto_mode: boolean;
}

export interface Hub extends Device {
  type: 'hub';
  connected_devices: number;
  ip_address?: string;
}

// ---- Telemetry ----

export interface SensorReading {
  id: string;
  sensor_id: string;
  value: number;
  unit: string;
  timestamp: string;        // ISO 8601
}

export interface TelemetryTimeSeries {
  sensor_id: string;
  sensor_name: string;
  sensor_kind: SensorKind;
  unit: string;
  readings: SensorReading[];
}

// ---- Dashboard ----

export interface DashboardTile {
  node_id?: number;
  device_id?: string;
  sensor_id: string;
  sensor_name: string;
  sensor_kind: SensorKind;
  value: number | null;
  unit: string;
  status: DeviceStatus;
  trend: 'up' | 'down' | 'stable' | null;
  updated_at: string;
}

export interface ActuatorState {
  id?: number;
  node?: number;
  confirmed_at?: string | null;
  actuator_id: string;
  name: string;
  actuator_kind: ActuatorKind;
  is_active: boolean;
  auto_mode: boolean;
  status: DeviceStatus;
}

export interface DashboardSummary {
  message: string;          // e.g. "Irrigation active — soil moisture 24%"
  overall_status: 'healthy' | 'warning' | 'critical';
  tiles: DashboardTile[];
  actuators: ActuatorState[];
}

// ---- WebSocket Messages ----

export type WSMessageType =
  | 'sensor_update'
  | 'actuator_update'
  | 'device_status'
  | 'alert'
  | 'summary_update';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
  timestamp: string;
}

// ---- Rules ----

export type RuleConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

export interface RuleCondition {
  sensor_id: string;
  sensor_kind: SensorKind;
  operator: RuleConditionOperator;
  threshold: number;
}

export interface RuleAction {
  actuator_id: string;
  actuator_kind: ActuatorKind;
  action: 'turn_on' | 'turn_off' | 'set_value';
  value?: number;
}

export interface Rule {
  id: string;
  name: string;
  description: string;      // plain-language description
  condition: RuleCondition;
  action: RuleAction;
  is_active: boolean;
  last_triggered?: string;
  created_at: string;
}

// ---- Alerts ----

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_resolved: boolean;
  device_id?: string;
  rule_id?: string;
  created_at: string;
}

// ---- API Response Wrappers ----

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail: string;
  message?: string;
  error?: string;
  code?: string;
  retry_after_seconds?: number;
}
