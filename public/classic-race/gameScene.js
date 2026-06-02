/**
 * gameScene.js — Punch Skater™ Classic Race main game scene.
 *
 * Architecture: Game state (positions, velocities, laps) is strictly separated
 * from rendering. `updateState()` is a pure-ish function that could be run on a
 * server for future multiplayer. The Phaser scene only reads state to position
 * sprites.
 */
import Phaser from './phaserRuntime.js';
import { PHYSICS, NITRO, TRACK, AI, parseRaceConfig } from './raceConfig.js';
import { buildRacerAnimationKey, buildRacerSheetTextureKey } from './racerSprites.js';

// Target on-screen height (px) for a racer rendered from a sprite sheet. The
// procedural fallback shape keeps its native 28×16 size (baseScale = 1).
const RACER_SPRITE_DISPLAY_HEIGHT = 40;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Convert normalized [0,1] track points to world coordinates
function toWorld(points) {
  return points.map(([nx, ny]) => ({
    x: nx * TRACK.WORLD_WIDTH,
    y: ny * TRACK.WORLD_HEIGHT,
  }));
}

// Generate road boundary segments from centerline waypoints
function buildTrackWalls(waypoints, halfWidth) {
  const inner = [];
  const outer = [];
  const n = waypoints.length;
  for (let i = 0; i < n; i++) {
    const prev = waypoints[(i - 1 + n) % n];
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];
    // Average direction
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular (left normal)
    const nx = -dy / len;
    const ny = dx / len;
    inner.push({ x: curr.x + nx * halfWidth, y: curr.y + ny * halfWidth });
    outer.push({ x: curr.x - nx * halfWidth, y: curr.y - ny * halfWidth });
  }
  return { inner, outer };
}

// Point-in-polygon test (ray casting)
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Closest point on a line segment to a point
function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  return { x: ax + t * dx, y: ay + t * dy };
}

// ---------------------------------------------------------------------------
// Racer state factory
// ---------------------------------------------------------------------------
function createRacer(id, x, y, angle, isPlayer = false) {
  return {
    id,
    x, y,
    angle,
    vx: 0, vy: 0,
    speed: 0,
    angularVel: 0,
    lap: 0,
    checkpoint: 0,
    finished: false,
    finishTime: 0,
    isPlayer,
    nitroReady: true,
    nitroActive: false,
    nitroTimer: 0,
    nitroCooldown: 0,
    // AI-specific
    aiSpeedMult: isPlayer ? 1 : (1 + (Math.random() * 2 - 1) * AI.SPEED_VARIATION),
    aiTargetWaypoint: 1,
  };
}

// ---------------------------------------------------------------------------
// State update (pure logic — no Phaser dependencies)
// ---------------------------------------------------------------------------
function updateRacerPhysics(racer, dt, input, waypoints, walls, obstacles, totalLaps) {
  if (racer.finished) return;

  const dtSec = dt / 1000;
  const maxSpeed = PHYSICS.MAX_SPEED * (racer.nitroActive ? NITRO.BOOST_SPEED_MULT : 1) * racer.aiSpeedMult;

  // --- Steering ---
  const steer = input.left ? -1 : input.right ? 1 : 0;
  const speedFactor = clamp(Math.abs(racer.speed) / 100, 0.2, 1);
  racer.angularVel += steer * PHYSICS.TURN_RATE * speedFactor * dtSec;
  racer.angularVel *= (1 - PHYSICS.ANGULAR_DRAG * dtSec);
  racer.angle += racer.angularVel * dtSec;
  racer.angle = normalizeAngle(racer.angle);

  // --- Thrust ---
  if (input.up) {
    racer.speed += PHYSICS.ACCELERATION * dtSec;
  } else if (input.down) {
    racer.speed -= PHYSICS.BRAKE_FORCE * dtSec;
  } else {
    // Natural drag
    racer.speed -= Math.sign(racer.speed) * PHYSICS.DRAG * dtSec;
    if (Math.abs(racer.speed) < 5) racer.speed = 0;
  }
  racer.speed = clamp(racer.speed, -PHYSICS.REVERSE_MAX, maxSpeed);

  // --- Velocity decomposition (drift mechanic) ---
  const cosA = Math.cos(racer.angle);
  const sinA = Math.sin(racer.angle);

  // Forward component
  const forwardX = cosA * racer.speed;
  const forwardY = sinA * racer.speed;

  // Lateral component from previous frame (creates drift)
  const lateralX = racer.vx - cosA * (racer.vx * cosA + racer.vy * sinA);
  const lateralY = racer.vy - sinA * (racer.vx * cosA + racer.vy * sinA);

  // Apply drift damping
  const driftFactor = Math.abs(steer) > 0 ? PHYSICS.DRIFT_LATERAL_DAMPING : PHYSICS.DRIFT_NEUTRAL_DAMPING;
  racer.vx = forwardX + lateralX * driftFactor;
  racer.vy = forwardY + lateralY * driftFactor;

  // --- Apply grip reduction on turns ---
  if (Math.abs(steer) > 0) {
    const gripLoss = 1 - (1 - PHYSICS.TURN_GRIP_FACTOR) * Math.abs(racer.angularVel) * PHYSICS.GRIP_ANGULAR_FACTOR;
    racer.speed *= clamp(gripLoss, 0.85, 1);
  }

  // --- Position update ---
  racer.x += racer.vx * dtSec;
  racer.y += racer.vy * dtSec;

  // --- Nitro timer ---
  if (racer.nitroActive) {
    racer.nitroTimer -= dt;
    if (racer.nitroTimer <= 0) {
      racer.nitroActive = false;
      racer.nitroCooldown = NITRO.COOLDOWN;
    }
  } else if (!racer.nitroReady) {
    racer.nitroCooldown -= dt;
    if (racer.nitroCooldown <= 0) {
      racer.nitroReady = true;
    }
  }

  // --- Track boundary collision ---
  const onTrack = isOnTrack(racer.x, racer.y, walls);
  if (!onTrack) {
    // Push back toward nearest road point
    const nearest = findNearestTrackPoint(racer.x, racer.y, waypoints);
    const pushAngle = angleTo(racer.x, racer.y, nearest.x, nearest.y);
    racer.vx = Math.cos(pushAngle) * Math.abs(racer.speed) * PHYSICS.BOUNCE_FACTOR;
    racer.vy = Math.sin(pushAngle) * Math.abs(racer.speed) * PHYSICS.BOUNCE_FACTOR;
    racer.speed *= PHYSICS.BOUNCE_FACTOR;
    racer.x += Math.cos(pushAngle) * PHYSICS.BOUNDARY_PUSH;
    racer.y += Math.sin(pushAngle) * PHYSICS.BOUNDARY_PUSH;
  }

  // --- Obstacle collision ---
  for (const obs of obstacles) {
    const d = dist(racer.x, racer.y, obs.x, obs.y);
    if (d < obs.radius + 12) {
      const pushAngle = angleTo(obs.x, obs.y, racer.x, racer.y);
      racer.vx = Math.cos(pushAngle) * PHYSICS.OBSTACLE_BOUNCE;
      racer.vy = Math.sin(pushAngle) * PHYSICS.OBSTACLE_BOUNCE;
      racer.speed *= PHYSICS.OBSTACLE_SLOW;
      racer.x += Math.cos(pushAngle) * PHYSICS.OBSTACLE_PUSH;
      racer.y += Math.sin(pushAngle) * PHYSICS.OBSTACLE_PUSH;
    }
  }

  // --- Checkpoint / Lap tracking ---
  const nextCp = racer.checkpoint;
  const cpPos = waypoints[nextCp];
  const cpDist = dist(racer.x, racer.y, cpPos.x, cpPos.y);
  if (cpDist < TRACK.CHECKPOINT_RADIUS) {
    racer.checkpoint = (nextCp + 1) % waypoints.length;
    if (racer.checkpoint === 0) {
      racer.lap++;
    }
  }

  // --- Finish detection ---
  if (racer.lap >= totalLaps) {
    racer.finished = true;
  }
}

function isOnTrack(x, y, walls) {
  // Check if point is inside outer boundary and outside inner boundary → on road
  // For simplicity with our generated walls, check distance from centerline
  return pointInPolygon(x, y, walls.outer) && !pointInPolygon(x, y, walls.inner);
}

function findNearestTrackPoint(x, y, waypoints) {
  let nearest = waypoints[0];
  let minD = Infinity;
  for (const wp of waypoints) {
    const d = dist(x, y, wp.x, wp.y);
    if (d < minD) { minD = d; nearest = wp; }
  }
  return nearest;
}

// ---------------------------------------------------------------------------
// AI Controller
// ---------------------------------------------------------------------------
function computeAIInput(racer, waypoints) {
  const target = waypoints[racer.aiTargetWaypoint];
  const d = dist(racer.x, racer.y, target.x, target.y);

  // Switch to next waypoint
  if (d < AI.WAYPOINT_THRESHOLD) {
    racer.aiTargetWaypoint = (racer.aiTargetWaypoint + 1) % waypoints.length;
  }

  // Look ahead for smoother steering
  const lookIdx = (racer.aiTargetWaypoint + AI.STEER_LOOKAHEAD) % waypoints.length;
  const look = waypoints[lookIdx];
  const desired = angleTo(racer.x, racer.y, look.x, look.y);
  const diff = normalizeAngle(desired - racer.angle);

  // Determine if approaching a tight corner
  const nextIdx = (racer.aiTargetWaypoint + 1) % waypoints.length;
  const afterNext = waypoints[nextIdx];
  const cornerAngle = Math.abs(normalizeAngle(
    angleTo(target.x, target.y, afterNext.x, afterNext.y) -
    angleTo(racer.x, racer.y, target.x, target.y)
  ));
  const shouldBrake = cornerAngle > AI.CORNER_ANGLE_THRESHOLD && d < AI.CORNER_BRAKE_DISTANCE;

  // Nitro usage
  let useNitro = false;
  if (racer.nitroReady && !racer.nitroActive && Math.abs(diff) < AI.NITRO_ALIGN_THRESHOLD && Math.random() < AI.NITRO_FRAME_CHANCE) {
    useNitro = true;
  }

  return {
    up: !shouldBrake,
    down: shouldBrake && racer.speed > PHYSICS.MAX_SPEED * AI.CORNER_SLOWDOWN,
    left: diff < -AI.STEER_DEADZONE,
    right: diff > AI.STEER_DEADZONE,
    nitro: useNitro,
  };
}

// ---------------------------------------------------------------------------
// Phaser Scene
// ---------------------------------------------------------------------------
export class RaceGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RaceGameScene' });
  }

  init(data) {
    this.raceConfig = data.raceConfig || parseRaceConfig();
    this.spriteGrid = data.spriteGrid || null;
    this.spriteAssignments = Array.isArray(data.spriteAssignments) ? data.spriteAssignments : [];
  }

  create() {
    const { track, opponents } = this.raceConfig;
    this.waypoints = toWorld(track.points);
    this.walls = buildTrackWalls(this.waypoints, TRACK.ROAD_HALF_WIDTH);
    this.totalLaps = track.laps;
    this.raceStarted = false;
    this.raceOver = false;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.raceTime = 0;
    this.finishOrder = [];

    // Build obstacles in world coords
    this.obstacleData = (track.obstacles || []).map(o => ({
      x: o.x * TRACK.WORLD_WIDTH,
      y: o.y * TRACK.WORLD_HEIGHT,
      radius: 18,
      type: o.type,
    }));

    // --- Draw track ---
    this.drawTrack(track);

    // --- Draw obstacles ---
    this.drawObstacles();

    // --- Create racers ---
    this.racers = [];
    const startX = this.waypoints[0].x;
    const startY = this.waypoints[0].y;
    const startAngle = angleTo(startX, startY, this.waypoints[1].x, this.waypoints[1].y);

    // Stagger start positions perpendicular to track direction
    const perpX = -Math.sin(startAngle);
    const perpY = Math.cos(startAngle);
    const totalRacers = opponents + 1;
    const spacing = 30;

    // Player is always first in the array
    const playerOffset = -(totalRacers - 1) / 2 * spacing;
    const player = createRacer(
      'player',
      startX + perpX * playerOffset - Math.cos(startAngle) * 20,
      startY + perpY * playerOffset - Math.sin(startAngle) * 20,
      startAngle,
      true
    );
    this.racers.push(player);

    // AI opponents
    const aiColors = [0xff3333, 0x33ff33, 0x3333ff, 0xffff33, 0xff33ff];
    const aiNames = ['Razor', 'Flux', 'Volt', 'Ghost', 'Blitz'];
    for (let i = 0; i < opponents; i++) {
      const offset = (-(totalRacers - 1) / 2 + (i + 1)) * spacing;
      const ai = createRacer(
        `ai_${i}`,
        startX + perpX * offset - Math.cos(startAngle) * (40 + i * 15),
        startY + perpY * offset - Math.sin(startAngle) * (40 + i * 15),
        startAngle,
        false
      );
      ai.color = aiColors[i % aiColors.length];
      ai.displayName = aiNames[i % aiNames.length];
      ai.aiTargetWaypoint = 1;
      this.racers.push(ai);
    }

    // --- Create sprites ---
    this.racerSprites = [];
    const grid = this.spriteGrid;
    for (let i = 0; i < this.racers.length; i += 1) {
      const racer = this.racers[i];
      const assignment = this.spriteAssignments[i] || null;
      const sheetKey = assignment ? buildRacerSheetTextureKey(assignment.slug) : null;
      const hasSheet = Boolean(sheetKey && grid && this.textures.exists(sheetKey));

      let sprite;
      if (hasSheet) {
        // Pre-baked animated character sprite sheet.
        const animKey = buildRacerAnimationKey(assignment.slug);
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(sheetKey, {
              start: 0,
              end: Math.max(0, grid.frameCount - 1),
            }),
            frameRate: grid.fps,
            repeat: -1,
          });
        }
        sprite = this.add.sprite(racer.x, racer.y, sheetKey);
        sprite.baseScale = RACER_SPRITE_DISPLAY_HEIGHT / grid.frameHeight;
        sprite.play(animKey);
      } else {
        // Fallback: procedural skater shape (elongated hexagon).
        const color = racer.isPlayer ? 0x00f0ff : (racer.color || 0xff007f);
        const gfx = this.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(-14, -8, 28, 16, 4);
        gfx.fillStyle(0xffffff, 0.9);
        gfx.fillTriangle(10, -4, 14, 0, 10, 4); // direction indicator
        gfx.generateTexture(`racer_${racer.id}`, 28, 16);
        gfx.destroy();
        sprite = this.add.sprite(racer.x, racer.y, `racer_${racer.id}`);
        sprite.baseScale = 1;
      }

      sprite.setOrigin(0.5, 0.5);
      sprite.setScale(sprite.baseScale);
      sprite.setDepth(10);
      this.racerSprites.push(sprite);

      // Name label for AI
      if (!racer.isPlayer) {
        const label = this.add.text(racer.x, racer.y - 16, racer.displayName, {
          fontSize: '10px',
          fontFamily: 'Orbitron, sans-serif',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5).setDepth(11);
        sprite.nameLabel = label;
      }
    }

    // --- Camera follows player ---
    this.cameras.main.setBounds(0, 0, TRACK.WORLD_WIDTH, TRACK.WORLD_HEIGHT);
    this.cameras.main.startFollow(this.racerSprites[0], true, 0.08, 0.08);
    this.cameras.main.setZoom(1.4);
    this.cameras.main.setBackgroundColor('#070714');

    // --- HUD (fixed to camera) ---
    this.hudContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    this.lapText = this.add.text(16, 16, '', {
      fontSize: '16px',
      fontFamily: 'Press Start 2P, monospace',
      color: '#00f0ff',
      stroke: '#000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(100);

    this.posText = this.add.text(16, 40, '', {
      fontSize: '12px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    this.nitroText = this.add.text(16, 64, '', {
      fontSize: '12px',
      fontFamily: 'Press Start 2P, monospace',
      color: '#ffea00',
      stroke: '#000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(100);

    this.countdownText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      '3',
      {
        fontSize: '64px',
        fontFamily: 'Press Start 2P, monospace',
        color: '#ff007f',
        stroke: '#000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // --- Input ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      nitro: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      nitro2: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    // --- Start countdown ---
    this.countdownTimer = 0;
  }

  drawTrack(track) {
    const gfx = this.add.graphics();
    const wp = this.waypoints;
    const { inner, outer } = this.walls;

    // Ground fill
    gfx.fillStyle(0x111122, 1);
    gfx.fillRect(0, 0, TRACK.WORLD_WIDTH, TRACK.WORLD_HEIGHT);

    // Road surface
    gfx.fillStyle(Phaser.Display.Color.HexStringToColor(track.colors.road).color, 1);
    gfx.beginPath();
    gfx.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) gfx.lineTo(outer[i].x, outer[i].y);
    gfx.closePath();
    for (let i = inner.length - 1; i >= 0; i--) gfx.lineTo(inner[i].x, inner[i].y);
    gfx.closePath();
    gfx.fillPath();

    // Road borders
    const borderColor = Phaser.Display.Color.HexStringToColor(track.colors.border).color;
    gfx.lineStyle(3, borderColor, 0.8);
    gfx.beginPath();
    gfx.moveTo(outer[0].x, outer[0].y);
    for (let i = 1; i < outer.length; i++) gfx.lineTo(outer[i].x, outer[i].y);
    gfx.closePath();
    gfx.strokePath();

    gfx.beginPath();
    gfx.moveTo(inner[0].x, inner[0].y);
    for (let i = 1; i < inner.length; i++) gfx.lineTo(inner[i].x, inner[i].y);
    gfx.closePath();
    gfx.strokePath();

    // Center dashed line
    const accentColor = Phaser.Display.Color.HexStringToColor(track.colors.accent).color;
    gfx.lineStyle(1, accentColor, 0.4);
    for (let i = 0; i < wp.length; i++) {
      if (i % 2 === 0) {
        const next = wp[(i + 1) % wp.length];
        gfx.beginPath();
        gfx.moveTo(wp[i].x, wp[i].y);
        gfx.lineTo(next.x, next.y);
        gfx.strokePath();
      }
    }

    // Start/finish line
    const s = wp[0];
    const next = wp[1];
    const sAngle = angleTo(s.x, s.y, next.x, next.y);
    const perpX = -Math.sin(sAngle) * TRACK.ROAD_HALF_WIDTH;
    const perpY = Math.cos(sAngle) * TRACK.ROAD_HALF_WIDTH;
    gfx.lineStyle(4, 0xffffff, 0.9);
    gfx.beginPath();
    gfx.moveTo(s.x + perpX, s.y + perpY);
    gfx.lineTo(s.x - perpX, s.y - perpY);
    gfx.strokePath();

    // Checkerboard pattern on start line
    gfx.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) {
        const t = i / 6;
        const px = lerp(s.x + perpX, s.x - perpX, t);
        const py = lerp(s.y + perpY, s.y - perpY, t);
        gfx.fillRect(px - 4, py - 4, 8, 8);
      }
    }

    gfx.setDepth(1);
  }

  drawObstacles() {
    const gfx = this.add.graphics().setDepth(5);
    for (const obs of this.obstacleData) {
      if (obs.type === 'pothole') {
        gfx.fillStyle(0x222222, 0.8);
        gfx.fillCircle(obs.x, obs.y, obs.radius);
        gfx.lineStyle(2, 0x444444, 0.6);
        gfx.strokeCircle(obs.x, obs.y, obs.radius);
      } else {
        // debris — irregular rectangle
        gfx.fillStyle(0x553311, 0.8);
        gfx.fillRect(obs.x - 12, obs.y - 8, 24, 16);
        gfx.lineStyle(2, 0x886633, 0.7);
        gfx.strokeRect(obs.x - 12, obs.y - 8, 24, 16);
      }
    }
  }

  update(time, delta) {
    // --- Countdown phase ---
    if (!this.raceStarted) {
      this.countdownTimer += delta;
      const phase = Math.floor(this.countdownTimer / 1000);
      if (phase < 3) {
        this.countdownText.setText(`${3 - phase}`);
      } else if (phase === 3) {
        this.countdownText.setText('GO!');
        this.countdownText.setColor('#00ff66');
      } else {
        this.countdownText.setVisible(false);
        this.raceStarted = true;
      }
      this.updateHUD();
      return;
    }

    if (this.raceOver) return;

    this.raceTime += delta;

    // --- Player input ---
    const playerInput = {
      up: this.cursors.up.isDown || this.wasd.up.isDown,
      down: this.cursors.down.isDown || this.wasd.down.isDown,
      left: this.cursors.left.isDown || this.wasd.left.isDown,
      right: this.cursors.right.isDown || this.wasd.right.isDown,
      nitro: this.wasd.nitro.isDown || this.wasd.nitro2.isDown,
    };

    // Handle player nitro activation
    const player = this.racers[0];
    if (playerInput.nitro && player.nitroReady && !player.nitroActive) {
      player.nitroActive = true;
      player.nitroReady = false;
      player.nitroTimer = NITRO.BOOST_DURATION;
    }

    // --- Update all racers ---
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i];
      let input;

      if (racer.isPlayer) {
        input = playerInput;
      } else {
        input = computeAIInput(racer, this.waypoints);
        // AI nitro
        if (input.nitro && racer.nitroReady && !racer.nitroActive) {
          racer.nitroActive = true;
          racer.nitroReady = false;
          racer.nitroTimer = NITRO.BOOST_DURATION;
        }
      }

      updateRacerPhysics(racer, delta, input, this.waypoints, this.walls, this.obstacleData, this.totalLaps);

      // Track finish
      if (racer.finished && !this.finishOrder.includes(racer.id)) {
        racer.finishTime = this.raceTime;
        this.finishOrder.push(racer.id);
      }
    }

    // --- Racer-to-racer collision ---
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < PHYSICS.RACER_COLLISION_RADIUS && d > 0) {
          const pushAngle = angleTo(a.x, a.y, b.x, b.y);
          const overlap = (PHYSICS.RACER_COLLISION_RADIUS - d) / 2;
          a.x -= Math.cos(pushAngle) * overlap;
          a.y -= Math.sin(pushAngle) * overlap;
          b.x += Math.cos(pushAngle) * overlap;
          b.y += Math.sin(pushAngle) * overlap;
          // Exchange some momentum
          const av = { x: a.vx, y: a.vy };
          a.vx = lerp(a.vx, b.vx, PHYSICS.COLLISION_MOMENTUM_EXCHANGE);
          a.vy = lerp(a.vy, b.vy, PHYSICS.COLLISION_MOMENTUM_EXCHANGE);
          b.vx = lerp(b.vx, av.x, PHYSICS.COLLISION_MOMENTUM_EXCHANGE);
          b.vy = lerp(b.vy, av.y, PHYSICS.COLLISION_MOMENTUM_EXCHANGE);
        }
      }
    }

    // --- Render: sync sprites to state ---
    for (let i = 0; i < this.racers.length; i++) {
      const racer = this.racers[i];
      const sprite = this.racerSprites[i];
      sprite.setPosition(racer.x, racer.y);
      sprite.setRotation(racer.angle);

      // Nitro visual
      const baseScale = sprite.baseScale ?? 1;
      if (racer.nitroActive) {
        sprite.setTint(0xffea00);
        sprite.setScale(baseScale * 1.1);
      } else {
        sprite.clearTint();
        sprite.setScale(baseScale);
      }

      // Name label follows AI
      if (sprite.nameLabel) {
        sprite.nameLabel.setPosition(racer.x, racer.y - 18);
      }
    }

    // --- HUD ---
    this.updateHUD();

    // --- Check race over ---
    if (this.finishOrder.length === this.racers.length || (player.finished && !this.raceOver)) {
      this.raceOver = true;
      this.showResults();
    }
  }

  updateHUD() {
    const player = this.racers[0];
    const lapDisplay = Math.min(player.lap + 1, this.totalLaps);
    this.lapText.setText(`LAP ${lapDisplay}/${this.totalLaps}`);

    // Position (sorted by checkpoint progress and lap)
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      const aProgress = a.lap * this.waypoints.length + a.checkpoint;
      const bProgress = b.lap * this.waypoints.length + b.checkpoint;
      return bProgress - aProgress;
    });
    const pos = sorted.findIndex(r => r.isPlayer) + 1;
    const ordinal = pos === 1 ? '1st' : pos === 2 ? '2nd' : pos === 3 ? '3rd' : `${pos}th`;
    this.posText.setText(`POS: ${ordinal} / ${this.racers.length}`);

    // Nitro status
    if (player.nitroActive) {
      const remaining = Math.ceil(player.nitroTimer / 1000);
      this.nitroText.setText(`🔥 NITRO ${remaining}s`);
      this.nitroText.setColor('#ffea00');
    } else if (player.nitroReady) {
      this.nitroText.setText('⚡ NITRO READY [SHIFT]');
      this.nitroText.setColor('#00ff66');
    } else {
      const cd = Math.ceil(player.nitroCooldown / 1000);
      this.nitroText.setText(`⏳ NITRO ${cd}s`);
      this.nitroText.setColor('#888888');
    }
  }

  showResults() {
    const overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.75
    ).setScrollFactor(0).setDepth(300);

    const player = this.racers[0];
    const pos = this.finishOrder.indexOf('player') + 1;
    const ordinal = pos === 1 ? '1ST' : pos === 2 ? '2ND' : pos === 3 ? '3RD' : `${pos}TH`;
    const won = pos === 1;

    const titleColor = won ? '#00ff66' : '#ff007f';
    const titleText = won ? '🏆 VICTORY!' : `FINISHED ${ordinal}`;

    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 60,
      titleText,
      {
        fontSize: '32px',
        fontFamily: 'Press Start 2P, monospace',
        color: titleColor,
        stroke: '#000',
        strokeThickness: 4,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    const timeStr = (this.raceTime / 1000).toFixed(2) + 's';
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      `Time: ${timeStr}\nPosition: ${ordinal} of ${this.racers.length}`,
      {
        fontSize: '14px',
        fontFamily: 'Orbitron, sans-serif',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    // Restart / Back buttons
    const restartBtn = this.add.text(
      this.cameras.main.width / 2 - 80,
      this.cameras.main.height / 2 + 80,
      '↺ RESTART',
      {
        fontSize: '14px',
        fontFamily: 'Press Start 2P, monospace',
        color: '#00f0ff',
        backgroundColor: '#0a0a1a',
        padding: { x: 12, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerup', () => {
      this.scene.restart({
        raceConfig: this.raceConfig,
        spriteGrid: this.spriteGrid,
        spriteAssignments: this.spriteAssignments,
      });
    });

    const backBtn = this.add.text(
      this.cameras.main.width / 2 + 80,
      this.cameras.main.height / 2 + 80,
      '← BACK',
      {
        fontSize: '14px',
        fontFamily: 'Press Start 2P, monospace',
        color: '#ff007f',
        backgroundColor: '#0a0a1a',
        padding: { x: 12, y: 8 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(301).setInteractive({ useHandCursor: true });

    backBtn.on('pointerup', () => {
      // Post result back to opener if available
      const result = { position: pos, time: this.raceTime, won };
      if (window.opener) {
        window.opener.postMessage({ type: 'classicRaceResult', ...result }, window.location.origin);
        window.close();
      } else {
        window.location.href = this.raceConfig.returnUrl || '/arena/classic?tab=arcade';
      }
    });
  }
}
