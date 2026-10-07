import { apiFetch } from '@/lib/api';
import type { Greenhouse, PaginatedResponse } from '@/types';

export interface NodeSensor { id: number; node: number; sensor_id: string; sensor_type: string; unit: string; is_active: boolean }
export interface NodeActuator { id: number; node: number; actuator_id: string; actuator_type: string; is_active: boolean; confirmed_at: string | null }
export interface GreenNode {
  id: number; greenHouse: number; node_id: string; node_name: string;
  is_online: boolean; last_seen: string | null; software_version: string;
  ip_address: string | null; uptime_seconds: number; hardware_info: string;
  sensors: NodeSensor[]; actuators: NodeActuator[];
}
export interface ConditionThreshold {
  id: number; greenhouse: number; node: number; condition_id: string;
  condition_type: string; threshold_value: number;
}
export interface ClaimResult {
  message: string; device_id: string; greenhouse_id: number; greenhouse_name: string;
}
export interface ConditionReading {
  id: number; node: number; device_id: string; reading_ts: number;
  temperature: number | null; humidity: number | null; soil_moisture: number | null;
}
export async function list<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let next: string | null = path;
  while (next) {
    if (seen.has(next)) throw new Error('The server returned a repeating pagination link.');
    seen.add(next);
    const data: T[] | PaginatedResponse<T> = await apiFetch.get(next);
    const page = Array.isArray(data) ? data : data.results;
    if (!Array.isArray(page)) throw new Error('Unexpected response from server.');
    items.push(...page);
    // Keep requests on the configured API endpoint; only use the next page's query.
    next = !Array.isArray(data) && data.next
      ? `${path.split('?')[0]}${new URL(data.next, 'http://pagination.local').search}`
      : null;
  }
  return items;
}
export const getGreenhouses = () => list<Greenhouse>('/greenhouses/');
export const getNodes = (id?: number) => list<GreenNode>(`/nodes/nodes/${id ? `?greenhouse=${id}` : ''}`);
export const getThresholds = (greenhouse: number) => list<ConditionThreshold>(`/conditions/thresholds/?greenhouse=${greenhouse}`);
