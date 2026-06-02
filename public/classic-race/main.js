/**
 * main.js — Punch Skater™ Classic Race bootstrap.
 *
 * Top-down arcade racer inspired by Super Off Road. Camera follows the player,
 * up to 5 AI opponents, nitro boost with cooldown, drift physics.
 */
import Phaser from './phaserRuntime.js';
import { RaceGameScene } from './gameScene.js';
import { parseRaceConfig } from './raceConfig.js';
import {
  assignRacerSprites,
  buildRacerSheetTextureKey,
  loadRacerSpriteManifest,
} from './racerSprites.js';

// ---------------------------------------------------------------------------
// Boot Scene — loading screen
// ---------------------------------------------------------------------------
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillStyle(0x070714, 1);
    bg.fillRect(0, 0, width, height);

    const loadText = this.add.text(width / 2, height / 2, 'LOADING...', {
      fontSize: '16px',
      fontFamily: 'Press Start 2P, monospace',
      color: '#00f0ff',
    }).setOrigin(0.5);
  }

  create() {
    const config = parseRaceConfig();

    // Show track info briefly
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x070714);

    this.add.text(width / 2, height / 2 - 40, config.track.name, {
      fontSize: '20px',
      fontFamily: 'Press Start 2P, monospace',
      color: '#ff007f',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, config.track.terrain, {
      fontSize: '11px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 30, `${config.track.laps} Laps • ${config.opponents + 1} Racers`, {
      fontSize: '12px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#00f0ff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 70, 'WASD / Arrows to steer • SHIFT for Nitro • Draft + grab ⚡ cells', {
      fontSize: '9px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#888888',
    }).setOrigin(0.5);

    // Load pre-baked racer sprite sheets (if any) while the splash shows, then
    // hand the loaded assignments to the race scene. Never block on failure.
    this.loadRacerSpritesThenStart(config);
  }

  async loadRacerSpritesThenStart(config) {
    const racerCount = config.opponents + 1;
    let spriteGrid = null;
    let spriteAssignments = new Array(racerCount).fill(null);

    try {
      const { grid, racers } = await loadRacerSpriteManifest();
      const assignments = assignRacerSprites(racers, racerCount);
      const sheetsToLoad = new Map();
      for (const entry of assignments) {
        if (entry) sheetsToLoad.set(entry.slug, entry);
      }

      if (sheetsToLoad.size > 0) {
        for (const entry of sheetsToLoad.values()) {
          this.load.spritesheet(buildRacerSheetTextureKey(entry.slug), entry.url, {
            frameWidth: grid.frameWidth,
            frameHeight: grid.frameHeight,
          });
        }
        await new Promise((resolve) => {
          this.load.once('complete', resolve);
          this.load.start();
        });
      }

      spriteGrid = grid;
      // Only keep assignments whose texture actually loaded.
      spriteAssignments = assignments.map((entry) =>
        entry && this.textures.exists(buildRacerSheetTextureKey(entry.slug)) ? entry : null,
      );
    } catch {
      spriteGrid = null;
      spriteAssignments = new Array(racerCount).fill(null);
    }

    // Brief pause so the track splash is readable, then start the race.
    this.time.delayedCall(1500, () => {
      this.scene.start('RaceGameScene', { raceConfig: config, spriteGrid, spriteAssignments });
    });
  }
}

// ---------------------------------------------------------------------------
// Phaser config
// ---------------------------------------------------------------------------
const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  backgroundColor: '#070714',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, RaceGameScene],
  input: {
    keyboard: true,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

// Boot
const game = new Phaser.Game(phaserConfig);

// Handle window close to report results
window.addEventListener('beforeunload', () => {
  // Cleanup if needed
});
