/**
 * skaterFactory.js — builds Streets skater display objects.
 *
 * Shared by the menu preview and the game scene. A skater is a Phaser
 * container holding a board, wheels, and either a composited card sprite
 * (when the Cyber Joust manifest provides one for the cosmetics) or a
 * vector-drawn fallback rider. The same code powers the player and enemies so
 * forged-card cosmetics render identically everywhere.
 */
import {
  buildCyberJoustBodyTextureKey,
  buildCyberJoustWeaponTextureKey,
  CYBER_JOUST_SPRITE_MANIFEST_KEY,
  findCyberJoustBodySprite,
  findCyberJoustWeaponSprite,
  getCyberJoustColor,
} from '../cyber-joust/fighterSprites.js';

export const DEFAULT_COSMETICS = Object.freeze({
  colorName: 'Neon Cyan',
  color: 0x00f0ff,
  deck: 'Speedline',
  weapon: 'Crutch Lance',
});

const CUSTOM_SPRITE_SCALE = 0.18;

const BODY_VARIANTS = Object.freeze({
  striker: Object.freeze({ torso: 1, helmet: 1, board: 1, shoulder: 0, trim: 0xff007f }),
  bruiser: Object.freeze({ torso: 1.2, helmet: 1.12, board: 1.18, shoulder: 8, trim: 0xffea00 }),
  spinner: Object.freeze({ torso: 0.9, helmet: 0.95, board: 0.92, shoulder: -5, trim: 0x9d00ff }),
  vault: Object.freeze({ torso: 1.08, helmet: 0.92, board: 1, shoulder: 5, trim: 0x39ff14 }),
  roller: Object.freeze({ torso: 0.86, helmet: 0.88, board: 1.12, shoulder: -8, trim: 0x00f0ff }),
  shield: Object.freeze({ torso: 1.15, helmet: 1.05, board: 1.05, shoulder: 6, trim: 0xffffff }),
  rival: Object.freeze({ torso: 1.05, helmet: 1.08, board: 1.08, shoulder: 10, trim: 0xff6600 }),
});

/** Resolve a cosmetics object's numeric color, tolerating partial input. */
export function resolveColorValue(cosmetics = {}) {
  const entry = getCyberJoustColor(cosmetics.colorName, cosmetics.color);
  return entry.value;
}

function drawRider(g, primaryColor, cosmetics = {}) {
  const variant = BODY_VARIANTS[cosmetics.bodyVariant] || BODY_VARIANTS.striker;
  const torso = variant.torso;
  const shoulder = variant.shoulder;
  g.clear();
  // Jacket
  g.fillStyle(0x16122c, 1);
  g.lineStyle(2, primaryColor, 1);
  g.beginPath();
  g.moveTo(-10 * torso - shoulder, -5);
  g.lineTo(10 * torso + shoulder, -10);
  g.lineTo(15 * torso + shoulder, -30);
  g.lineTo(-5 * torso - shoulder, -35);
  g.closePath();
  g.fillPath();
  g.strokePath();
  // Torso
  g.fillStyle(0x11111d, 1);
  g.lineStyle(2, variant.trim, 1);
  g.beginPath();
  g.moveTo(-8 * torso, -5);
  g.lineTo(8 * torso, -5);
  g.lineTo(5 * torso, 12);
  g.lineTo(-5 * torso, 12);
  g.closePath();
  g.fillPath();
  g.strokePath();
  // Arms/pose silhouette
  g.lineStyle(3, variant.trim, 0.85);
  g.lineBetween(-8 * torso, -12, -24 - shoulder, 3);
  g.lineBetween(10 * torso, -16, 24 + shoulder, -2);
  // Helmet
  g.fillStyle(primaryColor, 1);
  g.fillCircle(8, -42, 9 * variant.helmet);
  g.fillStyle(0x000000, 1);
  g.fillCircle(10, -42, 6 * variant.helmet);
  g.fillStyle(0xffea00, 1);
  g.fillRect(11, -44, 4, 3);
}

function drawWeapon(wg, weaponType, color) {
  wg.clear();
  wg.lineStyle(3, color, 1);
  wg.fillStyle(0x1a1a2e, 1);
  if (weaponType === 'Hockey Stick') {
    wg.lineStyle(4, color, 1);
    wg.beginPath();
    wg.moveTo(-10, -10);
    wg.lineTo(25, 5);
    wg.lineTo(38, 0);
    wg.strokePath();
    wg.fillStyle(0xff007f, 1);
    wg.fillCircle(8, -2, 3);
  } else if (weaponType === 'Street Sign') {
    wg.lineStyle(4, 0xcccccc, 1);
    wg.lineBetween(-5, -5, 18, -5);
    wg.lineStyle(3, 0xff0055, 1);
    wg.fillStyle(0xb2003b, 1);
    const sides = 8;
    const cx = 26;
    const cy = -5;
    const r = 13;
    wg.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const angle = (i * Math.PI) / (sides / 2);
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) wg.moveTo(px, py);
      else wg.lineTo(px, py);
    }
    wg.closePath();
    wg.fillPath();
    wg.strokePath();
  } else {
    // Crutch Lance (default)
    wg.lineStyle(3, 0x00f0ff, 1);
    wg.lineBetween(-15, -5, 26, -5);
    wg.fillStyle(0xff007f, 1);
    wg.fillRect(-18, -12, 4, 14);
    wg.fillStyle(0x00f0ff, 1);
    wg.fillCircle(28, -5, 4);
  }
}

/**
 * Create a skater container at (x, y) with the given cosmetics.
 * Returns the container with helper fields (weaponContainer, facing, etc.).
 */
export function createSkater(scene, x, y, cosmetics = {}) {
  const merged = { ...DEFAULT_COSMETICS, ...cosmetics };
  merged.color = resolveColorValue(merged);
  const bodyVariant = BODY_VARIANTS[merged.bodyVariant] || BODY_VARIANTS.striker;

  const container = scene.add.container(x, y);
  const visualRoot = scene.add.container(0, 0);

  const board = scene.add.rectangle(0, 18, 54 * bodyVariant.board, 8, 0x222233);
  board.setStrokeStyle(2, merged.color);
  const wheelL = scene.add.circle(-18 * bodyVariant.board, 23, merged.wheelSize || 5, bodyVariant.trim);
  const wheelR = scene.add.circle(18 * bodyVariant.board, 23, merged.wheelSize || 5, bodyVariant.trim);
  const deckAccent = scene.add.rectangle(0, 15, 38 * bodyVariant.board, 2, merged.deckAccentColor || 0xffea00);

  const bodyGraphics = scene.add.graphics();
  const bodySprite = scene.add.image(0, 0, 'spark-dot').setVisible(false);

  const weaponContainer = scene.add.container(8, -8);
  const weaponSprite = scene.add.image(0, 0, 'spark-dot').setVisible(false);
  const weaponGraphics = scene.add.graphics();
  weaponContainer.add([weaponSprite, weaponGraphics]);

  visualRoot.add([bodySprite, board, wheelL, wheelR, deckAccent, bodyGraphics, weaponContainer]);
  container.add(visualRoot);

  container.cosmetics = merged;
  container.facing = 'right';
  container.visualRoot = visualRoot;
  container.weaponContainer = weaponContainer;
  container.bodyGraphics = bodyGraphics;
  container.bodySprite = bodySprite;
  container.weaponGraphics = weaponGraphics;
  container.weaponSprite = weaponSprite;
  container.board = board;
  container.deckAccent = deckAccent;
  container.wheels = [wheelL, wheelR];
  container.jumpOffset = 0;

  applySkaterVisuals(scene, container);
  return container;
}

/** Refresh a skater's textures/vectors after cosmetics change. */
export function applySkaterVisuals(scene, skater) {
  const cosmetics = skater.cosmetics || DEFAULT_COSMETICS;
  const color = cosmetics.color ?? resolveColorValue(cosmetics);
  const weaponType = cosmetics.weapon ?? DEFAULT_COSMETICS.weapon;
  const manifest = scene.registry.get(CYBER_JOUST_SPRITE_MANIFEST_KEY);
  const bodyEntry = findCyberJoustBodySprite(manifest, cosmetics);
  const weaponEntry = findCyberJoustWeaponSprite(manifest, cosmetics);
  const customBodyKey = cosmetics.characterTextureKey && scene.textures.exists(cosmetics.characterTextureKey)
    ? cosmetics.characterTextureKey
    : null;
  const bodyKey = customBodyKey || (bodyEntry ? buildCyberJoustBodyTextureKey(bodyEntry.slug) : null);
  const weaponKey = weaponEntry ? buildCyberJoustWeaponTextureKey(weaponEntry.slug) : null;
  const hasBody = bodyKey && scene.textures.exists(bodyKey);
  const hasWeapon = weaponKey && scene.textures.exists(weaponKey);

  skater.bodySprite.setVisible(Boolean(hasBody));
  if (hasBody) {
    skater.bodySprite.setTexture(bodyKey).setScale(customBodyKey ? CUSTOM_SPRITE_SCALE : (cosmetics.spriteScale || 1));
    skater.bodyGraphics.setVisible(false);
  } else {
    skater.bodyGraphics.setVisible(true);
    drawRider(skater.bodyGraphics, color, cosmetics);
  }

  skater.weaponSprite.setVisible(Boolean(hasWeapon));
  if (hasWeapon) {
    skater.weaponSprite.setTexture(weaponKey).setScale(1);
    skater.weaponGraphics.setVisible(false);
  } else {
    skater.weaponGraphics.setVisible(true);
    drawWeapon(skater.weaponGraphics, weaponType, color);
  }

  // District-flavored board accents when no sprite is available.
  if (!hasBody) {
    skater.board.setStrokeStyle(2, color);
  }
}

/** Apply a faux-jump lift to visuals while the physics body stays in its lane. */
export function setSkaterJumpOffset(skater, offset = 0) {
  skater.jumpOffset = offset;
  if (skater.visualRoot) {
    skater.visualRoot.y = -offset;
  }
}

/** Flip a skater to face a direction without mirroring its physics body. */
export function faceSkater(skater, direction) {
  if (skater.facing === direction) return;
  skater.facing = direction;
  skater.setScale(direction === 'left' ? -1 : 1, 1);
}
