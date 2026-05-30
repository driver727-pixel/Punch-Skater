import { DEFAULT_RACE_DISTRICT } from "./raceDistricts";

/**
 * Pre-generated top-down Classic Race track concept data.
 *
 * `points` and `landmarks` use normalized canvas coordinates where 0,0 is the
 * top-left of the preview/replay map and 1,1 is the bottom-right. The replay
 * renderer scales those coordinates to its canvas and samples a closed circuit.
 */
export interface RaceTrackDefinition {
  district: string;
  name: string;
  prompt: string;
  terrain: string;
  /** Normalized 2D centerline control points, clockwise, generated from district concept sketches. */
  points: [number, number][];
  landmarks: { label: string; x: number; y: number }[];
}

export const RACE_TRACKS: Record<string, RaceTrackDefinition> = {
  airaway: {
    district: "airaway",
    name: "Skybridge Switchback",
    prompt: "fal.ai 2D top-down courier circuit, Airaway wind towers, suspended bridges, jetstream ramps, neon punk racing map",
    terrain: "Suspended sky lanes, service decks, wind-shear turns",
    points: [
      [0.49, 0.13], [0.72, 0.16], [0.83, 0.30], [0.69, 0.43],
      [0.83, 0.55], [0.73, 0.77], [0.47, 0.83], [0.34, 0.66],
      [0.15, 0.70], [0.20, 0.45], [0.33, 0.36], [0.24, 0.21],
    ],
    landmarks: [
      { label: "Gust Gate", x: 0.47, y: 0.23 },
      { label: "Turbine Row", x: 0.73, y: 0.62 },
      { label: "Cloud Pier", x: 0.24, y: 0.58 },
    ],
  },
  batteryville: {
    district: "batteryville",
    name: "Volt Foundry Loop",
    prompt: "fal.ai 2D top-down electric foundry race track, Batteryville battery stacks, hazard paint, molten orange neon",
    terrain: "Factory gantries, capacitor alleys, hard braking chicanes",
    points: [
      [0.44, 0.16], [0.68, 0.14], [0.80, 0.23], [0.70, 0.36],
      [0.84, 0.45], [0.74, 0.61], [0.80, 0.77], [0.56, 0.83],
      [0.44, 0.68], [0.22, 0.76], [0.17, 0.55], [0.31, 0.47],
      [0.20, 0.33], [0.31, 0.19],
    ],
    landmarks: [
      { label: "Charge Yard", x: 0.33, y: 0.28 },
      { label: "Breaker Bend", x: 0.72, y: 0.37 },
      { label: "Scrap Sluice", x: 0.29, y: 0.70 },
    ],
  },
  "the-grid": {
    district: "the-grid",
    name: "Firewall S-Curve",
    prompt: "fal.ai 2D top-down cyber maze race track, The Grid surveillance corridors, glowing green routing nodes",
    terrain: "Surveillance corridors, data gates, right-angle trace cuts",
    points: [
      [0.32, 0.14], [0.64, 0.14], [0.78, 0.27], [0.60, 0.36],
      [0.81, 0.47], [0.67, 0.62], [0.83, 0.78], [0.51, 0.83],
      [0.39, 0.66], [0.17, 0.74], [0.18, 0.51], [0.38, 0.43],
      [0.20, 0.30],
    ],
    landmarks: [
      { label: "Packet Gate", x: 0.63, y: 0.24 },
      { label: "Trace Cut", x: 0.69, y: 0.53 },
      { label: "Proxy Pit", x: 0.26, y: 0.60 },
    ],
  },
  nightshade: {
    district: "nightshade",
    name: "Umbra Alley Run",
    prompt: "fal.ai 2D top-down blacklight alley race track, Nightshade district, purple markets, hidden underpass shortcuts",
    terrain: "Blacklight alleys, market cuts, shadow underpasses",
    points: [
      [0.55, 0.13], [0.79, 0.21], [0.73, 0.38], [0.88, 0.52],
      [0.67, 0.58], [0.73, 0.80], [0.47, 0.78], [0.32, 0.86],
      [0.17, 0.67], [0.30, 0.53], [0.13, 0.40], [0.32, 0.31],
      [0.27, 0.16],
    ],
    landmarks: [
      { label: "Shade Market", x: 0.33, y: 0.39 },
      { label: "Moon Cut", x: 0.70, y: 0.48 },
      { label: "Underpass", x: 0.38, y: 0.75 },
    ],
  },
  "the-forest": {
    district: "the-forest",
    name: "Canopy Rootway",
    prompt: "fal.ai 2D top-down forest courier track, giant roots, bioluminescent moss, green punk skate route",
    terrain: "Root tunnels, mossy switchbacks, timber bridge crossings",
    points: [
      [0.48, 0.12], [0.66, 0.20], [0.83, 0.17], [0.76, 0.40],
      [0.62, 0.43], [0.83, 0.63], [0.64, 0.78], [0.47, 0.70],
      [0.31, 0.86], [0.18, 0.66], [0.30, 0.51], [0.15, 0.34],
      [0.34, 0.25],
    ],
    landmarks: [
      { label: "Root Gate", x: 0.36, y: 0.32 },
      { label: "Moss Drop", x: 0.69, y: 0.62 },
      { label: "Timber Span", x: 0.27, y: 0.67 },
    ],
  },
  "glass-city": {
    district: "glass-city",
    name: "Mirrorline Grand Prix",
    prompt: "fal.ai 2D top-down crystalline city race track, Glass City reflective towers, gold neon skyline",
    terrain: "Mirror plazas, rooftop ramps, reflective tower canyons",
    points: [
      [0.43, 0.14], [0.73, 0.16], [0.85, 0.31], [0.62, 0.34],
      [0.74, 0.50], [0.85, 0.68], [0.61, 0.80], [0.50, 0.61],
      [0.31, 0.81], [0.16, 0.62], [0.31, 0.46], [0.19, 0.28],
    ],
    landmarks: [
      { label: "Prism Row", x: 0.63, y: 0.25 },
      { label: "Mirror Plaza", x: 0.52, y: 0.51 },
      { label: "Gold Ramp", x: 0.30, y: 0.66 },
    ],
  },
};

export function getRaceTrackDefinition(district?: string | null): RaceTrackDefinition {
  return RACE_TRACKS[district ?? ""] ?? RACE_TRACKS[DEFAULT_RACE_DISTRICT];
}

const SVG_POLYGON_POINTS = new Map(
  Object.entries(RACE_TRACKS).map(([district, track]) => [
    district,
    track.points.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(" "),
  ]),
);

export function getRaceTrackSvgPolygonPoints(district?: string | null): string {
  return SVG_POLYGON_POINTS.get(district ?? "") ?? SVG_POLYGON_POINTS.get(DEFAULT_RACE_DISTRICT) ?? "";
}
