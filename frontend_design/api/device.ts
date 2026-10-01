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
  DeviceInfo,
  FirmwareStatus,
  WifiPayload,
  GreenhouseLayout,
  Schedule,
  SchedulePayload,
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

// ── Settings ──
export async function getDeviceInfo(deviceId: string): Promise<DeviceInfo> {
  return apiClient<DeviceInfo>(`/devices/${deviceId}/info`);
}

export async function updateDeviceName(
  deviceId: string,
  name: string
): Promise<{ name: string }> {
  return apiClient(`/devices/${deviceId}/info`, {
    method: "PATCH",
    body: { name },
  });
}

export async function updateWifi(
  deviceId: string,
  payload: WifiPayload
): Promise<{ ssid: string }> {
  return apiClient(`/devices/${deviceId}/wifi`, {
    method: "PUT",
    body: payload,
  });
}

export async function checkFirmware(deviceId: string): Promise<FirmwareStatus> {
  return apiClient<FirmwareStatus>(`/devices/${deviceId}/firmware`);
}

export async function startFirmwareUpdate(
  deviceId: string
): Promise<FirmwareStatus> {
  return apiClient<FirmwareStatus>(`/devices/${deviceId}/firmware/update`, {
    method: "POST",
  });
}

export async function removeDevice(deviceId: string): Promise<{ success: boolean }> {
  return apiClient(`/devices/${deviceId}/remove`, { method: "DELETE" });
}

export async function factoryResetDevice(
  deviceId: string
): Promise<{ success: boolean }> {
  return apiClient(`/devices/${deviceId}/factory-reset`, { method: "POST" });
}

export async function getGreenhouseLayout(
  deviceId: string
): Promise<GreenhouseLayout> {
  return apiClient<GreenhouseLayout>(`/devices/${deviceId}/layout`);
}

export async function setGreenhouseLayout(
  deviceId: string,
  layout: GreenhouseLayout
): Promise<GreenhouseLayout> {
  return apiClient<GreenhouseLayout>(`/devices/${deviceId}/layout`, {
    method: "PUT",
    body: layout,
  });
}

export async function getSchedules(deviceId: string): Promise<Schedule[]> {
  return apiClient<Schedule[]>(`/devices/${deviceId}/schedules`);
}

export async function createSchedule(
  deviceId: string,
  payload: SchedulePayload
): Promise<Schedule> {
  return apiClient<Schedule>(`/devices/${deviceId}/schedules`, {
    method: "POST",
    body: payload,
  });
}

export async function updateSchedule(
  deviceId: string,
  id: string,
  patch: Partial<SchedulePayload>
): Promise<Schedule> {
  return apiClient<Schedule>(`/devices/${deviceId}/schedules/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function deleteSchedule(
  deviceId: string,
  id: string
): Promise<{ success: boolean }> {
  return apiClient(`/devices/${deviceId}/schedules/${id}`, {
    method: "DELETE",
  });
}
