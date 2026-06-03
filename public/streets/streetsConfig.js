/**
 * streetsConfig.js — Punch Skater™ Streets mode configuration.
 *
 * Streets is the side-scrolling beat-em-up extension of the Missions Map. This
 * module owns three things:
 *   1. District skins, objective definitions, and the seeded lore missions.
 *   2. URL-param parsing so the Missions Map can launch a configured run
 *      (mission, objective, district, player cosmetics + stats, return URL).
 *   3. The stat-mapping layer that turns forged-card stats (ForgedCardStats +
 *      JoustCardProfile) into concrete gameplay knobs (health, speed, reach…).
 *
 * Keep this file free of Phaser imports so it can be reasoned about (and unit
 * tested) on its own. The scenes consume the plain objects it returns.
 */

/** Objective archetypes that a Streets stage can ask the player to complete. */
export const STREETS_OBJECTIVES = Object.freeze({
  fight_through: Object.freeze({
    id: 'fight_through',
    label: 'Fight Through',
    blurb: 'Clear every wave and reach the exit grind-rail.',
  }),
  retrieve: Object.freeze({
    id: 'retrieve',
    label: 'Retrieve & Extract',
    blurb: 'Grab the package, then skate it out alive.',
  }),
  escape: Object.freeze({
    id: 'escape',
    label: 'Escape the Horde',
    blurb: 'Outrun the pack and reach the exit before they swarm you.',
  }),
});

/**
 * District skins. Colors drive the procedurally drawn parallax backdrop so the
 * mode works even before bespoke art exists. `motto` comes from docs/lore.
 */
export const STREETS_DISTRICTS = Object.freeze({
  nightshade: Object.freeze({
    id: 'nightshade',
    name: 'Nightshade',
    skyTop: 0x1a0b2e,
    skyBottom: 0x070414,
    ground: 0x140a24,
    groundEdge: 0xff007f,
    accent: 0x9d00ff,
    haze: 0xff2bd1,
    motto: 'Nobody owns Nightshade. Nightshade owns you.',
  }),
  batteryville: Object.freeze({
    id: 'batteryville',
    name: 'Batteryville',
    skyTop: 0x2a1606,
    skyBottom: 0x0a0602,
    ground: 0x1c1206,
    groundEdge: 0xffaa00,
    accent: 0xff6600,
    haze: 0xffd166,
    motto: 'The City runs on our power. We run on spite.',
  }),
  airaway: Object.freeze({
    id: 'airaway',
    name: 'Airaway',
    skyTop: 0x0a1a2a,
    skyBottom: 0x04101c,
    ground: 0x0c1a26,
    groundEdge: 0x00f0ff,
    accent: 0x8ad7ff,
    haze: 0xbfeaff,
    motto: 'The higher you go, the cleaner the money.',
  }),
  roads: Object.freeze({
    id: 'roads',
    name: 'The Roads',
    skyTop: 0x241a0a,
    skyBottom: 0x100c06,
    ground: 0x1a1408,
    groundEdge: 0xffea00,
    accent: 0xffc14d,
    haze: 0xfff1b8,
    motto: 'Transit is its own battlefield.',
  }),
  glasscity: Object.freeze({
    id: 'glasscity',
    name: 'Glass City',
    skyTop: 0x06121f,
    skyBottom: 0x02080f,
    ground: 0x081521,
    groundEdge: 0x39ff14,
    accent: 0x00f0ff,
    haze: 0x7dffb6,
    motto: 'A million screens. Zero witnesses.',
  }),
});

/**
 * Seeded, lore-grounded missions. Each one maps a district + objective to a
 * wave layout and a named boss drawn from the Codex rivals. `bossTactic` is
 * descriptive flavor surfaced in the intro card.
 */
export const STREETS_MISSIONS = Object.freeze({
  'nightshade-run': Object.freeze({
    id: 'nightshade-run',
    name: 'Nightshade Run',
    district: 'nightshade',
    objective: 'escape',
    hook: 'A deal goes wrong at a basement rave. A pack of rival skaters chase you down the laneways — reach the exit grind-rail alive.',
    waves: [4, 5, 6],
    hordeSpawnMs: 2600,
    boss: null,
    enemyWeapons: ['Street Sign', 'Crutch Lance'],
    enemyColors: ['Cyber Pink', 'Toxic Green'],
  }),
  'never-open-the-package': Object.freeze({
    id: 'never-open-the-package',
    name: 'Never Open the Package',
    district: 'batteryville',
    objective: 'retrieve',
    hook: 'Grab an Asclepian medical package off a hijacked freight scaffold and skate it out past Iron Circuit goons. Never open the package.',
    waves: [3, 4, 4],
    boss: null,
    enemyWeapons: ['Hockey Stick', 'Street Sign'],
    enemyColors: ['Laser Yellow', 'Cyber Pink'],
  }),
  'broomstick-first': Object.freeze({
    id: 'broomstick-first',
    name: 'Broomstick First',
    district: 'airaway',
    objective: 'fight_through',
    hook: 'Punch Skater\u2122s are outlawed here. Smash through UCA white-bike enforcers and duel Mina Chrome at the biometric checkpoint.',
    waves: [3, 4],
    boss: Object.freeze({
      name: 'Mina Chrome',
      tactic: 'Magnetic Guard',
      color: 'Neon Cyan',
      weapon: 'Street Sign',
      hpMultiplier: 3.2,
    }),
    enemyWeapons: ['Crutch Lance', 'Hockey Stick'],
    enemyColors: ['Neon Cyan', 'Laser Yellow'],
  }),
  'transit-is-a-battlefield': Object.freeze({
    id: 'transit-is-a-battlefield',
    name: 'Transit Is a Battlefield',
    district: 'roads',
    objective: 'fight_through',
    hook: 'A Nullarbor-straightaway ambush. Clear waves of Road Runner raiders across scrolling asphalt to keep the long-haul contract alive.',
    waves: [4, 5, 5],
    boss: null,
    enemyWeapons: ['Hockey Stick', 'Crutch Lance', 'Street Sign'],
    enemyColors: ['Laser Yellow', 'Cyber Pink', 'Toxic Green'],
  }),
  'million-screens': Object.freeze({
    id: 'million-screens',
    name: 'A Million Screens, Zero Witnesses',
    district: 'glasscity',
    objective: 'retrieve',
    hook: 'Move a chip no autonomous drone is allowed to touch. Clear the empty neon strip and out-skate Nova Saint\u2019s highlight-reel ambush.',
    waves: [3, 4],
    boss: Object.freeze({
      name: 'Nova Saint',
      tactic: 'Trick Strike',
      color: 'Toxic Green',
      weapon: 'Crutch Lance',
      hpMultiplier: 3.0,
    }),
    enemyWeapons: ['Street Sign', 'Crutch Lance'],
    enemyColors: ['Toxic Green', 'Neon Cyan'],
  }),
});

export const STREETS_MISSION_ORDER = Object.freeze([
  'nightshade-run',
  'never-open-the-package',
  'broomstick-first',
  'transit-is-a-battlefield',
  'million-screens',
]);

export const DEFAULT_STREETS_MISSION = 'nightshade-run';

export const STREETS_CHARACTERS = Object.freeze({
  volt: Object.freeze({
    id: 'volt',
    name: 'Volt Vex',
    tagline: 'Balanced shock striker',
    bodyVariant: 'striker',
    colorName: 'Neon Cyan',
    deck: 'Speedline',
    weapon: 'Crutch Lance',
    deckAccentColor: 0xffea00,
    attackEffect: 'shock',
    jumpEffect: 'spark-hop',
    stats: Object.freeze({ attack: 1.08, defense: 1.08, speed: 1, jump: 1, dash: 1 }),
  }),
  brick: Object.freeze({
    id: 'brick',
    name: 'Brick Battery',
    tagline: 'Heavy defense bruiser',
    bodyVariant: 'bruiser',
    colorName: 'Laser Yellow',
    deck: 'Gridwave',
    weapon: 'Street Sign',
    deckAccentColor: 0xff6600,
    attackEffect: 'slam',
    jumpEffect: 'ground-pound',
    stats: Object.freeze({ attack: 1.22, defense: 1.24, speed: 0.88, jump: 0.9, dash: 0.9 }),
  }),
  twist: Object.freeze({
    id: 'twist',
    name: 'Twist Night',
    tagline: 'Spin-jump combo artist',
    bodyVariant: 'spinner',
    colorName: 'Cyber Pink',
    deck: 'Orbit Flip',
    weapon: 'Hockey Stick',
    deckAccentColor: 0x9d00ff,
    attackEffect: 'cyclone',
    jumpEffect: 'spin',
    stats: Object.freeze({ attack: 1, defense: 0.98, speed: 1.06, jump: 1.08, dash: 1.06 }),
  }),
  luna: Object.freeze({
    id: 'luna',
    name: 'Luna Loft',
    tagline: 'High-jump aerial skater',
    bodyVariant: 'vault',
    colorName: 'Toxic Green',
    deck: 'Moonrail',
    weapon: 'Crutch Lance',
    deckAccentColor: 0x39ff14,
    attackEffect: 'comet',
    jumpEffect: 'high-arc',
    stats: Object.freeze({ attack: 1.02, defense: 1, speed: 0.96, jump: 1.32, dash: 0.98 }),
  }),
  zip: Object.freeze({
    id: 'zip',
    name: 'Zip Zed',
    tagline: 'Roll-fast lane runner',
    bodyVariant: 'roller',
    colorName: 'Neon Cyan',
    deck: 'Rushline',
    weapon: 'Hockey Stick',
    wheelSize: 7,
    deckAccentColor: 0x00f0ff,
    attackEffect: 'afterimage',
    jumpEffect: 'roll',
    stats: Object.freeze({ attack: 0.92, defense: 0.92, speed: 1.24, jump: 0.98, dash: 1.35 }),
  }),
  aegis: Object.freeze({
    id: 'aegis',
    name: 'Aegis Ash',
    tagline: 'Guard stance counterpuncher',
    bodyVariant: 'shield',
    colorName: 'Toxic Green',
    deck: 'Bulwark',
    weapon: 'Street Sign',
    deckAccentColor: 0xffffff,
    attackEffect: 'shield-burst',
    jumpEffect: 'float',
    stats: Object.freeze({ attack: 0.98, defense: 1.34, speed: 0.94, jump: 1, dash: 0.92 }),
  }),
});

export const STREETS_CHARACTER_ORDER = Object.freeze(['volt', 'brick', 'twist', 'luna', 'zip', 'aegis']);
export const DEFAULT_STREETS_CHARACTER = 'volt';

const DEFAULT_COSMETICS = Object.freeze({
  colorName: 'Neon Cyan',
  deck: 'Speedline',
  weapon: 'Crutch Lance',
});

export const STREETS_DYNAMIC_TEXTURES = Object.freeze({
  backdrop: 'streets-generated-backdrop',
  playerSprite: 'streets-player-sprite',
});

/** Clamp helper that tolerates NaN / non-finite input. */
function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Map forged-card stats onto gameplay knobs.
 *
 * Forge stats are roughly 0..100. We translate them into ranges tuned for the
 * beat-em-up so a high-Grit bruiser actually feels tanky and a high-Speed
 * courier actually feels fast, without letting any single card trivialize a
 * stage.
 *
 * @param {object} stats - ForgedCardStats-like: { speed, range, stealth, grit }.
 * @param {object} joust - JoustCardProfile-like: { lance, shield, hype }.
 */
export function mapStatsToFighter(stats = {}, joust = {}) {
  const speed = clampNumber(stats.speed, 0, 100, 55);
  const range = clampNumber(stats.range, 0, 100, 50);
  const stealth = clampNumber(stats.stealth, 0, 100, 50);
  const grit = clampNumber(stats.grit, 0, 100, 55);
  const lance = clampNumber(joust.lance, 0, 100, 50);
  const shield = clampNumber(joust.shield, 0, 100, 50);
  const hype = clampNumber(joust.hype, 0, 100, 50);

  return {
    // Grit is survivability; Streets defaults favor the player so the mode is
    // winnable before highly tuned forged cards exist.
    maxHp: Math.round(105 + grit * 1.65),
    // Speed drives top horizontal velocity and acceleration.
    moveSpeed: Math.round(205 + speed * 1.9),
    accel: Math.round(980 + speed * 6.5),
    // Lance drives reach and per-hit damage.
    attackReach: Math.round(74 + lance * 0.82),
    attackDamage: Math.round(15 + lance * 0.28),
    // Shield reduces incoming damage and recovery (dazed) time.
    damageResist: clampNumber(0.12 + shield / 210, 0, 0.55, 0.22),
    recoverMs: Math.round(900 - shield * 4),
    // Hype fills the special (board-flip nova) meter faster.
    specialChargePerHit: Math.round(14 + hype * 0.22),
    // Stealth slightly improves dash distance (slip the lane).
    dashBoost: Math.round(220 + stealth * 1.3),
    // Range nudges jump strength (more battery = bigger ollies).
    jumpForce: Math.round(430 + range * 0.75),
  };
}

function readCosmetics(params, prefix) {
  return {
    colorName: params.get(`${prefix}Color`) || DEFAULT_COSMETICS.colorName,
    deck: params.get(`${prefix}Deck`) || DEFAULT_COSMETICS.deck,
    weapon: params.get(`${prefix}Weapon`) || DEFAULT_COSMETICS.weapon,
    characterImageUrl: params.get(`${prefix}Sprite`) || null,
    name: params.get(`${prefix}Name`) || null,
  };
}

function readStats(params, prefix) {
  return {
    speed: Number(params.get(`${prefix}Speed`)),
    range: Number(params.get(`${prefix}Range`)),
    stealth: Number(params.get(`${prefix}Stealth`)),
    grit: Number(params.get(`${prefix}Grit`)),
  };
}

function readJoust(params, prefix) {
  return {
    lance: Number(params.get(`${prefix}Lance`)),
    shield: Number(params.get(`${prefix}Shield`)),
    hype: Number(params.get(`${prefix}Hype`)),
  };
}

/**
 * Only allow same-origin relative return URLs to avoid open-redirect abuse
 * when the game bounces the player back to the Missions Map.
 */
export function sanitizeReturnTo(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  // Reject absolute URLs and protocol-relative URLs.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return null;
  if (!raw.startsWith('/')) return null;
  return raw;
}

export function sanitizeMediaUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  if (value.startsWith('/')) return value.startsWith('//') ? null : value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Parse the launch configuration from the current URL. Everything is optional;
 * missing values fall back to a self-contained free-play default so the page
 * also works when opened directly from the Arena.
 */
export function parseStreetsConfig(search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const params = new URLSearchParams(search || '');

  const requestedMission = params.get('mission');
  const missionId = requestedMission && STREETS_MISSIONS[requestedMission]
    ? requestedMission
    : null;
  const mission = missionId ? STREETS_MISSIONS[missionId] : null;

  const objectiveParam = params.get('objective');
  const objectiveId = objectiveParam && STREETS_OBJECTIVES[objectiveParam]
    ? objectiveParam
    : (mission ? mission.objective : STREETS_OBJECTIVES.fight_through.id);

  const districtParam = params.get('district');
  const districtId = districtParam && STREETS_DISTRICTS[districtParam]
    ? districtParam
    : (mission ? mission.district : STREETS_DISTRICTS.nightshade.id);

  const player = {
    cosmetics: readCosmetics(params, 'p'),
    stats: readStats(params, 'p'),
    joust: readJoust(params, 'p'),
  };

  const requestedCharacter = params.get('character');
  const characterId = requestedCharacter && STREETS_CHARACTERS[requestedCharacter]
    ? requestedCharacter
    : DEFAULT_STREETS_CHARACTER;

  const playerSpriteUrl = sanitizeMediaUrl(player.cosmetics.characterImageUrl);
  if (playerSpriteUrl) {
    player.cosmetics.characterImageUrl = playerSpriteUrl;
    player.cosmetics.characterTextureKey = STREETS_DYNAMIC_TEXTURES.playerSprite;
  } else {
    player.cosmetics.characterImageUrl = null;
    player.cosmetics.characterTextureKey = null;
  }

  const launchedFromMission = Boolean(
    params.get('runId') || params.get('mission') || params.get('returnTo'),
  );
  const levelBackdropUrl = sanitizeMediaUrl(params.get('levelBackdrop'));

  return {
    missionId,
    mission,
    objectiveId,
    districtId,
    player,
    characterId,
    // Mission-Map round-trip context (echoed back on the result redirect).
    runId: params.get('runId') || null,
    nodeId: params.get('nodeId') || null,
    choiceId: params.get('choiceId') || null,
    returnTo: sanitizeReturnTo(params.get('returnTo')),
    launchedFromMission,
    levelSeed: params.get('levelSeed') || params.get('runId') || missionId || districtId,
    levelBackdropUrl,
    levelBackdropTextureKey: levelBackdropUrl ? STREETS_DYNAMIC_TEXTURES.backdrop : null,
  };
}
