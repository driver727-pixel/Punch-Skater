/**
 * raceConfig.js — Punch Skater™ Classic Race configuration.
 *
 * Owns track definitions (imported from the TS source as plain data), physics
 * tuning constants, and URL-param parsing so the React app can launch a
 * configured race session.
 *
 * Keep this file free of Phaser imports so it can be unit-tested standalone.
 */

// ---------------------------------------------------------------------------
// Track definitions — mirrored from src/lib/raceTracks.ts for the standalone
// Phaser build. Points are normalized [0,1] and scaled at runtime.
// ---------------------------------------------------------------------------
export const RACE_TRACKS = {
  airaway: {
    district: 'airaway',
    name: 'Skybridge Switchback',
    terrain: 'Suspended sky lanes, service decks, wind-shear turns',
    laps: 3,
    colors: { road: '#1a2c3f', border: '#00d4ff', accent: '#0088aa' },
    points: [
      [0.49, 0.13], [0.72, 0.16], [0.83, 0.30], [0.69, 0.43],
      [0.83, 0.55], [0.73, 0.77], [0.47, 0.83], [0.34, 0.66],
      [0.15, 0.70], [0.20, 0.45], [0.33, 0.36], [0.24, 0.21],
    ],
    obstacles: [
      { x: 0.76, y: 0.48, type: 'pothole' },
      { x: 0.30, y: 0.55, type: 'debris' },
      { x: 0.55, y: 0.80, type: 'pothole' },
    ],
  },
  batteryville: {
    district: 'batteryville',
    name: 'Volt Foundry Loop',
    terrain: 'Factory gantries, capacitor alleys, hard braking chicanes',
    laps: 4,
    colors: { road: '#2a1a0a', border: '#ff8800', accent: '#ffcc00' },
    points: [
      [0.44, 0.16], [0.68, 0.14], [0.80, 0.23], [0.70, 0.36],
      [0.84, 0.45], [0.74, 0.61], [0.80, 0.77], [0.56, 0.83],
      [0.44, 0.68], [0.22, 0.76], [0.17, 0.55], [0.31, 0.47],
      [0.20, 0.33], [0.31, 0.19],
    ],
    obstacles: [
      { x: 0.75, y: 0.30, type: 'debris' },
      { x: 0.50, y: 0.75, type: 'pothole' },
      { x: 0.25, y: 0.62, type: 'debris' },
      { x: 0.70, y: 0.55, type: 'pothole' },
    ],
  },
  'the-grid': {
    district: 'the-grid',
    name: 'Firewall S-Curve',
    terrain: 'Surveillance corridors, data gates, right-angle trace cuts',
    laps: 3,
    colors: { road: '#0a1a0a', border: '#00ff66', accent: '#33ff99' },
    points: [
      [0.32, 0.14], [0.64, 0.14], [0.78, 0.27], [0.60, 0.36],
      [0.81, 0.47], [0.67, 0.62], [0.83, 0.78], [0.51, 0.83],
      [0.39, 0.66], [0.17, 0.74], [0.18, 0.51], [0.38, 0.43],
      [0.20, 0.30],
    ],
    obstacles: [
      { x: 0.70, y: 0.20, type: 'pothole' },
      { x: 0.75, y: 0.60, type: 'debris' },
      { x: 0.30, y: 0.70, type: 'pothole' },
    ],
  },
  nightshade: {
    district: 'nightshade',
    name: 'Umbra Alley Run',
    terrain: 'Blacklight alleys, market cuts, shadow underpasses',
    laps: 3,
    colors: { road: '#1a0a2a', border: '#aa00ff', accent: '#ff00aa' },
    points: [
      [0.55, 0.13], [0.79, 0.21], [0.73, 0.38], [0.88, 0.52],
      [0.67, 0.58], [0.73, 0.80], [0.47, 0.78], [0.32, 0.86],
      [0.17, 0.67], [0.30, 0.53], [0.13, 0.40], [0.32, 0.31],
      [0.27, 0.16],
    ],
    obstacles: [
      { x: 0.80, y: 0.45, type: 'debris' },
      { x: 0.40, y: 0.82, type: 'pothole' },
      { x: 0.20, y: 0.55, type: 'debris' },
    ],
  },
  'the-forest': {
    district: 'the-forest',
    name: 'Canopy Rootway',
    terrain: 'Root tunnels, mossy switchbacks, timber bridge crossings',
    laps: 4,
    colors: { road: '#0a1a0a', border: '#44cc44', accent: '#88ff44' },
    points: [
      [0.48, 0.12], [0.66, 0.20], [0.83, 0.17], [0.76, 0.40],
      [0.62, 0.43], [0.83, 0.63], [0.64, 0.78], [0.47, 0.70],
      [0.31, 0.86], [0.18, 0.66], [0.30, 0.51], [0.15, 0.34],
      [0.34, 0.25],
    ],
    obstacles: [
      { x: 0.75, y: 0.30, type: 'pothole' },
      { x: 0.55, y: 0.55, type: 'debris' },
      { x: 0.25, y: 0.75, type: 'pothole' },
      { x: 0.40, y: 0.30, type: 'debris' },
    ],
  },
  'glass-city': {
    district: 'glass-city',
    name: 'Mirrorline Grand Prix',
    terrain: 'Mirror plazas, rooftop ramps, reflective tower canyons',
    laps: 5,
    colors: { road: '#1a1a2a', border: '#ffcc00', accent: '#ffffff' },
    points: [
      [0.43, 0.14], [0.73, 0.16], [0.85, 0.31], [0.62, 0.34],
      [0.74, 0.50], [0.85, 0.68], [0.61, 0.80], [0.50, 0.61],
      [0.31, 0.81], [0.16, 0.62], [0.31, 0.46], [0.19, 0.28],
    ],
    obstacles: [
      { x: 0.78, y: 0.25, type: 'pothole' },
      { x: 0.70, y: 0.58, type: 'debris' },
      { x: 0.25, y: 0.70, type: 'pothole' },
      { x: 0.50, y: 0.50, type: 'debris' },
    ],
  },
};

export const DEFAULT_DISTRICT = 'airaway';

// ---------------------------------------------------------------------------
// Physics tuning — skate feel
// ---------------------------------------------------------------------------
export const PHYSICS = Object.freeze({
  MAX_SPEED: 320,
  ACCELERATION: 280,
  BRAKE_FORCE: 400,
  REVERSE_MAX: 100,
  TURN_RATE: 3.2,          // radians/sec at max
  TURN_GRIP_FACTOR: 0.7,   // how much forward speed reduces at full turn (drift)
  DRAG: 180,               // natural slowdown
  ANGULAR_DRAG: 6.0,       // how quickly rotation stops
  DRIFT_LATERAL_DAMPING: 0.88, // per-frame multiplier on lateral velocity (< 1 = slide)
  BOUNCE_FACTOR: 0.4,      // wall collision bounce
  OBSTACLE_SLOW: 0.5,      // speed multiplier on obstacle hit
  OBSTACLE_BOUNCE: 80,     // bounce impulse from obstacles
});

// ---------------------------------------------------------------------------
// Nitro / Boost
// ---------------------------------------------------------------------------
export const NITRO = Object.freeze({
  BOOST_SPEED_MULT: 1.6,
  BOOST_DURATION: 1200,    // ms
  COOLDOWN: 8000,          // ms between uses
});

// ---------------------------------------------------------------------------
// Track geometry
// ---------------------------------------------------------------------------
export const TRACK = Object.freeze({
  WORLD_WIDTH: 2000,
  WORLD_HEIGHT: 2000,
  ROAD_HALF_WIDTH: 55,    // half-width of the road from centerline
  CHECKPOINT_RADIUS: 50,  // how close to a waypoint to consider it "passed"
});

// ---------------------------------------------------------------------------
// AI tuning
// ---------------------------------------------------------------------------
export const AI = Object.freeze({
  WAYPOINT_THRESHOLD: 60,  // px distance to switch to next waypoint
  SPEED_VARIATION: 0.08,   // ±8% random speed per AI
  CORNER_SLOWDOWN: 0.65,   // AI brakes into tight corners
  STEER_LOOKAHEAD: 1,      // how many waypoints ahead to aim
  NITRO_CHANCE: 0.3,       // probability AI uses nitro when available
});

// ---------------------------------------------------------------------------
// URL param parsing
// ---------------------------------------------------------------------------
export function parseRaceConfig() {
  const params = new URLSearchParams(window.location.search);
  const district = params.get('district') || DEFAULT_DISTRICT;
  const track = RACE_TRACKS[district] || RACE_TRACKS[DEFAULT_DISTRICT];
  const opponents = Math.max(1, Math.min(5, parseInt(params.get('opponents') || '3', 10)));
  const returnUrl = params.get('returnUrl') || '/race';

  return { district, track, opponents, returnUrl };
}
