import type { BoardType, WheelType } from "./boardBuilder";
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

export interface DistrictWheelAccessRule {
  allowedWheelTypes: WheelType[];
  reason: string;
}

const WHEEL_LABELS: Record<WheelType, string> = {
  Urethane: "Street wheels (Urethane)",
  Pneumatic: "Pneumatic wheels",
  Rubber: "Solid Rubber wheels",
};

export const DISTRICT_WHEEL_ACCESS_RULES: Record<District, DistrictWheelAccessRule> = {
  Airaway: {
    allowedWheelTypes: ["Urethane"],
    reason: "Airaway only clears quiet street-wheel traffic through its sky-city checkpoints.",
  },
  Electropolis: {
    allowedWheelTypes: ["Urethane", "Rubber"],
    reason: "Electropolis tolerates street wheels on its corridor routes and Solid Rubber through the harder back lanes.",
  },
  "Glass City": {
    allowedWheelTypes: ["Urethane", "Pneumatic", "Rubber"],
    reason: "Glass City's towers and service roads accept every wheel compound currently in circulation.",
  },
  "The Grid": {
    allowedWheelTypes: ["Urethane", "Pneumatic", "Rubber"],
    reason: "The Grid's controlled lanes can handle any wheel setup if the rider survives the surveillance.",
  },
  Batteryville: {
    allowedWheelTypes: ["Pneumatic", "Rubber"],
    reason: "Batteryville's freight yards shred street wheels, so only Pneumatic or Solid Rubber setups can push through.",
  },
  "The Roads": {
    allowedWheelTypes: ["Rubber"],
    reason: "The Roads are all broken surface and debris, making Solid Rubber the only reliable compound.",
  },
  Nightshade: {
    allowedWheelTypes: ["Pneumatic", "Rubber"],
    reason: "Nightshade's flooded tunnels and rough service lanes only support Pneumatic or Solid Rubber wheels.",
  },
  "The Forest": {
    allowedWheelTypes: ["Rubber"],
    reason: "The Forest only allows Solid Rubber wheels on its root bridges and timber routes.",
  },
};

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

function formatWheelAccessSummary(allowedWheelTypes: WheelType[]): string {
  if (allowedWheelTypes.length === 1) {
    return `${WHEEL_LABELS[allowedWheelTypes[0]]} only`;
  }
  return allowedWheelTypes.map((wheelType) => WHEEL_LABELS[wheelType]).join(" / ");
}

export function getDistrictWheelAccessRule(district: District): DistrictWheelAccessRule {
  return DISTRICT_WHEEL_ACCESS_RULES[district];
}

export function getDistrictWeatherMap(
  weather: DistrictWeatherResponse | null,
): Partial<Record<District, DistrictWeatherSnapshot>> {
  return Object.fromEntries(
    (weather?.districts ?? []).map((entry) => [entry.district, entry]),
  ) as Partial<Record<District, DistrictWeatherSnapshot>>;
}

export function isDistrictAccessibleWithBoardType(
  district: District,
  weather: DistrictWeatherSnapshot | null | undefined,
  boardType: BoardType | undefined,
  wheelType: WheelType | undefined,
): boolean {
  const wheelRule = getDistrictWheelAccessRule(district);
  if (!wheelType || !wheelRule.allowedWheelTypes.includes(wheelType)) {
    return false;
  }
  if (!weather?.accessRule) return true;
  return weather.accessRule.requiredBoardType === boardType;
}

export function getDistrictAccessSummary(
  district: District,
  weather: DistrictWeatherSnapshot | null | undefined,
): string {
  const wheelSummary = formatWheelAccessSummary(getDistrictWheelAccessRule(district).allowedWheelTypes);
  if (!weather?.accessRule) return wheelSummary;
  return `${wheelSummary} · ${weather.accessRule.requiredBoardType} boards only`;
}

export function getDistrictAccessBlockReason(
  district: District,
  weather: DistrictWeatherSnapshot | null | undefined,
  boardType: BoardType | undefined,
  wheelType: WheelType | undefined,
): string | null {
  const wheelRule = getDistrictWheelAccessRule(district);
  if (!wheelType) {
    return `Equip a board first. ${wheelRule.reason}`;
  }
  if (!wheelRule.allowedWheelTypes.includes(wheelType)) {
    return wheelRule.reason;
  }
  if (weather?.accessRule && weather.accessRule.requiredBoardType !== boardType) {
    return weather.accessRule.reason;
  }
  return null;
}

export function hasDistrictAccessRestriction(
  district: District,
  weather: DistrictWeatherSnapshot | null | undefined,
): boolean {
  return getDistrictWheelAccessRule(district).allowedWheelTypes.length < 3 || Boolean(weather?.accessRule);
}
