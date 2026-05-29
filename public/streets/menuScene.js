/**
 * menuScene.js — Punch Skater™ Streets menu / mission-intro scene.
 *
 * Two entry paths:
 *   1. Launched from the Missions Map (URL carries a mission + run context):
 *      show a single mission-briefing card and a DEPLOY button.
 *   2. Opened directly from the Arena: show a pick-list of the seeded lore
 *      missions for free play.
 */
import * as Phaser from 'phaser';
import {
  parseStreetsConfig,
  STREETS_MISSIONS,
  STREETS_MISSION_ORDER,
  STREETS_OBJECTIVES,
  STREETS_DISTRICTS,
} from './streetsConfig.js';

export class StreetsMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetsMenuScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.config = parseStreetsConfig();

    this.add.rectangle(width / 2, height / 2, width, height, 0x05030f, 1);
    this.add.text(width / 2, height * 0.1, 'STREETS', {
      fontFamily: '"Press Start 2P"',
      fontSize: 'min(40px, 7vw)',
      color: '#ff007f',
      stroke: '#00f0ff',
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.16, 'SIDE-SCROLLING BEAT-EM-UP', {
      fontFamily: '"Press Start 2P"',
      fontSize: 'min(13px, 2.4vw)',
      color: '#ffea00',
    }).setOrigin(0.5);

    this.setupMusic();

    if (this.config.mission && this.config.launchedFromMission) {
      this.renderMissionBriefing();
    } else {
      this.renderMissionPicker();
    }
  }

  setupMusic() {
    if (!this.sound.get('street-music')) {
      try { this.sound.add('street-music', { loop: true, volume: 0.3 }); } catch { /* ignore */ }
    }
    this.input.once('pointerdown', () => {
      const music = this.sound.get('street-music');
      if (music && !music.isPlaying) {
        try { music.play(); } catch { /* ignore */ }
      }
    });
  }

  renderMissionBriefing() {
    const { width, height } = this.scale;
    const mission = this.config.mission;
    const district = STREETS_DISTRICTS[mission.district];
    const objective = STREETS_OBJECTIVES[this.config.objectiveId];

    const panel = this.add.rectangle(width / 2, height * 0.52, Math.min(640, width * 0.9), height * 0.5, 0x0a0a1a, 0.9);
    panel.setStrokeStyle(3, district.groundEdge);

    this.add.text(width / 2, height * 0.32, mission.name.toUpperCase(), {
      fontFamily: '"Press Start 2P"',
      fontSize: 'min(18px, 3.4vw)',
      color: '#00f0ff',
      align: 'center',
      wordWrap: { width: Math.min(600, width * 0.84) },
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.4, `${district.name.toUpperCase()}  •  ${objective.label.toUpperCase()}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ffea00',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.52, mission.hook, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 'min(15px, 3vw)',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: Math.min(560, width * 0.8) },
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.63, `"${district.motto}"`, {
      fontFamily: 'Orbitron, sans-serif',
      fontStyle: 'italic',
      fontSize: 'min(12px, 2.6vw)',
      color: district.haze ? `#${district.haze.toString(16).padStart(6, '0')}` : '#ff8af8',
      align: 'center',
      wordWrap: { width: Math.min(520, width * 0.78) },
    }).setOrigin(0.5);

    this.makeButton(width / 2, height * 0.78, 'DEPLOY', 0xff0055, () => {
      this.launch(mission.id);
    });
  }

  renderMissionPicker() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height * 0.24, 'CHOOSE A RUN', {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#7de7ff',
    }).setOrigin(0.5);

    const startY = height * 0.32;
    const spacing = Math.min(64, height * 0.1);
    STREETS_MISSION_ORDER.forEach((missionId, idx) => {
      const mission = STREETS_MISSIONS[missionId];
      const district = STREETS_DISTRICTS[mission.district];
      const objective = STREETS_OBJECTIVES[mission.objective];
      const y = startY + idx * spacing;

      const btn = this.add.rectangle(width / 2, y, Math.min(560, width * 0.86), spacing - 12, 0x0a0a1a, 0.85);
      btn.setStrokeStyle(2, district.groundEdge);
      btn.setInteractive({ cursor: 'pointer' });

      this.add.text(width / 2 - Math.min(260, width * 0.4), y - 8, mission.name.toUpperCase(), {
        fontFamily: '"Press Start 2P"',
        fontSize: 'min(11px, 2.2vw)',
        color: '#ffffff',
      }).setOrigin(0, 0.5);
      this.add.text(width / 2 - Math.min(260, width * 0.4), y + 10, `${district.name} • ${objective.label}`, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 'min(11px, 2.2vw)',
        color: '#ffea00',
      }).setOrigin(0, 0.5);

      btn.on('pointerover', () => btn.setFillStyle(0x161636, 0.95));
      btn.on('pointerout', () => btn.setFillStyle(0x0a0a1a, 0.85));
      btn.on('pointerdown', () => this.launch(missionId));
    });
  }

  makeButton(x, y, label, color, onClick) {
    const { width } = this.scale;
    const btn = this.add.rectangle(x, y, Math.min(280, width * 0.6), 56, color);
    btn.setStrokeStyle(3, 0xffffff);
    this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P"',
      fontSize: 'min(16px, 3vw)',
      color: '#ffffff',
    }).setOrigin(0.5);
    btn.setInteractive({ cursor: 'pointer' });
    btn.on('pointerdown', onClick);
    return btn;
  }

  launch(missionId) {
    const music = this.sound.get('street-music');
    if (music) music.stop();
    this.scene.start('StreetsGameScene', {
      config: this.config,
      missionId,
    });
  }
}

export default StreetsMenuScene;
