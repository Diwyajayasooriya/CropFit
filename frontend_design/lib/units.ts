import type { TempUnit, SystemUnit } from "@/api/types";

export interface UnitPrefs {
  temp: TempUnit;
  system: SystemUnit;
}

/** Converts a backend (°C / lux) reading into the farmer's preferred units. */
export function convertReading(
  value: number,
  unit: string,
  prefs: UnitPrefs
): { value: number; unit: string } {
  if (unit === "°C" && prefs.temp === "F") {
    return { value: Math.round((value * 9) / 5 * 10 + 320) / 10, unit: "°F" };
  }
  if (unit === "lux" && prefs.system === "imperial") {
    return { value: Math.round(value / 10.764), unit: "fc" };
  }
  return { value, unit };
}

export function metersToDisplay(m: number, system: SystemUnit): { value: number; unit: string } {
  return system === "imperial"
    ? { value: Math.round(m * 3.28084 * 10) / 10, unit: "ft" }
    : { value: m, unit: "m" };
}
