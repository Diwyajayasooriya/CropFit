// ── Auth ──
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
}

export interface SignUpPayload {
  username: string;
  password: string;
  activationKey: string;
}

export interface SignInPayload {
  username: string;
  password: string;
}

// ── Activation ──
export interface ActivationResponse {
  valid: boolean;
  deviceId: string;
  message: string;
}

// ── Device ──
export interface DeviceStatus {
  id: string;
  name: string;
  online: boolean;
  lastSeen: string;
  firmwareVersion: string;
}

export interface ConnectedNode {
  id: string;
  type: "sensor" | "actuator";
  name: string;
  status: "active" | "inactive" | "error";
  lastReading?: string;
}

export interface PairDevicePayload {
  activationKey: string;
}

export interface PairDeviceResponse {
  success: boolean;
  device: DeviceStatus;
}

// ── Device Health (extended) ──
export interface DeviceHealth {
  status: "connected" | "not_connected" | "pending";
  bandwidthUsage: string;
  connectedSubDevices: number;
  mode: "manual" | "scareclaw";
  firmwareVersion: string;
}

export interface SubDevice {
  id: string;
  name: string;
  type: "sensor" | "actuator";
  bandwidthUsed: string;
  health: "healthy" | "degraded" | "offline";
  isAwake: boolean;
  mode?: string;
}

// ── Greenhouse ──
export interface GreenhouseMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  trendData: number[];
}

export type GreenhouseStatus = "good" | "needs_control" | "warning";

export interface GreenhouseData {
  metrics: GreenhouseMetric[];
  overallStatus: GreenhouseStatus;
}

// ── Actions ──
export interface GrowthStage {
  crop: string;
  stage: string;
  stageIndex: number;
  totalStages: number;
  stages: string[];
}

export interface TargetCondition {
  label: string;
  current: number;
  target: number;
  unit: string;
}

export interface SuggestedAction {
  id: string;
  label: string;
  duration?: string;
  actuatorId: string;
  status: "pending" | "running" | "completed";
}

export interface ActionPanelData {
  growth: GrowthStage;
  conditions: TargetCondition[];
  suggestedActions: SuggestedAction[];
}

// ── Errors ──
export interface ApiError {
  status: number;
  message: string;
  code?: string;
}
