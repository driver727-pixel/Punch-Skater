export interface CyberJoustColorOption {
  name: string;
  value: number;
}

export interface CyberJoustWeaponOption {
  name: string;
  speed: string;
  weight: string;
  reach: string;
}

export interface CyberJoustBodySpriteRecord {
  kind: "body";
  slug: string;
  label: string;
  colorName: string;
  color: number;
  deck: string;
  imagePath: string;
  imageUrl?: string;
  storagePath?: string;
}

export interface CyberJoustWeaponSpriteRecord {
  kind: "weapon";
  slug: string;
  label: string;
  colorName: string;
  color: number;
  weapon: string;
  imagePath: string;
  imageUrl?: string;
  storagePath?: string;
}

export interface CyberJoustFighterManifestEntry {
  slug: string;
  label: string;
  colorName: string;
  color: number;
  deck: string;
  weapon: string;
  bodySlug: string;
  weaponSlug: string;
}

export interface CyberJoustSpriteManifest {
  version: number;
  generatedAt: string;
  bodies: CyberJoustBodySpriteRecord[];
  weapons: CyberJoustWeaponSpriteRecord[];
  fighters: CyberJoustFighterManifestEntry[];
}

export const CYBER_JOUST_SPRITE_COLLECTION = "cyberJoustSprites";
export const CYBER_JOUST_STORAGE_PREFIX = "cyber-joust/fighters";
export const CYBER_JOUST_STATIC_ASSET_BASE = "assets/fighters";
export const CYBER_JOUST_BODY_CANVAS_SIZE = 96;
export const CYBER_JOUST_WEAPON_CANVAS_SIZE = 64;

export const CYBER_JOUST_COLORS: CyberJoustColorOption[] = [
  { name: "Neon Cyan", value: 0x00f0ff },
  { name: "Cyber Pink", value: 0xff007f },
  { name: "Laser Yellow", value: 0xffea00 },
  { name: "Toxic Green", value: 0x39ff14 },
];

export const CYBER_JOUST_DECKS = ["Speedline", "Gridwave", "ToxiCorp", "Hologram"] as const;

export const CYBER_JOUST_WEAPONS: CyberJoustWeaponOption[] = [
  { name: "Hockey Stick", speed: "⚡⚡⚡", weight: "⚡", reach: "⚡⚡" },
  { name: "Street Sign", speed: "⚡", weight: "⚡⚡⚡", reach: "⚡⚡" },
  { name: "Crutch Lance", speed: "⚡⚡", weight: "⚡⚡", reach: "⚡⚡⚡" },
];

const COLOR_NAME_ALIASES: Record<string, string> = {
  cyan: "Neon Cyan",
  "neon cyan": "Neon Cyan",
  "cyber pink": "Cyber Pink",
  "laser yellow": "Laser Yellow",
  "toxic green": "Toxic Green",
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createCenteredContext(size: number): CanvasRenderingContext2D {
  const canvas = createCanvas(size);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable in this browser.");
  }
  context.translate(size / 2, size / 2);
  context.lineJoin = "round";
  context.lineCap = "round";
  return context;
}

export function normalizeCyberJoustColorName(colorName?: string): string {
  const normalized = colorName?.trim().toLowerCase() ?? "";
  return COLOR_NAME_ALIASES[normalized] ?? CYBER_JOUST_COLORS[0].name;
}

export function getCyberJoustColor(colorName?: string, colorValue?: number): CyberJoustColorOption {
  const byName = CYBER_JOUST_COLORS.find((entry) => entry.name === normalizeCyberJoustColorName(colorName));
  if (byName) return byName;
  const byValue = CYBER_JOUST_COLORS.find((entry) => entry.value === colorValue);
  return byValue ?? CYBER_JOUST_COLORS[0];
}

export function buildCyberJoustBodySlug(colorName: string, deck: string): string {
  return `${slugify(normalizeCyberJoustColorName(colorName))}--${slugify(deck)}`;
}

export function buildCyberJoustWeaponSlug(colorName: string, weapon: string): string {
  return `${slugify(normalizeCyberJoustColorName(colorName))}--${slugify(weapon)}`;
}

export function buildCyberJoustBodyFilename(slug: string): string {
  return `body-${slug}.png`;
}

export function buildCyberJoustWeaponFilename(slug: string): string {
  return `weapon-${slug}.png`;
}

export function buildCyberJoustBodyRecord(
  colorName: string,
  deck: string,
  overrides: Partial<CyberJoustBodySpriteRecord> = {},
): CyberJoustBodySpriteRecord {
  const color = getCyberJoustColor(colorName);
  const slug = buildCyberJoustBodySlug(color.name, deck);
  return {
    kind: "body",
    slug,
    label: `${color.name} / ${deck}`,
    colorName: color.name,
    color: color.value,
    deck,
    imagePath: `${CYBER_JOUST_STATIC_ASSET_BASE}/${buildCyberJoustBodyFilename(slug)}`,
    ...overrides,
  };
}

export function buildCyberJoustWeaponRecord(
  colorName: string,
  weapon: string,
  overrides: Partial<CyberJoustWeaponSpriteRecord> = {},
): CyberJoustWeaponSpriteRecord {
  const color = getCyberJoustColor(colorName);
  const slug = buildCyberJoustWeaponSlug(color.name, weapon);
  return {
    kind: "weapon",
    slug,
    label: `${color.name} / ${weapon}`,
    colorName: color.name,
    color: color.value,
    weapon,
    imagePath: `${CYBER_JOUST_STATIC_ASSET_BASE}/${buildCyberJoustWeaponFilename(slug)}`,
    ...overrides,
  };
}

export function buildCyberJoustSpriteManifest({
  bodies,
  weapons,
  generatedAt = new Date().toISOString(),
}: {
  bodies: CyberJoustBodySpriteRecord[];
  weapons: CyberJoustWeaponSpriteRecord[];
  generatedAt?: string;
}): CyberJoustSpriteManifest {
  const normalizedBodies = [...bodies].sort((left, right) => left.slug.localeCompare(right.slug));
  const normalizedWeapons = [...weapons].sort((left, right) => left.slug.localeCompare(right.slug));
  const bodyByColorDeck = new Map(normalizedBodies.map((entry) => [`${entry.colorName}::${entry.deck}`, entry]));
  const weaponByColorWeapon = new Map(normalizedWeapons.map((entry) => [`${entry.colorName}::${entry.weapon}`, entry]));

  const fighters = CYBER_JOUST_COLORS.flatMap((color) =>
    CYBER_JOUST_DECKS.flatMap((deck) =>
      CYBER_JOUST_WEAPONS.map((weapon) => {
        const body = bodyByColorDeck.get(`${color.name}::${deck}`);
        const weaponSprite = weaponByColorWeapon.get(`${color.name}::${weapon.name}`);
        return {
          slug: `${buildCyberJoustBodySlug(color.name, deck)}--${slugify(weapon.name)}`,
          label: `${color.name} / ${deck} / ${weapon.name}`,
          colorName: color.name,
          color: color.value,
          deck,
          weapon: weapon.name,
          bodySlug: body?.slug ?? buildCyberJoustBodySlug(color.name, deck),
          weaponSlug: weaponSprite?.slug ?? buildCyberJoustWeaponSlug(color.name, weapon.name),
        };
      }),
    ),
  );

  return {
    version: 1,
    generatedAt,
    bodies: normalizedBodies,
    weapons: normalizedWeapons,
    fighters,
  };
}

export function renderCyberJoustBodySprite(colorName: string, deck: string): HTMLCanvasElement {
  const color = getCyberJoustColor(colorName);
  const context = createCenteredContext(CYBER_JOUST_BODY_CANVAS_SIZE);
  const canvas = context.canvas as HTMLCanvasElement;

  let deckStroke = color.value;
  let leftWheel = 0xff007f;
  let rightWheel = 0xff007f;
  let accent = 0xffea00;

  if (deck === "Gridwave") {
    deckStroke = 0xff007f;
    leftWheel = 0x00f0ff;
    rightWheel = 0x00f0ff;
    accent = color.value;
  } else if (deck === "ToxiCorp") {
    deckStroke = 0x39ff14;
    leftWheel = 0xffea00;
    rightWheel = 0xffea00;
    accent = 0xff0055;
  } else if (deck === "Hologram") {
    deckStroke = 0xffea00;
    leftWheel = 0x9d00ff;
    rightWheel = 0x9d00ff;
    accent = 0x00f0ff;
  }

  context.fillStyle = "#222233";
  context.strokeStyle = toCssColor(deckStroke);
  context.lineWidth = 2;
  context.fillRect(-27, 15, 54, 8);
  context.strokeRect(-27, 15, 54, 8);

  context.fillStyle = toCssColor(leftWheel);
  context.beginPath();
  context.arc(-18, 28, 5, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(18, 28, 5, 0, Math.PI * 2);
  context.fillStyle = toCssColor(rightWheel);
  context.fill();

  context.fillStyle = toCssColor(accent);
  context.fillRect(-19, 12, 38, 2);

  context.fillStyle = "#16122c";
  context.strokeStyle = toCssColor(color.value);
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-10, -5);
  context.lineTo(10, -10);
  context.lineTo(15, -30);
  context.lineTo(-5, -35);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#11111d";
  context.strokeStyle = "#ff007f";
  context.beginPath();
  context.moveTo(-8, -5);
  context.lineTo(8, -5);
  context.lineTo(5, 12);
  context.lineTo(-5, 12);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = toCssColor(color.value);
  context.beginPath();
  context.arc(8, -42, 9, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#000000";
  context.beginPath();
  context.arc(10, -42, 6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffea00";
  context.fillRect(11, -44, 4, 3);

  return canvas;
}

export function renderCyberJoustWeaponSprite(colorName: string, weapon: string): HTMLCanvasElement {
  const color = getCyberJoustColor(colorName);
  const context = createCenteredContext(CYBER_JOUST_WEAPON_CANVAS_SIZE);
  const canvas = context.canvas as HTMLCanvasElement;

  if (weapon === "Hockey Stick") {
    context.strokeStyle = toCssColor(color.value);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-10, -10);
    context.lineTo(25, 5);
    context.lineTo(38, 0);
    context.stroke();

    context.fillStyle = "#ff007f";
    context.beginPath();
    context.arc(8, -2, 3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(20, 3, 3, 0, Math.PI * 2);
    context.fill();
    return canvas;
  }

  if (weapon === "Street Sign") {
    context.strokeStyle = "#ff0055";
    context.fillStyle = "#b2003b";
    context.lineWidth = 3;
    context.beginPath();
    const signX = 25;
    const signY = -5;
    const radius = 14;
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      const px = signX + radius * Math.cos(angle);
      const py = signY + radius * Math.sin(angle);
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.stroke();

    context.strokeStyle = "#cccccc";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-5, -5);
    context.lineTo(15, -5);
    context.stroke();

    context.fillStyle = "#ffffff";
    context.fillRect(signX - 6, signY - 2, 12, 4);
    return canvas;
  }

  context.strokeStyle = "#00f0ff";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-15, -5);
  context.lineTo(18, -5);
  context.moveTo(-15, -12);
  context.lineTo(5, -5);
  context.moveTo(-15, 2);
  context.lineTo(5, -5);
  context.stroke();

  context.fillStyle = "#ff007f";
  context.fillRect(-18, -14, 4, 16);

  context.strokeStyle = "#ffea00";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(10, -5);
  context.lineTo(15, -9);
  context.lineTo(20, -1);
  context.lineTo(25, -5);
  context.lineTo(32, -5);
  context.stroke();

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode the sprite PNG."));
    }, "image/png");
  });
}
