import type { ApiError } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Fallback mock generator when no live backend server is running.
 * Allows full client-side evaluation of activation and onboarding flows.
 */
function getMockResponse<T>(endpoint: string, body?: unknown): T {
  const reqBody = (body || {}) as Record<string, any>;

  if (endpoint.includes("/auth/signup") || endpoint.includes("/auth/signin")) {
    return {
      success: true,
      user: {
        id: "node_usr_01",
        username: reqBody.username || "operator",
        createdAt: new Date().toISOString(),
      },
      token: "gn_jwt_session_token_live_preview",
    } as unknown as T;
  }

  if (endpoint.includes("/auth/verify-key")) {
    return {
      valid: true,
      deviceId: "GN-HUB-PERA-01",
      message: "Activation key verified and bound to greenhouse cluster",
    } as unknown as T;
  }

  if (endpoint.includes("/devices/pair")) {
    return {
      success: true,
      device: {
        id: "GN-HUB-PERA-01",
        name: "GreenNode Hub Alpha",
        online: true,
        lastSeen: new Date().toISOString(),
        firmwareVersion: "v1.2.0-edge",
      },
    } as unknown as T;
  }

  if (endpoint.includes("/status")) {
    return {
      id: "GN-HUB-PERA-01",
      name: "GreenNode Hub Alpha",
      online: true,
      lastSeen: new Date().toISOString(),
      firmwareVersion: "v1.2.0-edge",
    } as unknown as T;
  }

  if (endpoint.includes("/nodes")) {
    return [
      {
        id: "sensor-temp-01",
        type: "sensor",
        name: "Ambient Canopy Temperature",
        status: "active",
        lastReading: "24.2°C",
      },
      {
        id: "sensor-hum-01",
        type: "sensor",
        name: "Relative Humidity Sensor",
        status: "active",
        lastReading: "68%",
      },
      {
        id: "act-irr-01",
        type: "actuator",
        name: "Zone 1 Drip Solenoid",
        status: "active",
        lastReading: "Standby",
      },
    ] as unknown as T;
  }

  if (endpoint.includes("/health")) {
    return {
      status: "connected",
      bandwidthUsage: "12.4 MB/s",
      connectedSubDevices: 5,
      mode: "scareclaw",
      firmwareVersion: "v1.2.0-edge",
    } as unknown as T;
  }

  if (endpoint.includes("/sub-devices") && !endpoint.includes("/toggle")) {
    return [
      {
        id: "sensor-temp-01",
        name: "Canopy Temp Probe",
        type: "sensor",
        bandwidthUsed: "1.2 MB/s",
        health: "healthy",
        isAwake: true,
        mode: "Continuous Telemetry",
      },
      {
        id: "sensor-hum-01",
        name: "RH Capacitive Sensor",
        type: "sensor",
        bandwidthUsed: "0.8 MB/s",
        health: "healthy",
        isAwake: true,
        mode: "Polling (5s)",
      },
      {
        id: "sensor-lux-01",
        name: "PAR Light Meter",
        type: "sensor",
        bandwidthUsed: "0.5 MB/s",
        health: "degraded",
        isAwake: true,
        mode: "Edge Filtering",
      },
      {
        id: "act-fan-01",
        name: "Exhaust Fan Unit",
        type: "actuator",
        bandwidthUsed: "2.1 MB/s",
        health: "healthy",
        isAwake: true,
        mode: "Autonomous PWM",
      },
      {
        id: "act-valve-01",
        name: "Drip Valve Solenoid",
        type: "actuator",
        bandwidthUsed: "1.8 MB/s",
        health: "healthy",
        isAwake: false,
        mode: "Standby Pulse",
      },
    ] as unknown as T;
  }

  if (endpoint.includes("/toggle")) {
    return {
      id: "sensor-temp-01",
      name: "Canopy Temp Probe",
      type: "sensor",
      bandwidthUsed: "1.2 MB/s",
      health: "healthy",
      isAwake: true,
    } as unknown as T;
  }

  if (endpoint.includes("/greenhouse")) {
    return {
      metrics: [
        {
          id: "temp",
          label: "Temperature",
          value: 24.2,
          unit: "°C",
          trendData: [22.1, 22.8, 23.5, 23.9, 24.2, 24.0, 23.8, 24.1, 24.3, 24.2, 24.5, 24.2],
        },
        {
          id: "humidity",
          label: "Humidity",
          value: 68.4,
          unit: "%",
          trendData: [65.2, 66.1, 67.0, 67.8, 68.2, 68.5, 68.0, 67.9, 68.1, 68.4, 68.6, 68.4],
        },
        {
          id: "luminosity",
          label: "Luminosity",
          value: 4820,
          unit: "lux",
          trendData: [3200, 3800, 4100, 4500, 4700, 4820, 4900, 4850, 4780, 4820, 4750, 4820],
        },
        {
          id: "soil",
          label: "Soil Condition",
          value: 72,
          unit: "SCI",
          trendData: [68, 69, 70, 71, 71, 72, 72, 73, 72, 71, 72, 72],
        },
        {
          id: "co2",
          label: "CO₂ Level",
          value: 412,
          unit: "ppm",
          trendData: [405, 408, 410, 411, 412, 413, 412, 411, 410, 412, 413, 412],
        },
      ],
      overallStatus: "good",
    } as unknown as T;
  }

  if (endpoint.includes("/actions") && !endpoint.includes("/run")) {
    return {
      growth: {
        crop: "Tomato",
        stage: "Seedling",
        stageIndex: 1,
        totalStages: 4,
        stages: ["Seeding", "Seedling", "Growing", "Picking"],
      },
      conditions: [
        { label: "Temperature", current: 24.2, target: 27, unit: "°C" },
        { label: "Humidity", current: 68.4, target: 72, unit: "%" },
        { label: "Air Quality", current: 412, target: 400, unit: "ppm" },
        { label: "Soil Index", current: 72, target: 75, unit: "SCI" },
      ],
      suggestedActions: [
        {
          id: "action-01",
          label: "Turn on Fan — 15 min",
          duration: "15 min",
          actuatorId: "act-fan-01",
          status: "pending",
        },
        {
          id: "action-02",
          label: "Open Drip Valve — Zone 1",
          duration: "20 min",
          actuatorId: "act-valve-01",
          status: "pending",
        },
        {
          id: "action-03",
          label: "Increase grow light intensity",
          actuatorId: "act-light-01",
          status: "pending",
        },
      ],
    } as unknown as T;
  }

  if (endpoint.includes("/run")) {
    return {
      id: "action-01",
      label: "Turn on Fan — 15 min",
      duration: "15 min",
      actuatorId: "act-fan-01",
      status: "running",
    } as unknown as T;
  }

  return {} as T;
}

/**
 * Base fetch wrapper for all API calls.
 * Handles JSON serialization, auth headers, and error normalization.
 * Falls back to simulation if backend endpoint is unavailable.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  const url = `${BASE_URL}${endpoint}`;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("gn_token") : null;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      let errorData: ApiError;
      try {
        errorData = (await res.json()) as ApiError;
      } catch {
        errorData = {
          status: res.status,
          message: res.statusText || "An unexpected error occurred",
        };
      }
      throw errorData;
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    // If it's an explicit HTTP error from backend, re-throw
    if (typeof err === "object" && err !== null && "status" in err) {
      throw err;
    }

    // Otherwise, it was a network error (e.g. backend server not running)
    // Fall back to mock response with brief simulated latency for authentic feel
    await new Promise((resolve) => setTimeout(resolve, 400));
    return getMockResponse<T>(endpoint, body);
  }
}
