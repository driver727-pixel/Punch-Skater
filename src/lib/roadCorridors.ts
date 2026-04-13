import type { WheelType } from "./boardBuilder";
import type { District, RoadCorridor, WorldLocation } from "./types";
import type { DistrictWeatherSnapshot } from "./districtWeather";

const PLAYABLE_DISTRICTS: District[] = [
  "Airaway",
  "Batteryville",
  "The Grid",
  "Nightshade",
  "The Forest",
  "Glass City",
];

export interface CorridorProfile {
  id: RoadCorridor;
  label: string;
  from: WorldLocation;
  to: WorldLocation;
  distance: number;
  stormExposure: number;
  debris: number;
  visibility: number;
  patrolDensity: number;
  allowedWheelTypes: WheelType[];
  tagline: string;
  hidden?: boolean;
}

export interface CorridorConditionSnapshot extends CorridorProfile {
  effectiveStormExposure: number;
  effectiveDebris: number;
  effectiveVisibility: number;
  effectivePatrolDensity: number;
  status: string;
  accessSummary: string;
}

const WHEEL_LABELS: Record<WheelType, string> = {
  Urethane: "Urethane",
  Pneumatic: "Pneumatic",
  Rubber: "Solid Rubber",
  Cloud: "Cloud",
};

export const ROAD_CORRIDORS: CorridorProfile[] = [
  {
    id: "Surface Corridor",
    label: "Surface Corridor",
    from: "Electropolis",
    to: "The Roads",
    distance: 6,
    stormExposure: 5,
    debris: 4,
    visibility: 7,
    patrolDensity: 8,
    allowedWheelTypes: ["Urethane", "Rubber"],
    tagline: "Fast transit frontage patrolled by drones and corridor police.",
    hidden: true,
  },
  {
    id: "Freight Artery",
    label: "Freight Artery",
    from: "Batteryville",
    to: "The Roads",
    distance: 8,
    stormExposure: 6,
    debris: 8,
    visibility: 5,
    patrolDensity: 5,
    allowedWheelTypes: ["Rubber", "Cloud", "Pneumatic"],
    tagline: "Broken freight lanes, washouts, and relay camps hanging off the industrial belt.",
  },
  {
    id: "Underpass Tunnel",
    label: "Underpass Tunnel",
    from: "The Roads",
    to: "Nightshade",
    distance: 7,
    stormExposure: 4,
    debris: 7,
    visibility: 4,
    patrolDensity: 7,
    allowedWheelTypes: ["Rubber", "Pneumatic", "Cloud"],
    tagline: "Flooded service tunnels where raids, sweeps, and ambushes stack up fast.",
  },
  {
    id: "Timber Route",
    label: "Timber Route",
    from: "The Roads",
    to: "The Forest",
    distance: 8,
    stormExposure: 8,
    debris: 6,
    visibility: 5,
    patrolDensity: 3,
    allowedWheelTypes: ["Pneumatic", "Rubber", "Cloud"],
    tagline: "Root bridges, smoke fronts, and off-grid rescue lines through timber country.",
  },
];

function clampCorridorValue(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function isDistrict(location: WorldLocation): location is District {
  return PLAYABLE_DISTRICTS.includes(location as District);
}

function getWeatherPressure(weather: DistrictWeatherSnapshot | null | undefined): number {
  if (!weather) return 0;
  const rainPressure = weather.rainMm != null && weather.rainMm >= 1 ? 1 : 0;
  const windPressure = weather.windSpeedKph != null && weather.windSpeedKph >= 25 ? 1 : 0;
  return rainPressure + windPressure;
}

function getCorridorSummary(
  corridor: CorridorProfile,
  stormExposure: number,
  debris: number,
  visibility: number,
  patrolDensity: number,
): string {
  if (stormExposure >= 8) {
    return `${corridor.label} is running brutal weather pressure with debris at ${debris}/10.`;
  }
  if (patrolDensity >= 8) {
    return `${corridor.label} is running hot with heavy patrol pressure and visibility at ${visibility}/10.`;
  }
  if (visibility <= 4) {
    return `${corridor.label} is low-visibility travel with debris at ${debris}/10 and ambush risk climbing.`;
  }
  return `${corridor.label} is open but unstable: debris ${debris}/10, patrols ${patrolDensity}/10, distance ${corridor.distance}/10.`;
}

export function getRoadCorridor(corridorId: RoadCorridor): CorridorProfile {
  const corridor = ROAD_CORRIDORS.find((entry) => entry.id === corridorId);
  if (!corridor) {
    throw new Error(`Unknown road corridor: ${corridorId}`);
  }
  return corridor;
}

export function getCorridorAccessSummary(corridorId: RoadCorridor): string {
  const corridor = getRoadCorridor(corridorId);
  return corridor.allowedWheelTypes.map((wheelType) => WHEEL_LABELS[wheelType]).join(" / ");
}

export function isCorridorAccessible(
  corridorId: RoadCorridor,
  wheelType: WheelType | undefined,
): boolean {
  if (!wheelType) return false;
  return getRoadCorridor(corridorId).allowedWheelTypes.includes(wheelType);
}

export function getCorridorAccessBlockReason(
  corridorId: RoadCorridor,
  wheelType: WheelType | undefined,
): string | null {
  if (!wheelType) {
    return `Equip a board with corridor-ready wheels first. ${getRoadCorridor(corridorId).tagline}`;
  }
  if (!isCorridorAccessible(corridorId, wheelType)) {
    return `${corridorId} currently favors ${getCorridorAccessSummary(corridorId)} wheel access.`;
  }
  return null;
}

export function getCorridorCondition(
  corridorId: RoadCorridor,
  weatherByDistrict: Partial<Record<District, DistrictWeatherSnapshot>>,
): CorridorConditionSnapshot {
  const corridor = getRoadCorridor(corridorId);
  const endpointWeather = [corridor.from, corridor.to]
    .filter(isDistrict)
    .map((district) => weatherByDistrict[district] ?? null);
  const weatherPressure = endpointWeather.reduce((total, weather) => total + getWeatherPressure(weather), 0);
  const effectiveStormExposure = clampCorridorValue(corridor.stormExposure + weatherPressure);
  const effectiveDebris = clampCorridorValue(corridor.debris + Math.max(0, weatherPressure - 1));
  const effectiveVisibility = clampCorridorValue(corridor.visibility - weatherPressure);
  const effectivePatrolDensity = clampCorridorValue(corridor.patrolDensity + (corridor.hidden ? 1 : 0));

  return {
    ...corridor,
    effectiveStormExposure,
    effectiveDebris,
    effectiveVisibility,
    effectivePatrolDensity,
    status: getCorridorSummary(
      corridor,
      effectiveStormExposure,
      effectiveDebris,
      effectiveVisibility,
      effectivePatrolDensity,
    ),
    accessSummary: getCorridorAccessSummary(corridorId),
  };
}
