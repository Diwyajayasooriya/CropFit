import { apiClient } from "./client";
import type {
  PairDevicePayload,
  PairDeviceResponse,
  DeviceStatus,
  ConnectedNode,
  DeviceHealth,
  SubDevice,
  GreenhouseData,
  ActionPanelData,
  SuggestedAction,
} from "./types";

export async function pairDevice(
  payload: PairDevicePayload
): Promise<PairDeviceResponse> {
  return apiClient<PairDeviceResponse>("/devices/pair", {
    method: "POST",
    body: payload,
  });
}

export async function getDeviceStatus(
  deviceId: string
): Promise<DeviceStatus> {
  return apiClient<DeviceStatus>(`/devices/${deviceId}/status`);
}

export async function listConnectedNodes(
  deviceId: string
): Promise<ConnectedNode[]> {
  return apiClient<ConnectedNode[]>(`/devices/${deviceId}/nodes`);
}

export async function getDeviceHealth(
  deviceId: string
): Promise<DeviceHealth> {
  return apiClient<DeviceHealth>(`/devices/${deviceId}/health`);
}

export async function getSubDevices(
  deviceId: string
): Promise<SubDevice[]> {
  return apiClient<SubDevice[]>(`/devices/${deviceId}/sub-devices`);
}

export async function toggleSubDeviceSleep(
  deviceId: string,
  subDeviceId: string
): Promise<SubDevice> {
  return apiClient<SubDevice>(
    `/devices/${deviceId}/sub-devices/${subDeviceId}/toggle`,
    { method: "POST" }
  );
}

export async function getGreenhouseMetrics(
  deviceId: string
): Promise<GreenhouseData> {
  return apiClient<GreenhouseData>(`/devices/${deviceId}/greenhouse`);
}

export async function getSuggestedActions(
  deviceId: string
): Promise<ActionPanelData> {
  return apiClient<ActionPanelData>(`/devices/${deviceId}/actions`);
}

export async function runAction(
  deviceId: string,
  actionId: string
): Promise<SuggestedAction> {
  return apiClient<SuggestedAction>(
    `/devices/${deviceId}/actions/${actionId}/run`,
    { method: "POST" }
  );
}
