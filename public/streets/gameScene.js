/**
 * gameScene.js — Punch Skater™ Streets side-scrolling beat-em-up.
 *
 * Arcade-era brawler loop: skate right, hit "wave gates" that lock the camera
 * until the wave is cleared, then advance. Three objective flavors:
 *   - fight_through : clear every wave, reach the exit grind-rail.
 *   - retrieve      : clear waves, grab the package, extract at the exit.
 *   - escape        : outrun a continuous horde to the exit.
 *
 * Forged-card stats (passed via URL → streetsConfig) drive the player's HP,
 * speed, attack reach/damage, damage resistance, and special meter. On
 * win/lose the scene reports the result back to the Missions Map.
 */
import * as Phaser from 'phaser';
import {
  STREETS_MISSIONS,
  STREETS_DISTRICTS,
  STREETS_OBJECTIVES,
  mapStatsToFighter,
} from './streetsConfig.js';
import {
  createSkater,
  faceSkater,
} from './skaterFactory.js';

const GRAVITY_Y = 1000;
const LEVEL_PADDING = 700;
const GATE_SPACING = 720;
const ATTACK_DURATION_MS = 230;
const ATTACK_COOLDOWN_MS = 360;
const ATTACK_VERTICAL_BAND = 90;
const DASH_DURATION_MS = 150;
const DASH_COOLDOWN_MS = 760;
const DASH_TRAIL_INTERVAL_MS = 38;
const ENEMY_BASE_HP = 46;
const ENEMY_BASE_DAMAGE = 8;
const ENEMY_ATTACK_COOLDOWN_MS = 950;
const ENEMY_ATTACK_RANGE = 64;
const ENEMY_LEASH_DISTANCE = 520;
const HORDE_CAP = 7;
const HAZARD_DAMAGE = 9;
const HAZARD_COOLDOWN_MS = 900;
const PICKUP_HEAL_AMOUNT = 22;
const BOOST_PAD_POWER = 520;
const WAVE_BONUS_THRESHOLD = 0.62;
const MIN_SIGN_DENSITY = 0.65;
const SIGN_DENSITY_RANGE = 0.55;
const MIN_PROP_DENSITY = 0.7;
const PROP_DENSITY_RANGE = 0.75;
const BUILDING_HEIGHT_MULTIPLIER = 37;
const BUILDING_HEIGHT_VARIANCE = 180;
const BUILDING_WIDTH_MULTIPLIER = 17;
const BUILDING_WIDTH_VARIANCE = 60;
const WINDOW_DENSITY_FACTOR = 3;
const RAIL_BASE_OFFSET = 18;
const RAIL_VERTICAL_VARIANCE = 28;
const TALL_SIGN_THRESHOLD = 0.45;

function hashString(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    let t = state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bodyIsGrounded(body) {
  return Boolean(body?.blocked?.down || body?.touching?.down);
}

export class StreetsGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetsGameScene' });
  }

  init(data) {
    this.config = data?.config ?? {};
    this.missionId = data?.missionId ?? this.config.missionId ?? null;
    this.mission = (this.missionId && STREETS_MISSIONS[this.missionId]) || null;
    this.objectiveId = this.config.objectiveId
      || this.mission?.objective
      || STREETS_OBJECTIVES.fight_through.id;
    this.districtId = this.config.districtId || this.mission?.district || 'nightshade';
    this.levelSeed = String(this.config.levelSeed || this.missionId || this.districtId || 'streets');
    this.rng = mulberry32(hashString(this.levelSeed));
    this.levelProfile = null;

    this.enemies = [];
    this.gates = [];
    this.activeGate = null;
    this.isOver = false;
    this.score = 0;
    this.special = 0;
    this.specialMax = 100;
    this.carryingPackage = false;
    this.packageAvailable = false;
    this.objectiveComplete = false;
    this.hazards = null;
    this.boostPads = null;
    this.pickups = null;
    this.barrier = null;
    this.hordeTimer = null;
    this.steer = { left: false, right: false, jump: false, dash: false };
  }

  create() {
    const { height } = this.scale;
    this.district = STREETS_DISTRICTS[this.districtId] || STREETS_DISTRICTS.nightshade;
    this.groundY = height - 90;
    this.levelProfile = this.createLevelProfile();
    this.levelWidth = this.computeLevelWidth();

    this.physics.world.setBounds(0, 0, this.levelWidth, height);
    this.cameras.main.setBounds(0, 0, this.levelWidth, height);

    this.buildBackdrop();
    this.buildGround();
    this.buildSetDressing();
    this.buildLevelInteractions();
    this.buildParticles();

    // Player fighter — stats from the launching card (or sane defaults).
    this.playerKnobs = mapStatsToFighter(this.config.player?.stats, this.config.player?.joust);
    const cosmetics = this.config.player?.cosmetics || {};
    this.player = createSkater(this, 150, this.groundY - 60, cosmetics);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setGravityY(GRAVITY_Y);
    this.player.body.setSize(50, 72);
    this.player.body.setOffset(-25, -48);
    this.player.body.setDragX(900);
    this.player.body.setMaxVelocity(this.playerKnobs.moveSpeed, 1400);
    this.player.hp = this.playerKnobs.maxHp;
    this.player.maxHp = this.playerKnobs.maxHp;
    this.player.attackReadyAt = 0;
    this.player.dashReadyAt = 0;
    this.player.dashUntil = 0;
    this.player.nextDashTrailAt = 0;
    this.player.isAttacking = false;
    this.player.isDazed = false;
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.overlap(this.player, this.hazards, (_, hazard) => this.handleHazardHit(hazard));
    this.physics.add.overlap(this.player, this.boostPads, (_, pad) => this.handleBoostPad(pad));
    this.physics.add.overlap(this.player, this.pickups, (_, pickup) => this.handlePickup(pickup));

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(180, 200);

    this.setupControls();
    this.buildObjective();
    this.createHud();
    this.showBanner(this.mission ? this.mission.name : 'FREE RUN', this.district.motto);
  }

  computeLevelWidth() {
    const waves = this.getWaveCounts();
    if (this.objectiveId === STREETS_OBJECTIVES.escape.id) {
      return Math.max(3200 + this.levelProfile.lengthBonus, this.scale.width * 4);
    }
    return LEVEL_PADDING + waves.length * GATE_SPACING + LEVEL_PADDING + this.levelProfile.lengthBonus;
  }

  createLevelProfile() {
    const variants = ['underpass', 'market', 'rooftop', 'station'];
    const variant = variants[Math.floor(this.rng() * variants.length)];
    return {
      variant,
      lengthBonus: Math.floor(this.rng() * 3) * 160,
      waveBonus: this.rng() > WAVE_BONUS_THRESHOLD ? 1 : 0,
      signDensity: MIN_SIGN_DENSITY + this.rng() * SIGN_DENSITY_RANGE,
      propDensity: MIN_PROP_DENSITY + this.rng() * PROP_DENSITY_RANGE,
      railHue: this.rng() > 0.5 ? this.district.groundEdge : this.district.accent,
      hazardEvery: 780 + Math.floor(this.rng() * 240),
      boostEvery: 920 + Math.floor(this.rng() * 280),
      pickupEvery: 1350 + Math.floor(this.rng() * 320),
    };
  }

  getWaveCounts() {
    const base = this.mission?.waves ?? [3, 4];
    return base.map((count, idx) => {
      const isLastWave = idx === base.length - 1;
      return count + (isLastWave ? this.levelProfile.waveBonus : 0);
    });
  }

  buildBackdrop() {
    const { width, height } = this.scale;
    // Sky gradient drawn to a fixed (scroll-locked) graphic.
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-30);
    sky.fillGradientStyle(this.district.skyTop, this.district.skyTop, this.district.skyBottom, this.district.skyBottom, 1);
    sky.fillRect(0, 0, width, height);

    if (this.config.levelBackdropTextureKey && this.textures.exists(this.config.levelBackdropTextureKey)) {
      this.add.image(width / 2, height / 2, this.config.levelBackdropTextureKey)
        .setDisplaySize(width, height)
        .setScrollFactor(0)
        .setDepth(-29)
        .setAlpha(0.42);
    }

    // Parallax neon skyline silhouettes across the level.
    const mid = this.add.graphics().setDepth(-20).setScrollFactor(0.4);
    const seedHash = hashString(this.levelSeed);
    mid.fillStyle(this.district.ground, 1);
    for (let x = 0; x < this.levelWidth; x += 140) {
      const h = 90 + ((x * BUILDING_HEIGHT_MULTIPLIER + seedHash) % BUILDING_HEIGHT_VARIANCE);
      const w = 70 + ((x * BUILDING_WIDTH_MULTIPLIER) % BUILDING_WIDTH_VARIANCE);
      mid.fillRect(x, this.groundY - h, w, h);
      mid.lineStyle(2, this.district.accent, 0.5);
      mid.strokeRect(x, this.groundY - h, w, h);
      for (let wy = this.groundY - h + 18; wy < this.groundY - 20; wy += 30) {
        if (((x + wy) % WINDOW_DENSITY_FACTOR) === 0) {
          mid.fillStyle(this.district.haze, 0.55);
          mid.fillRect(x + 12, wy, 10, 4);
          mid.fillStyle(this.district.ground, 1);
        }
      }
    }

    // Far haze band for depth.
    const haze = this.add.graphics().setDepth(-25).setScrollFactor(0.15);
    haze.fillStyle(this.district.haze, 0.06);
    haze.fillRect(0, this.groundY - 260, this.levelWidth, 260);

    const far = this.add.graphics().setDepth(-26).setScrollFactor(0.08);
    const variantHash = hashString(this.levelProfile.variant);
    far.lineStyle(1, this.district.haze, 0.22);
    for (let x = 0; x < this.levelWidth; x += 95) {
      const y = 60 + ((x * 19 + variantHash) % 160);
      far.lineBetween(x, y, x + 36, y + 8);
      far.fillStyle(this.district.haze, 0.25);
      far.fillCircle(x + 42, y + 10, 2);
    }

    const moon = this.add.graphics().setDepth(-27).setScrollFactor(0.04);
    moon.fillStyle(this.district.haze, 0.18);
    moon.fillCircle(width * 0.76, 80, 44);
    moon.lineStyle(2, this.district.accent, 0.18);
    moon.strokeCircle(width * 0.76, 80, 62);

    const murals = this.add.graphics().setDepth(-6).setScrollFactor(0.72);
    for (let x = 240; x < this.levelWidth; x += 520) {
      const y = this.groundY - 150 - Math.floor(this.rng() * 54);
      murals.fillStyle(0x050510, 0.55);
      murals.fillRoundedRect(x - 82, y - 28, 164, 56, 8);
      murals.lineStyle(2, this.district.accent, 0.55);
      murals.strokeRoundedRect(x - 82, y - 28, 164, 56, 8);
      murals.fillStyle(this.district.groundEdge, 0.3);
      murals.fillCircle(x - 44, y, 17);
      murals.fillStyle(this.district.haze, 0.28);
      murals.fillTriangle(x + 8, y + 20, x + 44, y - 18, x + 72, y + 20);
    }
  }

  buildGround() {
    const { height } = this.scale;
    this.ground = this.physics.add.staticGroup();
    const thickness = height - this.groundY;
    const strip = this.add.rectangle(
      this.levelWidth / 2,
      this.groundY + thickness / 2,
      this.levelWidth,
      thickness,
      this.district.ground,
    );
    strip.setStrokeStyle(3, this.district.groundEdge);
    this.physics.add.existing(strip, true);
    this.ground.add(strip);

    // Neon lane line along the top of the ground.
    const lane = this.add.graphics().setDepth(-5);
    lane.lineStyle(2, this.district.groundEdge, 0.6);
    lane.lineBetween(0, this.groundY, this.levelWidth, this.groundY);
    lane.lineStyle(1, this.district.haze, 0.28);
    for (let x = 0; x < this.levelWidth; x += 92) {
      lane.lineBetween(x, this.groundY + 18, x + 42, this.groundY + 18);
    }
  }

  buildSetDressing() {
    const props = this.add.graphics().setDepth(-3);
    const rail = this.add.graphics().setDepth(-2);
    rail.lineStyle(4, this.levelProfile.railHue, 0.7);
    for (let x = 260; x < this.levelWidth - 260; x += Math.round(360 / this.levelProfile.propDensity)) {
      const y = this.groundY - RAIL_BASE_OFFSET - Math.floor(this.rng() * RAIL_VERTICAL_VARIANCE);
      rail.lineBetween(x, y, x + 160, y - 8);
      rail.lineStyle(1, 0xffffff, 0.35);
      rail.lineBetween(x, y + 9, x + 160, y + 1);
      rail.lineStyle(4, this.levelProfile.railHue, 0.7);
    }

    for (let x = 120; x < this.levelWidth - 120; x += Math.round(180 / this.levelProfile.signDensity)) {
      const tall = this.rng() > TALL_SIGN_THRESHOLD;
      const signY = this.groundY - (tall ? 128 : 74);
      props.lineStyle(2, this.district.groundEdge, 0.65);
      props.lineBetween(x, this.groundY, x, signY);
      props.fillStyle(this.rng() > 0.5 ? this.district.accent : this.district.groundEdge, 0.78);
      props.fillRoundedRect(x - 30, signY - 16, 60, 24, 5);
      props.lineStyle(1, 0xffffff, 0.45);
      props.strokeRoundedRect(x - 30, signY - 16, 60, 24, 5);
      props.lineStyle(1, this.district.haze, 0.2);
      props.lineBetween(x - 24, signY + 14, x - 46, signY + 42);
      props.lineBetween(x + 24, signY + 14, x + 48, signY + 42);
    }

    const foreground = this.add.graphics().setScrollFactor(1.18).setDepth(20);
    foreground.lineStyle(3, this.district.haze, 0.16);
    for (let x = -80; x < this.levelWidth; x += 210) {
      foreground.lineBetween(x, this.groundY + 42, x + 130, this.groundY + 34);
      foreground.fillStyle(0x050510, 0.42);
      foreground.fillRect(x + 35, this.groundY + 38, 18, 50);
    }
  }

  buildLevelInteractions() {
    this.hazards = this.physics.add.staticGroup();
    this.boostPads = this.physics.add.staticGroup();
    this.pickups = this.physics.add.staticGroup();

    const hazardArt = this.add.graphics().setDepth(-1);
    for (let x = 520; x < this.levelWidth - 460; x += this.levelProfile.hazardEvery) {
      if (Math.abs((this.exitX ?? this.levelWidth) - x) < 220) continue;
      const hazard = this.add.rectangle(x, this.groundY - 10, 76, 16, this.district.accent, 0.12);
      hazard.setStrokeStyle(2, this.district.groundEdge, 0.75);
      hazard.setData('lastHitAt', -Infinity);
      this.physics.add.existing(hazard, true);
      this.hazards.add(hazard);

      hazardArt.lineStyle(2, this.district.groundEdge, 0.75);
      hazardArt.lineBetween(x - 38, this.groundY - 22, x + 38, this.groundY - 22);
      hazardArt.fillStyle(this.district.haze, 0.18);
      hazardArt.fillTriangle(x - 32, this.groundY - 22, x - 18, this.groundY - 44, x - 4, this.groundY - 22);
      hazardArt.fillTriangle(x + 6, this.groundY - 22, x + 20, this.groundY - 44, x + 34, this.groundY - 22);
    }

    for (let x = 780; x < this.levelWidth - 420; x += this.levelProfile.boostEvery) {
      const pad = this.add.rectangle(x, this.groundY - 8, 92, 14, 0xffea00, 0.18);
      pad.setStrokeStyle(2, 0xffea00, 0.8);
      pad.setData('lastBoostAt', -Infinity);
      this.physics.add.existing(pad, true);
      this.boostPads.add(pad);
      this.add.text(x, this.groundY - 30, 'BOOST', {
        fontFamily: '"Press Start 2P"',
        fontSize: '7px',
        color: '#ffea00',
      }).setOrigin(0.5).setDepth(-1);
    }

    for (let x = 980; x < this.levelWidth - 560; x += this.levelProfile.pickupEvery) {
      const pickup = this.add.container(x, this.groundY - 54);
      const glow = this.add.image(0, 0, 'spark-dot').setScale(1.7).setAlpha(0.48);
      const core = this.add.circle(0, 0, 10, 0x39ff14, 0.85);
      const bolt = this.add.text(0, 0, '+', { fontSize: '18px', color: '#050510' }).setOrigin(0.5);
      pickup.add([glow, core, bolt]);
      this.physics.add.existing(pickup, true);
      pickup.body.setCircle(16, -16, -16);
      this.pickups.add(pickup);
      this.tweens.add({ targets: pickup, y: pickup.y - 10, yoyo: true, repeat: -1, duration: 720 });
    }
  }

  buildParticles() {
    this.sparks = this.add.particles(0, 0, 'spark-dot', {
      speed: { min: 100, max: 300 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      blendMode: 'ADD',
      emitting: false,
    });
  }

  // ── Objective setup ──────────────────────────────────────────────────────

  buildObjective() {
    if (this.objectiveId === STREETS_OBJECTIVES.escape.id) {
      this.buildEscapeObjective();
    } else {
      this.buildWaveGates();
    }
    this.buildExit();
  }

  buildWaveGates() {
    const waves = this.getWaveCounts();
    waves.forEach((count, idx) => {
      const isLast = idx === waves.length - 1;
      this.gates.push({
        x: LEVEL_PADDING + idx * GATE_SPACING,
        count,
        spawned: false,
        cleared: false,
        withBoss: isLast && Boolean(this.mission?.boss),
      });
    });
    this.remainingGates = this.gates.length;
  }

  buildEscapeObjective() {
    // No gates — a relentless horde spawns behind the player. Reaching the
    // exit is the win condition; surviving is the challenge.
    this.remainingGates = 0;
    const interval = this.mission?.hordeSpawnMs ?? 2800;
    this.hordeTimer = this.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => this.spawnHordeChaser(),
    });
    // Seed a couple of chasers immediately.
    this.spawnHordeChaser();
    this.time.delayedCall(900, () => this.spawnHordeChaser());
  }

  buildExit() {
    this.exitX = this.levelWidth - 120;
    const flag = this.add.graphics().setDepth(-4);
    flag.lineStyle(4, this.district.groundEdge, 1);
    flag.lineBetween(this.exitX, this.groundY, this.exitX, this.groundY - 150);
    flag.fillStyle(this.district.accent, 0.85);
    flag.fillTriangle(this.exitX, this.groundY - 150, this.exitX + 60, this.groundY - 130, this.exitX, this.groundY - 110);
    this.add.text(this.exitX, this.groundY - 170, 'EXIT', {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(-4);
  }

  spawnPackage(x) {
    if (this.packageMarker) return;
    this.packageAvailable = true;
    const px = Phaser.Math.Clamp(x, 200, this.levelWidth - 200);
    this.packageMarker = this.add.container(px, this.groundY - 30);
    const crate = this.add.rectangle(0, 0, 34, 30, 0x2a1d0a);
    crate.setStrokeStyle(3, 0x39ff14);
    const cross = this.add.text(0, 0, '✚', { fontSize: '18px', color: '#39ff14' }).setOrigin(0.5);
    const glow = this.add.image(0, 0, 'spark-dot').setScale(2.4).setAlpha(0.5);
    this.packageMarker.add([glow, crate, cross]);
    this.tweens.add({ targets: this.packageMarker, y: this.groundY - 44, yoyo: true, repeat: -1, duration: 700 });
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      attackAlt: Phaser.Input.Keyboard.KeyCodes.F,
      special: Phaser.Input.Keyboard.KeyCodes.K,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      dashAlt: Phaser.Input.Keyboard.KeyCodes.L,
    });
    this.createMobileControls();
  }

  createMobileControls() {
    const { width, height } = this.scale;
    const btnY = height - 70;
    const mk = (x, y, label, color, onDown, onUp) => {
      const c = this.add.circle(x, y, 38, 0x111122, 0.7).setScrollFactor(0).setDepth(100);
      c.setStrokeStyle(3, color);
      const t = this.add.text(x, y, label, { fontSize: '16px', color: '#ffffff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(101);
      c.setInteractive(new Phaser.Geom.Circle(0, 0, 38), Phaser.Geom.Circle.Contains);
      c.on('pointerdown', () => { c.setAlpha(1); onDown(); });
      c.on('pointerup', () => { c.setAlpha(0.7); if (onUp) onUp(); });
      c.on('pointerout', () => { c.setAlpha(0.7); if (onUp) onUp(); });
      return { c, t };
    };

    mk(56, btnY, '◀', 0x00f0ff, () => { this.steer.left = true; }, () => { this.steer.left = false; });
    mk(146, btnY, '▶', 0x00f0ff, () => { this.steer.right = true; }, () => { this.steer.right = false; });
    mk(width - 236, btnY, '⤒', 0xffea00, () => { this.steer.jump = true; }, () => { this.steer.jump = false; });
    mk(width - 146, btnY, '⇥', 0x39ff14, () => { this.steer.dash = true; }, () => { this.steer.dash = false; });
    mk(width - 56, btnY, '✊', 0xff007f, () => this.tryAttack());
    mk(width - 56, btnY - 92, '✦', 0x9d00ff, () => this.trySpecial());

    this.add.text(this.scale.width / 2, 70, 'ARROWS/A-D move • W/SPACE jump • SHIFT/L dash • J/F hit • K nova', {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.6).setScrollFactor(0).setDepth(99);
  }

  // ── Main loop ──────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.isOver) return;
    this.handlePlayerInput(time);
    this.handleGates();
    this.updateEnemies(time, delta);
    this.handlePackagePickup();
    this.checkObjective();
    this.updateHud();
  }

  handlePlayerInput(time) {
    const body = this.player.body;
    if (this.player.isDazed) {
      this.player.setAlpha(0.5);
      return;
    }
    this.player.setAlpha(1);

    if (this.player.dashUntil > time) {
      body.setAccelerationX(0);
      if (time >= this.player.nextDashTrailAt) {
        this.player.nextDashTrailAt = time + DASH_TRAIL_INTERVAL_MS;
        this.spawnDashTrail();
      }
      return;
    }

    const accel = this.playerKnobs.accel;
    const left = this.cursors.left.isDown || this.keys.left.isDown || this.steer.left;
    const right = this.cursors.right.isDown || this.keys.right.isDown || this.steer.right;
    if (left && !right) {
      body.setAccelerationX(-accel);
      faceSkater(this.player, 'left');
    } else if (right && !left) {
      body.setAccelerationX(accel);
      faceSkater(this.player, 'right');
    } else {
      body.setAccelerationX(0);
    }

    if (
      Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || Phaser.Input.Keyboard.JustDown(this.cursors.space)
      || Phaser.Input.Keyboard.JustDown(this.keys.jump)
      || this.steer.jump
    ) {
      this.steer.jump = false;
      this.tryJump();
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.dash)
      || Phaser.Input.Keyboard.JustDown(this.keys.dashAlt)
      || this.steer.dash
    ) {
      this.steer.dash = false;
      this.tryDash(time);
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.attack)
      || Phaser.Input.Keyboard.JustDown(this.keys.attackAlt)
    ) {
      this.tryAttack(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.special)) {
      this.trySpecial();
    }
  }

  tryJump() {
    if (this.isOver || this.player.isDazed) return;
    const body = this.player.body;
    if (body.blocked.down || body.touching.down) {
      body.setVelocityY(-this.playerKnobs.jumpForce);
      this.playSfx('sfx-boost', 0.4);
    }
  }

  tryDash(time = this.time.now) {
    if (this.isOver || this.player.isDazed) return;
    if (time < this.player.dashReadyAt) return;
    const dir = this.player.facing === 'left' ? -1 : 1;
    this.player.dashReadyAt = time + DASH_COOLDOWN_MS;
    this.player.dashUntil = time + DASH_DURATION_MS;
    this.player.nextDashTrailAt = time;
    this.player.body.setVelocityX(dir * (this.playerKnobs.moveSpeed + this.playerKnobs.dashBoost));
    this.player.body.setVelocityY(Math.min(this.player.body.velocity.y, -70));
    this.triggerVfx(this.player.x - dir * 20, this.player.y + 8, 'light');
    this.playSfx('sfx-boost', 0.55);
  }

  tryAttack(time = this.time.now) {
    if (this.isOver || this.player.isDazed) return;
    if (time < this.player.attackReadyAt) return;
    this.player.attackReadyAt = time + ATTACK_COOLDOWN_MS;
    this.swingWeapon(this.player);
    this.playSfx('sfx-hit', 0.5);

    const dir = this.player.facing === 'left' ? -1 : 1;
    const reach = this.playerKnobs.attackReach;
    let landed = false;
    this.enemies.forEach((enemy) => {
      if (!enemy.active || enemy.isDead) return;
      const dx = (enemy.x - this.player.x) * dir;
      const dy = Math.abs(enemy.y - this.player.y);
      if (dx > -10 && dx < reach && dy < ATTACK_VERTICAL_BAND) {
        this.damageEnemy(enemy, this.playerKnobs.attackDamage, dir);
        landed = true;
      }
    });
    if (landed) {
      this.special = Math.min(this.specialMax, this.special + this.playerKnobs.specialChargePerHit);
    }
  }

  trySpecial() {
    if (this.isOver || this.player.isDazed) return;
    if (this.special < this.specialMax) return;
    this.special = 0;
    // Board-flip nova: damage + knockback every nearby enemy.
    this.cameras.main.shake(220, 0.012);
    this.triggerVfx(this.player.x, this.player.y - 20, 'heavy');
    this.playSfx('sfx-zap', 0.7);
    this.enemies.forEach((enemy) => {
      if (!enemy.active || enemy.isDead) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < 260) {
        const dir = enemy.x < this.player.x ? -1 : 1;
        this.damageEnemy(enemy, this.playerKnobs.attackDamage * 2.4, dir, true);
      }
    });
  }

  swingWeapon(skater) {
    skater.isAttacking = true;
    const dir = skater.facing === 'left' ? -1 : 1;
    this.tweens.add({
      targets: skater.weaponContainer,
      angle: dir * 70,
      duration: ATTACK_DURATION_MS / 2,
      yoyo: true,
      onComplete: () => {
        skater.weaponContainer.angle = 0;
        skater.isAttacking = false;
      },
    });
  }

  spawnDashTrail() {
    const ghost = this.add.container(this.player.x, this.player.y).setDepth(this.player.depth - 1);
    const color = this.player.cosmetics?.color ?? this.district.haze;
    const silhouette = this.add.rectangle(0, -10, 36, 66, color, 0.16);
    const board = this.add.rectangle(0, 18, 54, 7, 0xffffff, 0.18);
    ghost.add([silhouette, board]);
    ghost.setScale(this.player.scaleX, 1);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      x: ghost.x - this.player.scaleX * 34,
      duration: 220,
      onComplete: () => ghost.destroy(),
    });
  }

  handleHazardHit(hazard) {
    const now = this.time.now;
    const lastHitAt = hazard.getData('lastHitAt') ?? -Infinity;
    if (now - lastHitAt < HAZARD_COOLDOWN_MS || this.player.dashUntil > now) return;
    hazard.setData('lastHitAt', now);
    const dir = this.player.x < hazard.x ? -1 : 1;
    this.damagePlayer(HAZARD_DAMAGE, dir);
    this.showFloatingText(hazard.x, hazard.y - 42, 'SPILL!', '#ffea00');
  }

  handleBoostPad(pad) {
    const now = this.time.now;
    const lastBoostAt = pad.getData('lastBoostAt') ?? -Infinity;
    if (now - lastBoostAt < 450) return;
    pad.setData('lastBoostAt', now);
    const dir = this.player.facing === 'left' ? -1 : 1;
    this.player.body.setVelocityX(dir * (this.playerKnobs.moveSpeed + BOOST_PAD_POWER));
    this.player.body.setVelocityY(-this.playerKnobs.jumpForce * 0.72);
    this.triggerVfx(pad.x, pad.y - 10, 'medium');
    this.playSfx('sfx-boost', 0.5);
  }

  handlePickup(pickup) {
    if (!pickup.active) return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + PICKUP_HEAL_AMOUNT);
    this.special = Math.min(this.specialMax, this.special + 18);
    this.showFloatingText(pickup.x, pickup.y - 24, '+HP', '#39ff14');
    this.triggerVfx(pickup.x, pickup.y, 'light');
    pickup.destroy();
  }

  // ── Wave gates ─────────────────────────────────────────────────────────────

  handleGates() {
    if (this.activeGate || !this.gates.length) return;
    const nextGate = this.gates.find((gate) => !gate.spawned);
    if (!nextGate) return;
    if (this.player.x >= nextGate.x - this.scale.width * 0.4) {
      this.triggerGate(nextGate);
    }
  }

  triggerGate(gate) {
    gate.spawned = true;
    this.activeGate = gate;
    this.lockCamera();
    this.showBanner('CLEAR THE WAVE', '');
    const baseX = this.cameras.main.scrollX + this.scale.width - 80;
    for (let i = 0; i < gate.count; i += 1) {
      const ex = baseX + i * 70;
      this.spawnEnemy(ex, false);
    }
    if (gate.withBoss && this.mission?.boss) {
      this.spawnEnemy(baseX + gate.count * 70 + 40, true);
    }
  }

  lockCamera() {
    const lockX = Math.round(this.cameras.main.scrollX);
    this.cameras.main.setBounds(lockX, 0, this.scale.width, this.scale.height);
    // Physics barrier on the right edge of the locked arena.
    const barrierX = lockX + this.scale.width - 8;
    this.barrier = this.add.rectangle(barrierX, this.scale.height / 2, 16, this.scale.height, 0xffffff, 0);
    this.physics.add.existing(this.barrier, true);
    this.barrierCollider = this.physics.add.collider(this.player, this.barrier);
  }

  unlockCamera() {
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.scale.height);
    if (this.barrierCollider) {
      this.physics.world.removeCollider(this.barrierCollider);
      this.barrierCollider = null;
    }
    if (this.barrier) {
      this.barrier.destroy();
      this.barrier = null;
    }
  }

  onGateCleared() {
    const gate = this.activeGate;
    this.activeGate = null;
    this.unlockCamera();
    this.remainingGates = Math.max(0, this.remainingGates - 1);

    // Retrieve objective: drop the package once the final wave is down.
    if (this.objectiveId === STREETS_OBJECTIVES.retrieve.id && this.remainingGates === 0 && !this.packageAvailable && !this.carryingPackage) {
      this.spawnPackage(gate.x + 60);
      this.showBanner('GRAB THE PACKAGE', 'Then reach the exit');
    } else if (this.remainingGates === 0) {
      this.showBanner('LANE CLEAR', 'Skate to the exit');
    } else {
      this.showBanner('WAVE CLEAR', 'Advance →');
    }
  }

  // ── Enemies ──────────────────────────────────────────────────────────────

  spawnEnemy(x, isBoss) {
    const cosmetics = this.pickEnemyCosmetics(isBoss);
    const enemy = createSkater(this, x, this.groundY - 60, cosmetics);
    this.physics.add.existing(enemy);
    enemy.body.setCollideWorldBounds(false);
    enemy.body.setGravityY(GRAVITY_Y);
    enemy.body.setSize(50, 72);
    enemy.body.setOffset(-25, -48);
    enemy.body.setDragX(700);
    enemy.body.setMaxVelocity(this.playerKnobs.moveSpeed * (isBoss ? 0.86 : 0.96), 1400);
    this.physics.add.collider(enemy, this.ground);
    this.physics.add.overlap(enemy, this.boostPads, (enemyObject, pad) => this.handleEnemyBoostPad(enemyObject, pad));

    enemy.isEnemy = true;
    enemy.isBoss = Boolean(isBoss);
    enemy.isDead = false;
    enemy.isDazed = false;
    enemy.attackReadyAt = 0;
    enemy.thinkAt = 0;
    enemy.retreatUntil = 0;
    enemy.laneOffset = Phaser.Math.Between(-24, 24);
    enemy.archetype = this.pickEnemyArchetype(isBoss);
    enemy.ai = this.enemyAiProfile(enemy.archetype, isBoss);
    const hpMul = isBoss ? (this.mission?.boss?.hpMultiplier ?? 3) : 1;
    enemy.maxHp = Math.round(ENEMY_BASE_HP * hpMul * enemy.ai.hpMultiplier);
    enemy.hp = enemy.maxHp;
    enemy.damage = ENEMY_BASE_DAMAGE * (isBoss ? 1.6 : 1) * enemy.ai.damageMultiplier;
    if (isBoss) {
      enemy.setScale(1.25);
      enemy.bossName = this.mission?.boss?.name ?? 'Boss';
      this.boss = enemy;
      this.showBanner(enemy.bossName.toUpperCase(), this.mission?.boss?.tactic ?? '');
    }
    this.enemies.push(enemy);
    return enemy;
  }

  spawnHordeChaser() {
    if (this.isOver) return;
    const alive = this.enemies.filter((e) => e.active && !e.isDead).length;
    if (alive >= HORDE_CAP) return;
    // Spawn just off the left edge of the camera so they chase from behind.
    const x = Math.max(40, this.cameras.main.scrollX - 60);
    const enemy = this.spawnEnemy(x, false);
    enemy.body.setMaxVelocity(this.playerKnobs.moveSpeed * 0.92, 1400);
  }

  pickEnemyCosmetics(isBoss) {
    if (isBoss && this.mission?.boss) {
      return {
        colorName: this.mission.boss.color,
        weapon: this.mission.boss.weapon,
        deck: 'Gridwave',
      };
    }
    const colors = this.mission?.enemyColors ?? ['Cyber Pink', 'Toxic Green'];
    const weapons = this.mission?.enemyWeapons ?? ['Crutch Lance', 'Street Sign'];
    return {
      colorName: Phaser.Utils.Array.GetRandom(colors),
      weapon: Phaser.Utils.Array.GetRandom(weapons),
      deck: 'Gridwave',
    };
  }

  pickEnemyArchetype(isBoss) {
    if (isBoss) return 'boss';
    const roll = this.rng();
    if (roll > 0.78) return 'guard';
    if (roll > 0.55) return 'zagger';
    if (roll > 0.3) return 'sprinter';
    return 'bruiser';
  }

  enemyAiProfile(archetype, isBoss) {
    const profiles = {
      bruiser: { accel: 560, range: 68, preferred: 70, hpMultiplier: 1.25, damageMultiplier: 1.1, cooldown: 1050, jumpChance: 0.08 },
      sprinter: { accel: 830, range: 58, preferred: 54, hpMultiplier: 0.85, damageMultiplier: 0.9, cooldown: 760, jumpChance: 0.2 },
      zagger: { accel: 680, range: 62, preferred: 118, hpMultiplier: 1, damageMultiplier: 1, cooldown: 920, jumpChance: 0.16 },
      guard: { accel: 500, range: 82, preferred: 126, hpMultiplier: 1.15, damageMultiplier: 1.05, cooldown: 1120, jumpChance: 0.04 },
      boss: { accel: 640, range: 96, preferred: 110, hpMultiplier: 1, damageMultiplier: 1.1, cooldown: 820, jumpChance: 0.18 },
    };
    return {
      ...profiles[archetype],
      range: profiles[archetype].range + (isBoss ? 18 : 0),
    };
  }

  updateEnemies(time, delta) {
    let aliveInWave = 0;
    this.enemies.forEach((enemy) => {
      if (!enemy.active || enemy.isDead) return;
      if (!enemy.isDazed) aliveInWave += 1;
      if (enemy.isDazed) {
        enemy.setAlpha(0.5);
        return;
      }
      enemy.setAlpha(1);

      const dx = this.player.x - enemy.x;
      const adx = Math.abs(dx);
      const verticalGap = this.player.y - enemy.y;
      const directionToPlayer = dx < 0 ? -1 : 1;
      const profile = enemy.ai;
      const range = Math.max(ENEMY_ATTACK_RANGE, profile.range);
      const preferred = profile.preferred + Math.abs(enemy.laneOffset);
      const isLeashed = adx > ENEMY_LEASH_DISTANCE && this.activeGate;
      const shouldRetreat = time < enemy.retreatUntil || (enemy.archetype === 'zagger' && adx < preferred * 0.55);
      const facingToPlayer = directionToPlayer === -1 ? 'left' : 'right';

      if (time >= enemy.thinkAt) {
        enemy.thinkAt = time + Phaser.Math.Between(280, 520);
        if (enemy.archetype === 'guard' && adx < range + 18 && this.rng() > 0.58) {
          enemy.retreatUntil = time + Phaser.Math.Between(260, 520);
        }
        if ((bodyIsGrounded(enemy.body)) && Math.abs(verticalGap) > 34 && this.rng() < profile.jumpChance) {
          enemy.body.setVelocityY(-360);
        }
      }

      if (isLeashed) {
        enemy.body.setAccelerationX(0);
      } else if (shouldRetreat) {
        enemy.body.setAccelerationX(-directionToPlayer * profile.accel * 0.85);
        faceSkater(enemy, facingToPlayer);
      } else if (adx > preferred) {
        enemy.body.setAccelerationX(directionToPlayer * profile.accel);
        faceSkater(enemy, facingToPlayer);
      } else if (adx < range * 0.5) {
        enemy.body.setAccelerationX(-directionToPlayer * profile.accel * 0.55);
        faceSkater(enemy, dx < 0 ? 'left' : 'right');
      } else {
        enemy.body.setAccelerationX(0);
        // In range: attack on cooldown.
        if (time >= enemy.attackReadyAt && adx < range && Math.abs(verticalGap) < ATTACK_VERTICAL_BAND) {
          enemy.attackReadyAt = time + Math.max(560, profile.cooldown || ENEMY_ATTACK_COOLDOWN_MS);
          this.swingWeapon(enemy);
          this.damagePlayer(enemy.damage, dx < 0 ? -1 : 1);
        }
      }
    });

    // Wave cleared check.
    if (this.activeGate && aliveInWave === 0) {
      const waveEnemiesAlive = this.enemies.some((e) => e.active && !e.isDead);
      if (!waveEnemiesAlive) this.onGateCleared();
    }

    this.cullDeadEnemies();
  }

  cullDeadEnemies() {
    this.enemies = this.enemies.filter((enemy) => enemy.active);
  }

  handleEnemyBoostPad(enemy, pad) {
    if (!enemy.active || enemy.isDead || enemy.isDazed) return;
    const now = this.time.now;
    const lastBoostAt = enemy.getData('lastBoostAt') ?? -Infinity;
    if (now - lastBoostAt < 900 || Math.abs(this.player.x - pad.x) > 420) return;
    enemy.setData('lastBoostAt', now);
    const dir = this.player.x < enemy.x ? -1 : 1;
    enemy.body.setVelocityX(dir * (this.playerKnobs.moveSpeed * 0.86 + 180));
    enemy.body.setVelocityY(-320);
  }

  damageEnemy(enemy, amount, dir, heavy = false) {
    if (enemy.isDead) return;
    enemy.hp -= amount;
    this.triggerVfx(enemy.x, enemy.y - 20, heavy ? 'heavy' : 'medium');
    this.flash(enemy);
    enemy.body.setVelocityX(dir * (heavy ? 360 : 220));
    enemy.body.setVelocityY(-120);
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  killEnemy(enemy) {
    enemy.isDead = true;
    this.score += enemy.isBoss ? 1000 : 150;
    if (enemy === this.boss) this.boss = null;
    enemy.body.setEnable(false);
    this.tweens.add({
      targets: enemy,
      alpha: 0,
      angle: enemy.facing === 'left' ? 90 : -90,
      y: enemy.y + 10,
      duration: 320,
      onComplete: () => enemy.destroy(),
    });
  }

  damagePlayer(amount, dir) {
    if (this.player.isDazed || this.isOver) return;
    const reduced = amount * (1 - this.playerKnobs.damageResist);
    this.player.hp = Math.max(0, this.player.hp - reduced);
    this.flash(this.player);
    this.player.body.setVelocityX(dir * 220);
    this.player.body.setVelocityY(-140);
    this.triggerVfx(this.player.x, this.player.y - 20, 'medium');
    this.cameras.main.shake(120, 0.008);
    if (this.player.hp <= 0) {
      this.endGame(false);
      return;
    }
    // Brief stun so hits don't chain-lock the player to death instantly.
    this.player.isDazed = true;
    this.time.delayedCall(Math.max(220, this.playerKnobs.recoverMs * 0.4), () => {
      if (this.player.active) this.player.isDazed = false;
    });
  }

  // ── Objective resolution ───────────────────────────────────────────────────

  handlePackagePickup() {
    if (!this.packageAvailable || this.carryingPackage || !this.packageMarker) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.packageMarker.x, this.packageMarker.y);
    if (dist < 56) {
      this.carryingPackage = true;
      this.packageAvailable = false;
      this.packageMarker.destroy();
      this.packageMarker = null;
      // Attach a carried marker above the player.
      this.carryIcon = this.add.text(0, -70, '✚', { fontSize: '18px', color: '#39ff14' }).setOrigin(0.5);
      this.player.add(this.carryIcon);
      this.playSfx('sfx-zap', 0.5);
      this.showBanner('PACKAGE SECURED', 'Extract at the exit');
    }
  }

  checkObjective() {
    if (this.isOver || this.objectiveComplete) return;
    const atExit = this.player.x >= this.exitX - 20;
    if (!atExit) return;

    if (this.objectiveId === STREETS_OBJECTIVES.retrieve.id) {
      if (this.carryingPackage) {
        this.endGame(true);
      }
      return;
    }
    if (this.objectiveId === STREETS_OBJECTIVES.fight_through.id) {
      // Must have cleared all gates before the exit counts.
      if (this.remainingGates === 0 && !this.activeGate) {
        this.endGame(true);
      }
      return;
    }
    // escape: reaching the exit alive wins.
    this.endGame(true);
  }

  // ── HUD + banners ──────────────────────────────────────────────────────────

  createHud() {
    this.hpBarBg = this.add.rectangle(20, 24, 220, 18, 0x111122, 0.85)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(120).setStrokeStyle(2, 0x00f0ff);
    this.hpBar = this.add.rectangle(22, 24, 216, 12, 0x39ff14)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(121);
    this.add.text(20, 6, this.config.player?.cosmetics?.name || 'PUNCH SKATER', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffffff',
    }).setScrollFactor(0).setDepth(121);

    this.specialBarBg = this.add.rectangle(20, 48, 160, 12, 0x111122, 0.85)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(120).setStrokeStyle(2, 0xffea00);
    this.specialBar = this.add.rectangle(22, 48, 0, 7, 0xffea00)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(121);
    this.dashPip = this.add.rectangle(190, 48, 42, 7, 0x39ff14)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(121);

    this.scoreText = this.add.text(this.scale.width - 20, 16, 'SCORE 0', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#00f0ff',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(120);

    this.objectiveText = this.add.text(this.scale.width - 20, 38, this.objectiveLabel(), {
      fontFamily: '"Press Start 2P"', fontSize: '9px', color: '#ffea00', align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(120);

    this.bossBarBg = this.add.rectangle(this.scale.width / 2, 24, 320, 14, 0x111122, 0.85)
      .setScrollFactor(0).setDepth(120).setStrokeStyle(2, 0xff0055).setVisible(false);
    this.bossBar = this.add.rectangle(this.scale.width / 2 - 158, 24, 316, 9, 0xff0055)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(121).setVisible(false);
    this.bossLabel = this.add.text(this.scale.width / 2, 8, '', {
      fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ff8af8',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(121).setVisible(false);

    this.scale.on('resize', (gameSize) => {
      this.scoreText?.setPosition(gameSize.width - 20, 16);
      this.objectiveText?.setPosition(gameSize.width - 20, 38);
      this.bossBarBg?.setPosition(gameSize.width / 2, 24);
      this.bossLabel?.setPosition(gameSize.width / 2, 8);
    });
  }

  objectiveLabel() {
    const obj = STREETS_OBJECTIVES[this.objectiveId] || STREETS_OBJECTIVES.fight_through;
    return obj.blurb.toUpperCase();
  }

  updateHud() {
    const hpFrac = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.hpBar.setSize(216 * hpFrac, 12);
    this.hpBar.setFillStyle(hpFrac > 0.5 ? 0x39ff14 : hpFrac > 0.25 ? 0xffea00 : 0xff0055);
    this.specialBar.setSize(156 * Phaser.Math.Clamp(this.special / this.specialMax, 0, 1), 7);
    const dashFrac = Phaser.Math.Clamp(1 - ((this.player.dashReadyAt - this.time.now) / DASH_COOLDOWN_MS), 0, 1);
    this.dashPip.setSize(42 * dashFrac, 7);
    this.dashPip.setFillStyle(dashFrac >= 1 ? 0x39ff14 : 0x1f6f5b);
    this.scoreText.setText('SCORE ' + this.score);

    if (this.boss && this.boss.active && !this.boss.isDead) {
      const frac = Phaser.Math.Clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      this.bossBarBg.setVisible(true);
      this.bossBar.setVisible(true).setSize(316 * frac, 9);
      this.bossLabel.setVisible(true).setText(this.boss.bossName.toUpperCase());
    } else {
      this.bossBarBg.setVisible(false);
      this.bossBar.setVisible(false);
      this.bossLabel.setVisible(false);
    }
  }

  showBanner(title, subtitle) {
    const { width } = this.scale;
    const y = 120;
    const t = this.add.text(width / 2, y, title, {
      fontFamily: '"Press Start 2P"', fontSize: 'min(20px, 4vw)', color: '#ffffff',
      stroke: '#ff007f', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(150);
    const s = subtitle
      ? this.add.text(width / 2, y + 28, subtitle, {
        fontFamily: 'Orbitron, sans-serif', fontSize: 'min(13px, 2.6vw)', color: '#ffea00',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(150)
      : null;
    this.tweens.add({
      targets: [t, s].filter(Boolean),
      alpha: 0,
      y: y - 20,
      delay: 1300,
      duration: 700,
      onComplete: () => { t.destroy(); if (s) s.destroy(); },
    });
  }

  // ── VFX / audio ──────────────────────────────────────────────────────────

  triggerVfx(x, y, intensity) {
    const count = intensity === 'heavy' ? 26 : intensity === 'light' ? 8 : 14;
    this.sparks?.emitParticleAt(x, y, count);
    const ring = this.add.circle(x, y, 10, 0xffffff, 0.2)
      .setStrokeStyle(3, intensity === 'heavy' ? 0xff0055 : 0x00f0ff);
    this.tweens.add({
      targets: ring,
      scale: intensity === 'heavy' ? 3 : 2,
      alpha: 0,
      duration: intensity === 'heavy' ? 320 : 220,
      onComplete: () => ring.destroy(),
    });
  }

  flash(target) {
    this.tweens.add({ targets: target, alpha: 0.2, yoyo: true, repeat: 2, duration: 60 });
  }

  showFloatingText(x, y, label, color) {
    const text = this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P"',
      fontSize: '9px',
      color,
      stroke: '#050510',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(140);
    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 620,
      onComplete: () => text.destroy(),
    });
  }

  playSfx(key, volume = 1) {
    if (!this.cache.audio.exists(key)) return;
    try { this.sound.play(key, { volume }); } catch { /* ignore */ }
  }

  // ── End game + result reporting ──────────────────────────────────────────

  endGame(win) {
    if (this.isOver) return;
    this.isOver = true;
    this.player.body.setVelocity(0, 0);
    this.player.body.setAccelerationX(0);
    if (this.hordeTimer) this.hordeTimer.remove();

    this.reportResult(win);

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x050510, 0.84)
      .setScrollFactor(0).setDepth(200);
    this.add.text(width / 2, height * 0.32, win ? 'MISSION CLEAR' : 'WIPED OUT', {
      fontFamily: '"Press Start 2P"', fontSize: 'min(30px, 6vw)', color: win ? '#39ff14' : '#ff0055',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.add.text(width / 2, height * 0.32 + 46, 'SCORE ' + this.score, {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    if (this.config.returnTo) {
      this.makeEndButton(width / 2, height * 0.56, 'RETURN TO MISSION', () => this.navigateReturn(win));
      this.time.delayedCall(2600, () => this.navigateReturn(win));
    } else {
      this.makeEndButton(width / 2, height * 0.54, win ? 'PLAY AGAIN' : 'RETRY', () => this.scene.start('StreetsMenuScene'));
      this.makeEndButton(width / 2, height * 0.66, 'ARENA', () => { window.location.href = '/arena'; });
    }
  }

  makeEndButton(x, y, label, onClick) {
    const btn = this.add.rectangle(x, y, Math.min(300, this.scale.width * 0.7), 50, 0x00f0ff)
      .setScrollFactor(0).setDepth(201).setInteractive({ cursor: 'pointer' });
    this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P"', fontSize: 'min(13px, 2.6vw)', color: '#05030f',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    btn.on('pointerdown', onClick);
    return btn;
  }

  reportResult(win) {
    // Notify an opener (when launched in a popup/tab) without trusting it.
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          source: 'punch-skater-streets',
          type: 'streets-result',
          win,
          runId: this.config.runId || null,
          nodeId: this.config.nodeId || null,
          choiceId: this.config.choiceId || null,
          missionId: this.missionId || null,
          score: this.score,
        }, window.location.origin);
      }
    } catch { /* ignore */ }
  }

  navigateReturn(win) {
    if (!this.config.returnTo) return;
    const url = new URL(this.config.returnTo, window.location.origin);
    url.searchParams.set('streetsResult', win ? 'win' : 'lose');
    if (this.config.runId) url.searchParams.set('runId', this.config.runId);
    if (this.config.nodeId) url.searchParams.set('nodeId', this.config.nodeId);
    if (this.config.choiceId) url.searchParams.set('choiceId', this.config.choiceId);
    if (this.missionId) url.searchParams.set('mission', this.missionId);
    // Same-origin guaranteed by sanitizeReturnTo + URL base.
    window.location.href = `${url.pathname}${url.search}`;
  }
}

export default StreetsGameScene;
