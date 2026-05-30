/**
 * main.js — Punch Skater™ Streets bootstrap.
 *
 * Streets is a side-scrolling beat-em-up that extends the Missions Map. It
 * reuses the Cyber Joust sprite pipeline (card cosmetics → pixel body/weapon
 * textures) and audio so forged cards carry straight into this mode. The boot
 * scene loads shared assets, then hands off to the menu / game scenes.
 */
import * as Phaser from 'phaser';
import { StreetsMenuScene } from './menuScene.js';
import { StreetsGameScene } from './gameScene.js';
import {
  STREETS_DYNAMIC_TEXTURES,
  parseStreetsConfig,
} from './streetsConfig.js';
import {
  buildCyberJoustBodyTextureKey,
  buildCyberJoustWeaponTextureKey,
  CYBER_JOUST_SPRITE_MANIFEST_KEY,
  loadCyberJoustSpriteManifest,
  resolveCyberJoustSpriteUrl,
} from '../cyber-joust/fighterSprites.js';

// Shared assets live in the Cyber Joust folder so we don't duplicate binaries.
const ASSET_BASE = '../cyber-joust/assets';

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.scale;

    const loadingBox = this.add.graphics();
    const progressBar = this.add.graphics();

    loadingBox.fillStyle(0x070714, 0.8);
    loadingBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    loadingBox.lineStyle(2, 0xff007f);
    loadingBox.strokeRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 60, 'BOOTING STREETS...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color: '#00f0ff',
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2 + 60, '0%', {
      fontFamily: '"Press Start 2P"',
      fontSize: '11px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const onProgress = (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xffea00, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
      percentText.setText(`${Math.round(value * 100)}%`);
    };
    this.load.on('progress', onProgress);

    this.load.once('complete', () => {
      this.load.off('progress', onProgress);
      loadingBox.destroy();
      progressBar.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    this.load.audio('street-music', `${ASSET_BASE}/audio/cyber-synthwave-theme.mp3`);
    this.load.audio('sfx-hit', `${ASSET_BASE}/audio/sfx-clash.mp3`);
    this.load.audio('sfx-boost', `${ASSET_BASE}/audio/sfx-boost.mp3`);
    this.load.audio('sfx-zap', `${ASSET_BASE}/audio/sfx-zap.mp3`);

    const launchConfig = parseStreetsConfig();
    if (launchConfig.levelBackdropUrl) {
      this.load.image(STREETS_DYNAMIC_TEXTURES.backdrop, launchConfig.levelBackdropUrl);
    }
    if (launchConfig.player?.cosmetics?.characterImageUrl) {
      this.load.image(STREETS_DYNAMIC_TEXTURES.playerSprite, launchConfig.player.cosmetics.characterImageUrl);
    }
  }

  async create() {
    // A soft glow dot reused for sparks, package markers, and thruster trails.
    const sparkCanvas = this.textures.createCanvas('spark-dot', 16, 16);
    const ctx = sparkCanvas.getContext();
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 234, 0, 1)');
    grad.addColorStop(1, 'rgba(255, 0, 127, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    sparkCanvas.refresh();

    const manifest = await loadCyberJoustSpriteManifest();
    this.registry.set(CYBER_JOUST_SPRITE_MANIFEST_KEY, manifest);

    const queuedLoads = [];
    manifest.bodies.forEach((entry) => {
      const sourceUrl = resolveCyberJoustSpriteUrl(entry);
      if (!sourceUrl) return;
      const textureKey = buildCyberJoustBodyTextureKey(entry.slug);
      if (this.textures.exists(textureKey)) return;
      queuedLoads.push(textureKey);
      this.load.image(textureKey, sourceUrl);
    });
    manifest.weapons.forEach((entry) => {
      const sourceUrl = resolveCyberJoustSpriteUrl(entry);
      if (!sourceUrl) return;
      const textureKey = buildCyberJoustWeaponTextureKey(entry.slug);
      if (this.textures.exists(textureKey)) return;
      queuedLoads.push(textureKey);
      this.load.image(textureKey, sourceUrl);
    });

    if (queuedLoads.length > 0) {
      const onLoadError = (file) => {
        console.warn('Streets sprite load failed:', file?.src || file?.key || 'unknown');
      };
      this.load.on('loaderror', onLoadError);
      this.load.once('complete', () => {
        this.load.off('loaderror', onLoadError);
        this.scene.start('StreetsMenuScene');
      });
      this.load.start();
      return;
    }

    this.scene.start('StreetsMenuScene');
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, StreetsMenuScene, StreetsGameScene],
};

const game = new Phaser.Game(config);
export default game;
