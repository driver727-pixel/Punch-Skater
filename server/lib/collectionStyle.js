import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const LORE_CHARACTER_NAMES = nodeRequire('../../shared/loreCharacterNames.json');

export const COLLECTION_STYLE_PROFILE_ID = 'collection-style';
export const COLLECTION_STYLE_CARD_COUNT = 64;
export const COLLECTION_STYLE_APPROVAL_COUNT = 4;
export const MIN_COLLECTION_STYLE_SOURCES = 12;
export const MAX_COLLECTION_STYLE_SOURCES = 64;
export const MAX_COLLECTION_STYLE_IMAGE_BYTES = 12 * 1024 * 1024;

const ALLOWED_CHARACTER_IMAGE_HOSTS = [
  /(^|\.)fal\.media$/i,
  /^firebasestorage\.googleapis\.com$/i,
  /(^|\.)firebasestorage\.googleapis\.com$/i,
  /^storage\.googleapis\.com$/i,
  /(^|\.)storage\.googleapis\.com$/i,
];

const ARCHETYPES = [
  'The Knights Technarchy',
  'Qu111s',
  'Ne0n Legion',
  'Iron Curtains',
  'D4rk $pider',
  'The Asclepians',
  'The Mesopotamian Society',
  "Hermes' Squirmies",
  'UCPS',
  'The Team',
];

const ARCHETYPE_TO_FACTION = {
  'The Knights Technarchy': 'The Knights Technarchy',
  Qu111s: 'Qu111s (Quills)',
  'Ne0n Legion': 'Ne0n Legion',
  'Iron Curtains': 'Iron Curtains',
  'D4rk $pider': 'D4rk $pider',
  'The Asclepians': 'The Asclepians',
  'The Mesopotamian Society': 'The Mesopotamian Society',
  "Hermes' Squirmies": "Hermes' Squirmies",
  UCPS: 'UCPS Workers',
  'The Team': 'The Team',
};

const STYLES = [
  'Corporate',
  'Punk Rocker',
  'Ex Military',
  'Fascist',
  'Street',
  'Off-grid',
  'Union',
  'Olympic',
];

const DISTRICTS = [
  'Airaway',
  'Batteryville',
  'The Grid',
  'Nightshade',
  'The Forest',
  'Glass City',
];

const GENDERS = ['Woman', 'Man', 'Non-binary'];
const AGE_GROUPS = ['Young Adult', 'Adult', 'Middle-aged', 'Senior'];
const BODY_TYPES = ['Slim', 'Athletic', 'Average', 'Heavy'];
const HAIR_LENGTHS = ['Bald', 'Short', 'Medium', 'Long'];
const SKIN_TONES = ['Light', 'Medium', 'Dark', 'Very Dark'];
const FACE_CHARACTERS = ['Conventional', 'Attractive', 'Weathered', 'Scarred', 'Rugged'];
const ACCENT_COLORS = ['#00ff88', '#00ccff', '#3366ff', '#ff4444', '#ffaa00', '#8b5cf6', '#ff66cc'];

const RARITIES = [
  { rarity: 'Punch Skater™', multiplier: 1, badgeLabel: 'Punch Skater' },
  { rarity: 'Apprentice', multiplier: 1.1, badgeLabel: 'Apprentice' },
  { rarity: 'Master', multiplier: 1.2, badgeLabel: 'Master' },
  { rarity: 'Rare', multiplier: 1.35, badgeLabel: 'Rare' },
];

const BACKGROUND_ASSETS = {
  Airaway: '/assets/backgrounds/airaway.jpg',
  Nightshade: '/assets/backgrounds/nightshade.jpg',
  Batteryville: '/assets/backgrounds/batteryville.jpg',
  'The Grid': '/assets/backgrounds/the-grid.jpg',
  'The Forest': '/assets/backgrounds/the-forest.jpg',
  'Glass City': '/assets/backgrounds/glass-city.jpg',
};

const FRAME_ASSETS = {
  'Punch Skater™': '/assets/frames/punch-skater-front.png',
  Apprentice: '/assets/frames/apprentice-front.png',
  Master: '/assets/frames/master-front.png',
  Rare: '/assets/frames/rare-front.png',
};

const WEAPONS = [
  '/assets/weapons/hockey-stick.png',
  '/assets/weapons/road-sign.png',
  '/assets/weapons/crutch-blue.png',
  '/assets/weapons/medieval-lance.png',
];

const BOARD_ART = [
  {
    imageUrl: '/assets/boards/approved/mountainboard-master.png',
    config: {
      boardType: 'Mountain',
      drivetrain: '4WD',
      driveOrientation: 'Rear-Wheel Drive',
      motor: 'Outrunner',
      wheels: 'Pneumatic',
      battery: 'TopPeli',
    },
    accessProfile: 'Off-grid forest access',
    totalWeight: 190,
    loadoutSummary: 'Approved mountainboard master build',
    components: {
      boardType: 'Mountain',
      drivetrain: '4WD',
      motor: 'Outrunner',
      wheels: 'Pneumatic',
      battery: 'TopPeli',
    },
  },
  {
    imageUrl: '/assets/boards/approved/carbon-gtr.png',
    config: {
      boardType: 'Street',
      drivetrain: 'Belt',
      driveOrientation: 'Rear-Wheel Drive',
      motor: 'Torque',
      wheels: 'Pneumatic',
      battery: 'DoubleStack',
    },
    accessProfile: 'Urban district access',
    totalWeight: 110,
    loadoutSummary: 'Approved carbon GTR build',
    components: {
      boardType: 'Street',
      drivetrain: 'Belt',
      motor: 'Torque',
      wheels: 'Pneumatic',
      battery: 'DoubleStack',
    },
  },
];

const BOARD_POSE_SCENES = [
  {
    key: 'workshop',
    characterPrompt:
      'crouching or kneeling slightly left of center, both hands working low in the foreground while leaving a long clear empty gap near the feet — adjusting an unseen component just outside the character layer — gaze aimed downward at the empty work area; functional hands-on repair pose; keep the body pulled slightly back from the camera with visible boots and clear negative space for later compositing',
  },
  {
    key: 'loadout',
    characterPrompt:
      'standing slightly left of center in a confident hero stance — arms crossed, fist raised, or one arm extended — with the full right side kept clear from shoulder to boots as an empty reserved compositing zone; gaze forward or slightly to the side; keep the figure zoomed out with comfortable headroom and open space around the legs',
  },
  {
    key: 'airborne',
    characterPrompt:
      'fully airborne — launched high with bent knees, arm thrown out for balance, or throwing a punch mid-flight — body elevated well above the lower half of the frame; aggressive athletic air pose with strong upward energy; leave the lower frame open as a clean empty compositing zone beneath or beside the body; keep the subject zoomed out with visible boots and clean negative space',
  },
  {
    key: 'showcase',
    characterPrompt:
      'standing slightly left of center with a satisfied smile or impressed gaze, one hand gesturing or pointing proudly toward a clean empty display area on the right; weight shifted to one hip, relaxed proud stance directed at the reserved compositing zone; keep that zone completely open beside them',
  },
  {
    key: 'painting',
    characterPrompt:
      'crouching low or kneeling beside a long clear empty zone in the lower foreground, brush or spray can in hand, making careful strokes toward empty air while keeping the reserved area unobstructed; head tilted with concentration, free hand steadying without crossing into the empty compositing zone; creative focused expression; keep the body pulled back from the camera with visible boots',
  },
  {
    key: 'wheels',
    characterPrompt:
      'squatting or kneeling with both hands reaching toward a clear empty service area in the lower-center foreground — small hand tool or wrench in one hand — miming precise mechanical work while keeping the reserved compositing area completely unobstructed; gaze down and concentrated on the empty work area; keep the body slightly offset so the open area stays fully inside frame',
  },
  {
    key: 'cleaning',
    characterPrompt:
      'bent forward or kneeling beside an open long empty space on the right, cloth or soft brush in hand, wiping and polishing empty air while leaving the reserved compositing area clear next to them; deliberate care in every stroke, free hand steadying without covering the empty zone; meticulous detailing pose; keep the figure zoomed out with visible boots',
  },
];

const BOARD_PLACEMENTS = {
  workshop: { xPercent: 38, yPercent: 77.5, scale: 1, rotationDeg: -9 },
  loadout: { xPercent: 75, yPercent: 46, scale: 1, rotationDeg: 8 },
  airborne: { xPercent: 50, yPercent: 81, scale: 1, rotationDeg: -10 },
  showcase: { xPercent: 69.5, yPercent: 75.5, scale: 1, rotationDeg: 3 },
  painting: { xPercent: 37.5, yPercent: 75.5, scale: 1, rotationDeg: -8 },
  wheels: { xPercent: 47, yPercent: 80.5, scale: 1, rotationDeg: -5 },
  cleaning: { xPercent: 67, yPercent: 77, scale: 1, rotationDeg: 5 },
};

const CHARACTER_PLACEMENT = { xPercent: 50, yPercent: 59, scale: 1, rotationDeg: 0 };
const WEAPON_PLACEMENT = { xPercent: 65, yPercent: 55, scale: 0.7, rotationDeg: -15 };

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function seedFromString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeededRandom(seed) {
  return mulberry32(seedFromString(seed));
}

function pick(random, values) {
  return values[Math.floor(random() * values.length)];
}

function uniqueShuffledNames(batchId) {
  const random = createSeededRandom(`${batchId}:collection-style-names`);
  const names = [...LORE_CHARACTER_NAMES];
  for (let index = names.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [names[index], names[swapIndex]] = [names[swapIndex], names[index]];
  }
  return names;
}

function resolveBoardPoseScene(characterSeed) {
  const random = createSeededRandom(`${characterSeed}|exact-board-scene`);
  return BOARD_POSE_SCENES[Math.floor(random() * BOARD_POSE_SCENES.length)];
}

function stableCardId(batchId, index) {
  return `collection-${batchId}-${String(index + 1).padStart(2, '0')}`;
}

function buildBoardLoadout(board, random) {
  return {
    style: board.config.boardType === 'Mountain' ? 'Aggressive' : 'Sleek',
    speed: 7 + Math.floor(random() * 3),
    acceleration: board.config.motor === 'Outrunner' ? 10 : 8,
    accessProfile: board.accessProfile,
    range: board.config.battery === 'TopPeli' ? 10 : 8,
    traction: board.config.wheels === 'Pneumatic' ? 9 : 7,
  };
}

function buildRole(archetype) {
  return {
    archetype,
    label: archetype,
    coverRole: 'collection courier',
    passiveName: "Collector's Edge",
    passiveDescription: 'A curated collection rider with a balanced field profile.',
    roleBonuses: { speed: 0, range: 0, stealth: 0, grit: 0 },
  };
}

function buildJoustProfile(board, random) {
  return {
    lance: 6 + Math.floor(random() * 4),
    shield: 6 + Math.floor(random() * 4),
    hype: 6 + Math.floor(random() * 4),
    gear: {
      boardType: board.config.boardType,
      lanceType: 'collection lance',
      shieldType: 'collection shield',
      armorTag: 'collection layer',
    },
    traits: ['collection-style'],
  };
}

/**
 * Creates a deterministic card payload plan that reuses only static scene,
 * background, frame, board, and weapon art. The character layer is deliberately
 * left absent until the batch worker completes its single Fal generation.
 */
export function buildCollectionStyleCards({
  batchId,
  totalCards = COLLECTION_STYLE_CARD_COUNT,
  profileId = COLLECTION_STYLE_PROFILE_ID,
  profileVersion,
  createdAt = new Date().toISOString(),
}) {
  if (!Number.isInteger(totalCards) || totalCards !== COLLECTION_STYLE_CARD_COUNT) {
    throw badRequest(`Collection batches must contain exactly ${COLLECTION_STYLE_CARD_COUNT} cards.`);
  }
  if (LORE_CHARACTER_NAMES.length < totalCards) {
    throw new Error('The lore character-name pool is too small for a unique collection batch.');
  }

  return uniqueShuffledNames(batchId).slice(0, totalCards).map((name, index) => {
    const random = createSeededRandom(`${batchId}:${index}:${name}`);
    const archetype = pick(random, ARCHETYPES);
    const style = pick(random, STYLES);
    const district = pick(random, DISTRICTS);
    const gender = pick(random, GENDERS);
    const ageGroup = pick(random, AGE_GROUPS);
    const bodyType = pick(random, BODY_TYPES);
    const hairLength = pick(random, HAIR_LENGTHS);
    const skinTone = pick(random, SKIN_TONES);
    const faceCharacter = pick(random, FACE_CHARACTERS);
    const accentColor = pick(random, ACCENT_COLORS);
    const rarityDetails = pick(random, RARITIES);
    const board = pick(random, BOARD_ART);
    const characterSeed = `${batchId}|${index}|${archetype}|${style}|${gender}|${ageGroup}|${bodyType}|${hairLength}|${accentColor}|${skinTone}|${faceCharacter}`;
    const scene = resolveBoardPoseScene(characterSeed);
    const serialSuffix = String(seedFromString(characterSeed) % 10000).padStart(4, '0');
    const stats = {
      speed: 5 + Math.floor(random() * 6),
      range: 5 + Math.floor(random() * 6),
      rangeNm: 20 + Math.floor(random() * 80),
      stealth: 5 + Math.floor(random() * 6),
      grit: 5 + Math.floor(random() * 6),
    };

    return {
      id: stableCardId(batchId, index),
      version: '2.0.0',
      createdAt,
      seed: `${rarityDetails.rarity}::${district}::${characterSeed}`,
      frameSeed: rarityDetails.rarity,
      backgroundSeed: district,
      characterSeed,
      prompts: {
        archetype,
        rarity: rarityDetails.rarity,
        style,
        district,
        accentColor,
        gender,
        ageGroup,
        bodyType,
        hairLength,
        skinTone,
        faceCharacter,
      },
      class: {
        rarity: rarityDetails.rarity,
        multiplier: rarityDetails.multiplier,
        badgeLabel: rarityDetails.badgeLabel,
      },
      identity: {
        name,
        crew: ARCHETYPE_TO_FACTION[archetype],
        serialNumber: `PS-${serialSuffix}`,
        age: '',
      },
      role: buildRole(archetype),
      variance: { speed: 0, range: 0, stealth: 0, grit: 0 },
      stats,
      joust: buildJoustProfile(board, random),
      board: {
        config: board.config,
        loadout: buildBoardLoadout(board, random),
        imageUrl: board.imageUrl,
        placement: BOARD_PLACEMENTS[scene.key],
        layerOrder: index % 2 === 0 ? 'behind-character' : 'in-front',
        totalWeight: board.totalWeight,
        tuned: false,
        components: board.components,
        loadoutSummary: board.loadoutSummary,
        accessProfile: board.accessProfile,
      },
      maintenance: {
        state: 'active',
        chargePct: 100,
        repairMinutes: 0,
      },
      visuals: {
        helmetStyle: `${style.toLowerCase().replace(/\s+/g, '-')}-helm`,
        jacketStyle: `${style.toLowerCase().replace(/\s+/g, '-')}-jacket`,
        colorScheme: 'collection-neon',
        accentColor,
        storagePackStyle: index % 2 === 0 ? 'backpack' : 'duffel-bag',
      },
      front: {
        flavorText: `Running a collection route through ${district}.`,
        flavorTextEnglish: `Running a collection route through ${district}.`,
      },
      back: {},
      backgroundImageUrl: BACKGROUND_ASSETS[district],
      frameImageUrl: FRAME_ASSETS[rarityDetails.rarity],
      weaponImageUrl: WEAPONS[index % WEAPONS.length],
      characterPlacement: CHARACTER_PLACEMENT,
      weaponPlacement: WEAPON_PLACEMENT,
      xp: 0,
      ozzies: 0,
      collectionStyle: {
        profileId,
        profileVersion,
        sceneKey: scene.key,
      },
    };
  });
}

export function normalizeCollectionStyleToken(value) {
  const token = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z][a-z0-9_-]{2,47}$/.test(token)) {
    throw badRequest('triggerToken must start with a letter and contain 3-48 lowercase letters, numbers, hyphens, or underscores.');
  }
  return token;
}

export function normalizeCollectionStyleSourceIds(value) {
  if (!Array.isArray(value)) {
    throw badRequest('sourceCardIds must be an array of admin Boss Asset IDs.');
  }
  const sourceCardIds = value.map((entry) => (typeof entry === 'string' ? entry.trim() : ''));
  if (
    sourceCardIds.length < MIN_COLLECTION_STYLE_SOURCES
    || sourceCardIds.length > MAX_COLLECTION_STYLE_SOURCES
    || sourceCardIds.some((id) => !id || id.includes('/'))
    || new Set(sourceCardIds).size !== sourceCardIds.length
  ) {
    throw badRequest(`Choose ${MIN_COLLECTION_STYLE_SOURCES}-${MAX_COLLECTION_STYLE_SOURCES} unique character-layer Boss Assets.`);
  }
  return sourceCardIds;
}

export function isAllowedCharacterLayerUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && ALLOWED_CHARACTER_IMAGE_HOSTS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

function descriptionPart(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function buildCollectionStyleCaption(card, triggerToken, customCaption = '') {
  const prompts = card?.prompts ?? {};
  const attributes = [
    'adult',
    descriptionPart(prompts.gender, 'courier'),
    descriptionPart(prompts.ageGroup, 'adult'),
    descriptionPart(prompts.bodyType, 'skater'),
    descriptionPart(prompts.style, 'street'),
    descriptionPart(prompts.archetype, 'courier'),
    descriptionPart(prompts.hairLength, ''),
    descriptionPart(prompts.skinTone, ''),
    descriptionPart(prompts.faceCharacter, ''),
  ].filter(Boolean);
  const note = typeof customCaption === 'string' ? customCaption.trim().slice(0, 280) : '';
  return [triggerToken, ...attributes, 'character-layer art', note].filter(Boolean).join(', ');
}

export function assertCollectionStyleSourceVariety(cards) {
  const distinct = (field) => new Set(cards.map((card) => card?.prompts?.[field]).filter(Boolean)).size;
  if (distinct('archetype') < 3 || distinct('district') < 3 || distinct('style') < 3) {
    throw badRequest('Training sources need at least three archetypes, districts, and styles to reduce overfitting.');
  }
}

export function inferImageExtension(contentType) {
  const normalized = typeof contentType === 'string' ? contentType.split(';', 1)[0].trim().toLowerCase() : '';
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/png') return 'png';
  return null;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = buildCrcTable();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = Math.max(1980, safeDate.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((safeDate.getUTCMonth() + 1) << 5) | safeDate.getUTCDate(),
    time: (safeDate.getUTCHours() << 11) | (safeDate.getUTCMinutes() << 5) | Math.floor(safeDate.getUTCSeconds() / 2),
  };
}

/**
 * Builds a standard, uncompressed ZIP archive using only Node primitives.
 * Fal accepts ZIP datasets and storing entries avoids a new runtime dependency.
 */
export function buildTrainingDatasetZip(entries, createdAt = new Date()) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('At least one training dataset entry is required.');
  }

  const { date, time } = dosDateTime(createdAt);
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const name = typeof entry?.name === 'string' ? entry.name : '';
    const data = Buffer.isBuffer(entry?.data) ? entry.data : Buffer.from(entry?.data ?? '');
    if (!name || name.includes('..') || name.startsWith('/') || name.includes('\\')) {
      throw new Error('Training dataset entry names must be safe relative paths.');
    }

    const filename = Buffer.from(name, 'utf8');
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);
    chunks.push(localHeader, filename, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralDirectory.push(centralHeader, filename);
    offset += localHeader.length + filename.length + data.length;
  }

  const centralSize = centralDirectory.reduce((total, chunk) => total + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, ...centralDirectory, end]);
}

export function extractFalImageUrl(payload) {
  const data = payload?.data ?? payload;
  const candidates = [
    data?.image?.url,
    data?.image,
    data?.image_url,
    data?.images?.[0]?.url,
    data?.output?.url,
    data?.output,
  ];
  return candidates.find((value) => typeof value === 'string' && value) ?? null;
}

export function extractFalLoraUrl(payload) {
  const data = payload?.data ?? payload;
  const candidates = [
    data?.diffusers_lora_file?.url,
    data?.diffusers_lora_file,
    data?.lora_file?.url,
    data?.lora_file,
    data?.lora_url,
    data?.lora?.url,
    data?.output?.lora_url,
    data?.output?.url,
  ];
  return candidates.find((value) => typeof value === 'string' && isAllowedCharacterLayerUrl(value)) ?? null;
}

export function buildCollectionStyleCharacterPrompt(card, triggerToken) {
  const prompts = card?.prompts ?? {};
  const scene = resolveBoardPoseScene(card?.characterSeed ?? '');
  const subject = [
    descriptionPart(prompts.gender, 'adult'),
    descriptionPart(prompts.ageGroup, 'adult'),
    descriptionPart(prompts.bodyType, 'athletic'),
    descriptionPart(prompts.archetype, 'courier'),
    descriptionPart(prompts.style, 'street'),
    descriptionPart(prompts.hairLength, ''),
    descriptionPart(prompts.skinTone, ''),
    descriptionPart(prompts.faceCharacter, ''),
  ].filter(Boolean).join(', ');

  return [
    `${triggerToken} collection style, premium comic-book trading-card character illustration.`,
    `Exactly one grounded adult human ${subject}.`,
    `${scene.characterPrompt}.`,
    'Draw only the courier body and clothing on a plain, removable background.',
    'Keep every reserved compositing area completely empty: no board, vehicle, weapon, frame, scenery, props, text, watermark, or extra people.',
    'Full body, visible boots, clean silhouette, sharp detail, safe-for-work, fully clothed.',
  ].join(' ');
}

export const COLLECTION_STYLE_NEGATIVE_PROMPT = [
  'nsfw, child, children, underage, nudity, gore, violence, blood, extra limbs, duplicate limbs, malformed anatomy',
  'skateboard, board, wheels, trucks, vehicle, scooter, roller skates, weapon, frame, card border, text, logo, watermark',
  'background, scenery, buildings, props, extra people, cropped feet, blurry, low resolution, photograph, anime, 3d render',
].join(', ');
