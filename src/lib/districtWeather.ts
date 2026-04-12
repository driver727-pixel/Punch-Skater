import type { BoardType } from "./boardBuilder";
import type { District } from "./types";

export interface DistrictWeatherLocation {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

export interface DistrictWeatherAccessRule {
  requiredBoardType: BoardType;
  reason: string;
  source: "heavy-rain";
}

export interface DistrictWeatherSnapshot {
  district: District;
  city: string;
  state: string;
  summary: string;
  temperatureC: number | null;
  windSpeedKph: number | null;
  rainMm: number | null;
  weatherCode: number | null;
  updatedAt: string;
  accessRule: DistrictWeatherAccessRule | null;
}

export interface DistrictWeatherResponse {
  generatedAt: string;
  stale: boolean;
  source: "live" | "cache" | "fallback";
  districts: DistrictWeatherSnapshot[];
}

export const DISTRICT_WEATHER_LOCATIONS: Record<District, DistrictWeatherLocation> = {
  Airaway: { city: "Brisbane", state: "QLD", latitude: -27.4698, longitude: 153.0251 },
  Electropolis: { city: "Sydney", state: "NSW", latitude: -33.8688, longitude: 151.2093 },
  "Glass City": { city: "Melbourne", state: "VIC", latitude: -37.8136, longitude: 144.9631 },
  "The Grid": { city: "Canberra", state: "ACT", latitude: -35.2809, longitude: 149.13 },
  Batteryville: { city: "Adelaide", state: "SA", latitude: -34.9285, longitude: 138.6007 },
  "The Roads": { city: "Alice Springs", state: "NT", latitude: -23.698, longitude: 133.8807 },
  Nightshade: { city: "Perth", state: "WA", latitude: -31.9523, longitude: 115.8613 },
  "The Forest": { city: "Hobart", state: "TAS", latitude: -42.8821, longitude: 147.3272 },
};

export const DISTRICT_WEATHER_REFRESH_MS = 15 * 60 * 1000;
export const GLASS_CANOPY_DISTRICT: District = "Glass City";

export function getDistrictWeatherMap(
  weather: DistrictWeatherResponse | null,
): Partial<Record<District, DistrictWeatherSnapshot>> {
  return Object.fromEntries(
    (weather?.districts ?? []).map((entry) => [entry.district, entry]),
  ) as Partial<Record<District, DistrictWeatherSnapshot>>;
}

export function isDistrictAccessibleWithBoardType(
  weather: DistrictWeatherSnapshot | null | undefined,
  boardType: BoardType | undefined,
): boolean {
  if (!weather?.accessRule) return true;
  return weather.accessRule.requiredBoardType === boardType;
}

export function getDistrictAccessSummary(
  weather: DistrictWeatherSnapshot | null | undefined,
): string {
  if (!weather?.accessRule) return "Open board access";
  return `${weather.accessRule.requiredBoardType} boards only`;
}
