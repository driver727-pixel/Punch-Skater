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
const RIDER_VISOR_RADIUS_X = 6.3;
const RIDER_VISOR_RADIUS_Y = 5.4;
const RIDER_VISOR_ROTATION = -0.25;

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

function mixColor(color: number, target: number, blendAmount: number): number {
  const ratio = Math.max(0, Math.min(1, blendAmount));
  const red = Math.round(((color >> 16) & 0xff) * (1 - ratio) + ((target >> 16) & 0xff) * ratio);
  const green = Math.round(((color >> 8) & 0xff) * (1 - ratio) + ((target >> 8) & 0xff) * ratio);
  const blue = Math.round((color & 0xff) * (1 - ratio) + (target & 0xff) * ratio);
  return (red << 16) | (green << 8) | blue;
}

function drawNeonStroke(
  context: CanvasRenderingContext2D,
  color: number,
  width: number,
  drawPath: () => void,
  glow = 10,
): void {
  context.save();
  context.strokeStyle = toCssColor(color);
  context.lineWidth = width + 4;
  context.globalAlpha = 0.28;
  context.shadowColor = toCssColor(color);
  context.shadowBlur = glow;
  drawPath();
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = toCssColor(color);
  context.lineWidth = width;
  context.shadowColor = toCssColor(color);
  context.shadowBlur = glow * 0.45;
  drawPath();
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = "#ffffff";
  context.lineWidth = Math.max(1, width * 0.28);
  context.globalAlpha = 0.55;
  drawPath();
  context.stroke();
  context.restore();
}

function drawNeonCircle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: number,
  stroke = 0xffffff,
): void {
  context.save();
  context.shadowColor = toCssColor(fill);
  context.shadowBlur = 9;
  context.fillStyle = toCssColor(fill);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = toCssColor(stroke);
  context.lineWidth = 1.25;
  context.stroke();
  context.fillStyle = "#05050c";
  context.beginPath();
  context.arc(x, y, radius * 0.45, 0, Math.PI * 2);
  context.fill();
  context.restore();
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
    throw new Error("Failed to get 2D rendering context from canvas.");
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

  const primary = color.value;
  const jacketFill = mixColor(primary, 0x050511, 0.78);
  const suitFill = mixColor(primary, 0x050511, 0.9);

  context.save();
  context.shadowColor = toCssColor(deckStroke);
  context.shadowBlur = 13;
  context.fillStyle = "#121225";
  context.strokeStyle = toCssColor(deckStroke);
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(-32, 14);
  context.lineTo(34, 14);
  context.lineTo(26, 24);
  context.lineTo(-28, 24);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  drawNeonStroke(context, accent, 2, () => {
    context.beginPath();
    context.moveTo(-23, 12);
    context.lineTo(23, 12);
  }, 8);

  if (deck === "Gridwave") {
    for (let offset = -18; offset <= 18; offset += 9) {
      drawNeonStroke(context, accent, 0.8, () => {
        context.beginPath();
        context.moveTo(offset - 5, 15);
        context.lineTo(offset + 4, 23);
      }, 4);
    }
  } else if (deck === "ToxiCorp") {
    context.fillStyle = toCssColor(accent);
    context.fillRect(-6, 16, 12, 5);
    context.fillStyle = "#06060f";
    context.fillRect(-2, 16, 4, 5);
  } else if (deck === "Hologram") {
    context.globalAlpha = 0.5;
    context.fillStyle = toCssColor(accent);
    context.fillRect(-25, 17, 50, 2);
    context.globalAlpha = 1;
  } else {
    drawNeonStroke(context, accent, 1.2, () => {
      context.beginPath();
      context.moveTo(-27, 20);
      context.lineTo(27, 17);
    }, 5);
  }

  drawNeonCircle(context, -20, 29, 5.5, leftWheel, deckStroke);
  drawNeonCircle(context, 20, 29, 5.5, rightWheel, deckStroke);

  drawNeonStroke(context, primary, 3.2, () => {
    context.beginPath();
    context.moveTo(-8, 10);
    context.lineTo(-18, 21);
    context.lineTo(-25, 24);
  }, 9);
  drawNeonStroke(context, 0xff007f, 3.2, () => {
    context.beginPath();
    context.moveTo(2, 9);
    context.lineTo(13, 18);
    context.lineTo(24, 18);
  }, 9);

  context.save();
  context.shadowColor = toCssColor(primary);
  context.shadowBlur = 12;
  context.fillStyle = toCssColor(jacketFill);
  context.strokeStyle = toCssColor(primary);
  context.lineWidth = 2.25;
  context.beginPath();
  context.moveTo(-13, -4);
  context.lineTo(10, -10);
  context.lineTo(16, -31);
  context.lineTo(0, -37);
  context.lineTo(-10, -28);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  context.fillStyle = toCssColor(mixColor(primary, 0xffffff, 0.18));
  context.beginPath();
  context.moveTo(1, -31);
  context.lineTo(10, -28);
  context.lineTo(6, -14);
  context.lineTo(-2, -12);
  context.closePath();
  context.fill();

  context.save();
  context.fillStyle = toCssColor(suitFill);
  context.strokeStyle = "#ff007f";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-10, -5);
  context.lineTo(8, -5);
  context.lineTo(5, 12);
  context.lineTo(-6, 12);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();

  drawNeonStroke(context, accent, 2.5, () => {
    context.beginPath();
    context.moveTo(9, -23);
    context.lineTo(24, -15);
    context.lineTo(29, -8);
  }, 7);

  context.save();
  context.shadowColor = toCssColor(primary);
  context.shadowBlur = 11;
  context.fillStyle = toCssColor(primary);
  context.beginPath();
  context.arc(8, -42, 9, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = "#05050d";
  context.beginPath();
  context.ellipse(11, -42, RIDER_VISOR_RADIUS_X, RIDER_VISOR_RADIUS_Y, RIDER_VISOR_ROTATION, 0, Math.PI * 2);
  context.fill();
  drawNeonStroke(context, accent, 1.2, () => {
    context.beginPath();
    context.moveTo(10, -45);
    context.lineTo(17, -45);
  }, 4);

  return canvas;
}

export function renderCyberJoustWeaponSprite(colorName: string, weapon: string): HTMLCanvasElement {
  const color = getCyberJoustColor(colorName);
  const context = createCenteredContext(CYBER_JOUST_WEAPON_CANVAS_SIZE);
  const canvas = context.canvas as HTMLCanvasElement;
  const primary = color.value;
  const hotPink = 0xff007f;
  const yellow = 0xffea00;

  if (weapon === "Hockey Stick") {
    drawNeonStroke(context, primary, 5, () => {
      context.beginPath();
      context.moveTo(-23, -13);
      context.lineTo(16, 4);
      context.lineTo(31, -2);
    }, 11);
    drawNeonStroke(context, hotPink, 2, () => {
      context.beginPath();
      context.moveTo(-1, -4);
      context.lineTo(18, 4);
    }, 6);
    drawNeonCircle(context, 5, -2, 3.2, hotPink, yellow);
    drawNeonCircle(context, 19, 3, 3.2, hotPink, yellow);
    return canvas;
  }

  if (weapon === "Street Sign") {
    drawNeonStroke(context, 0xcfd7df, 4, () => {
      context.beginPath();
      context.moveTo(-25, -5);
      context.lineTo(11, -5);
    }, 5);

    context.save();
    context.shadowColor = "#ff0055";
    context.shadowBlur = 11;
    context.strokeStyle = "#ff0055";
    context.fillStyle = "#9c0037";
    context.lineWidth = 3;
    context.beginPath();
    const signX = 20;
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
    context.restore();

    context.fillStyle = "#ffffff";
    context.fillRect(signX - 8, signY - 2, 16, 4);
    context.fillStyle = toCssColor(primary);
    context.fillRect(signX - 4, signY - 10, 8, 3);
    return canvas;
  }

  drawNeonStroke(context, primary, 3, () => {
    context.beginPath();
    context.moveTo(-23, -5);
    context.lineTo(17, -5);
    context.moveTo(-23, -14);
    context.lineTo(4, -5);
    context.moveTo(-23, 4);
    context.lineTo(4, -5);
  }, 10);

  context.save();
  context.shadowColor = toCssColor(hotPink);
  context.shadowBlur = 8;
  context.fillStyle = toCssColor(hotPink);
  context.beginPath();
  context.moveTo(-26, -17);
  context.lineTo(-14, -13);
  context.lineTo(-14, 3);
  context.lineTo(-26, 7);
  context.closePath();
  context.fill();
  context.restore();

  drawNeonStroke(context, yellow, 2, () => {
    context.beginPath();
    context.moveTo(8, -5);
    context.lineTo(14, -11);
    context.lineTo(21, 0);
    context.lineTo(27, -5);
    context.lineTo(32, -5);
  }, 7);
  drawNeonCircle(context, 32, -5, 3.3, primary, yellow);

  return canvas;
}

export async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode canvas to PNG blob."));
    }, "image/png");
  });
}
