import * as Phaser from 'phaser';
import { init } from '@instantdb/core';
import { INSTANT_DB_APP_ID } from './instant_db_config.js';
import {
    buildCyberJoustBodyTextureKey,
    buildCyberJoustWeaponTextureKey,
    CYBER_JOUST_SPRITE_MANIFEST_KEY,
    findCyberJoustBodySprite,
    findCyberJoustWeaponSprite
} from './fighterSprites.js';
import { DEFAULT_CYBER_JOUST_DISTRICT, getCyberJoustDistrict } from './districts.js';

const db = init({ appId: INSTANT_DB_APP_ID });

const CYBER_JOUST_COLORS_MAP = {
    'neon cyan': 0x00f0ff,
    'cyber pink': 0xff007f,
    'laser yellow': 0xffea00,
    'toxic green': 0x39ff14
};

const DEFAULT_COSMETICS = {
    colorName: 'Neon Cyan',
    color: 0x00f0ff,
    deck: 'Speedline',
    weapon: 'Crutch Lance'
};
const OCTAGON_SIDES = 8;
const RIDER_VISOR_WIDTH = 12.6;
const RIDER_VISOR_HEIGHT = 10.8;
const FLIP_VELOCITY_THRESHOLD = 300;
const CLASH_THRESHOLD = 48;
const BOUNCE_HEIGHT_MARGIN = 12;
const BACKDROP_ALPHA = 0.46;
const SKYLINE_TOWER_COUNT = 8;
const SKYLINE_BASE_OFFSET = 70;
const SKYLINE_TOWER_WIDTH_RATIO = 0.055;
const SKYLINE_TOWER_ALPHA = 0.38;
const SKYLINE_TOWER_MIN_HEIGHT_RATIO = 0.16;
const SKYLINE_TOWER_MAX_HEIGHT_RATIO = 0.36;
const BACKDROP_HORIZON_RATIO = 0.62;
const BACKDROP_NODE_COUNT = 18;
const BACKDROP_NODE_MIN_Y = 80;
const BACKDROP_NODE_MAX_HEIGHT_RATIO = 0.55;
const BOOST_RING_COOLDOWN_MS = 900;
const PLAYER_THRUST_COOLDOWN_MS = 520;
const BOT_THRUST_COOLDOWN_MS = 850;
const BOOST_RING_VELOCITY_DAMPEN = 0.35;
const AI_TIMER_BASE_MULTIPLIER = 1.1;
const AI_SKILL_TIMER_INFLUENCE = 0.45;
const AI_TIMER_MIN_MS = 520;
const AI_TIMER_MAX_MS = 1450;
const AI_TILT_DISTANCE_FACTOR = 140;
const AI_CHASE_X_JITTER = 42;
const AI_CHASE_Y_OFFSET_MIN = 36;
const AI_CHASE_Y_OFFSET_MAX = 92;
const AI_TARGET_MARGIN_X = 50;
const AI_TARGET_MIN_Y = 70;
const AI_TARGET_BOTTOM_MARGIN = 120;
const BOT_THRUST_HORIZONTAL_MIN = 150;
const BOT_THRUST_HORIZONTAL_MAX = 260;

function colorToHex(colorValue) {
    return `#${(colorValue >>> 0).toString(16).slice(-6).padStart(6, '0')}`;
}

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playersMap = {};
        this.bots = [];
        this.ramps = [];
        this.boostRings = [];
        this.myPlayerId = null;
        this.room = null;
        this.roomId = null;
        this.player = null;
        this.score = 0;
        this.lives = 5;
        this.isGameOver = false;
        this.steerLeft = false;
        this.steerRight = false;
        this.tiltDirection = null;
        this.lastPlayerThrustAt = -PLAYER_THRUST_COOLDOWN_MS;
        this.boostReadyTimer = null;
        this.myCosmetics = { ...DEFAULT_COSMETICS };
        this.district = DEFAULT_CYBER_JOUST_DISTRICT;
    }

    showBoostStatus(label, color, readyDelayMs = 0) {
        if (!this.boostText) {
            return;
        }
        this.boostText.setText(label);
        this.boostText.setColor(color);
        this.boostReadyTimer?.remove(false);
        this.boostReadyTimer = this.time.delayedCall(Math.max(0, readyDelayMs), () => {
            if (this.boostText?.active && !this.isGameOver) {
                this.boostText.setText('BOOST: READY');
                this.boostText.setColor('#39ff14');
            }
        });
    }

    init(data) {
        if (data && data.cosmetics) {
            this.myCosmetics = { ...DEFAULT_COSMETICS, ...data.cosmetics };
        } else {
            this.myCosmetics = { ...DEFAULT_COSMETICS };
        }
        const params = new URLSearchParams(window.location.search);
        this.district = getCyberJoustDistrict(data?.district || params.get('district'));

        this.score = 0;
        this.lives = 5;
        this.isGameOver = false;
        this.bots = [];
        this.playersMap = {};
        this.ramps = [];
        this.boostRings = [];
        this.steerLeft = false;
        this.steerRight = false;
        this.tiltDirection = null;
        this.lastPlayerThrustAt = -PLAYER_THRUST_COOLDOWN_MS;
        this.boostReadyTimer = null;
    }

    create() {
        const { width, height } = this.scale;

        this.bgImage = this.add.image(width / 2, height / 2, 'cyber-bg');
        this.bgImage.setDisplaySize(width, height).setTint(this.district.palette.sky);

        this.scale.on('resize', (gameSize) => {
            const { width: w, height: h } = gameSize;
            if (this.bgImage) {
                this.bgImage.setPosition(w / 2, h / 2);
                this.bgImage.setDisplaySize(w, h);
            }
        });

        const params = new URLSearchParams(window.location.search);
        this.roomId = params.get('room') || 'cyber-joust-lobby';
        if (!params.get('room') || params.get('district') !== this.district.slug) {
            window.history.replaceState({}, '', `?room=${this.roomId}&district=${this.district.slug}`);
        }

        this.setupSoundButton();
        this.createEnvironment(width, height);

        const uniqueSegment = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID().slice(0, 8)
            : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 12);
        this.myPlayerId = `rider_${uniqueSegment}`;
        this.player = this.spawnSkater(width / 4, height - 250, true, this.myPlayerId);
        this.player.name = 'You';
        this.player.cosmetics = { ...this.myCosmetics };
        this.updateSkaterVisuals(this.player);

        this.physics.add.collider(this.player, this.platforms);

        this.sparkEmitter = this.add.particles(0, 0, 'spark-dot', {
            speed: { min: 100, max: 300 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            blendMode: 'ADD',
            emitting: false
        });

        this.thrusterEmitter = this.add.particles(0, 0, 'spark-dot', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 400,
            blendMode: 'ADD',
            emitting: false
        });

        this.setupControls();
        this.joinMultiplayerRoom();
        this.spawnBots(this.district.botCount);
        this.createHUD();
    }

    createEnvironment(width, height) {
        this.platforms = this.physics.add.staticGroup();
        this.createDistrictBackdrop(width, height);

        this.district.platforms.forEach((platform) => {
            this.addPlatform(
                width * platform.x,
                height * platform.y,
                width * platform.w,
                platform.h,
                this.district.palette.platform,
                this.getDistrictColor(platform.stroke)
            );
        });

        this.district.ramps.forEach((ramp) => {
            this.createRamp(width * ramp.x, height * ramp.y, ramp.w, ramp.h, ramp.dir);
        });

        (this.district.boostRings || []).forEach((ring) => {
            this.createBoostRing(width * ring.x, height * ring.y, ring.r, ring.vx, ring.vy);
        });

        this.hazardY = height - 55;
        const hazardWidth = width * this.district.hazard.widthRatio;
        this.hazard = this.add.rectangle(width / 2, this.hazardY + 20, hazardWidth, 40, this.district.palette.hazard, this.district.hazard.alpha);
        this.physics.add.existing(this.hazard, true);

        this.hazardGrid = this.add.grid(width / 2, this.hazardY + 20, hazardWidth, 40, 20, 10, this.district.palette.hazard, 0.4, this.district.palette.secondary, 0.9);
        this.tweens.add({ targets: this.hazardGrid, alpha: 0.5, yoyo: true, repeat: -1, duration: 800 });
        this.add.text(width / 2, this.hazardY + 19, this.district.hazard.label, {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.6);
    }

    createDistrictBackdrop(width, height) {
        const palette = this.district.palette;
        this.add.rectangle(width / 2, height / 2, width, height, palette.sky, BACKDROP_ALPHA).setDepth(-2);
        this.add.rectangle(width / 2, height * BACKDROP_HORIZON_RATIO, width, 2, palette.accent, 0.32).setDepth(-1);

        for (let i = 0; i < 9; i++) {
            const y = height * 0.68 + i * 26;
            const line = this.add.rectangle(width / 2, y, width, 1, i % 2 ? palette.primary : palette.secondary, 0.12).setDepth(-1);
            this.tweens.add({
                targets: line,
                alpha: 0.28,
                duration: 1100 + i * 90,
                yoyo: true,
                repeat: -1
            });
        }

        for (let i = 0; i < SKYLINE_TOWER_COUNT; i++) {
            const x = (width / (SKYLINE_TOWER_COUNT + 1)) * (i + 1);
            const h = Phaser.Math.Between(
                Math.floor(height * SKYLINE_TOWER_MIN_HEIGHT_RATIO),
                Math.floor(height * SKYLINE_TOWER_MAX_HEIGHT_RATIO)
            );
            const tower = this.add.rectangle(
                x,
                height - SKYLINE_BASE_OFFSET - h / 2,
                width * SKYLINE_TOWER_WIDTH_RATIO,
                h,
                palette.platform,
                SKYLINE_TOWER_ALPHA
            ).setDepth(-1);
            tower.setStrokeStyle(1, i % 2 ? palette.primary : palette.secondary, 0.35);
            this.add.rectangle(x, height - SKYLINE_BASE_OFFSET - 18 - h, width * 0.04, 3, i % 2 ? palette.accent : palette.primary, 0.6).setDepth(-1);
        }

        const signText = this.district.backdrop?.label || this.district.name.toUpperCase();
        const sign = this.add.text(width * 0.08, height * 0.2, signText, {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#ffffff',
            backgroundColor: '#05050d',
            padding: { x: 8, y: 5 }
        }).setDepth(-1).setAlpha(0.78);
        sign.setStroke(colorToHex(palette.primary), 2);
        this.tweens.add({ targets: sign, alpha: 0.36, duration: 700, yoyo: true, repeat: -1 });

        const moon = this.add.circle(width * 0.86, height * 0.16, Math.min(width, height) * 0.045, palette.accent, 0.18).setDepth(-2);
        moon.setStrokeStyle(2, palette.secondary, 0.45);
        this.tweens.add({ targets: moon, scale: 1.16, alpha: 0.32, duration: 1800, yoyo: true, repeat: -1 });

        for (let i = 0; i < 5; i++) {
            const lane = this.add.rectangle(
                -width * 0.2,
                height * (0.24 + i * 0.06),
                width * 0.18,
                2,
                this.district.backdrop?.trafficColor || palette.primary,
                0.45
            ).setDepth(-1);
            this.tweens.add({
                targets: lane,
                x: width * 1.2,
                duration: 2200 + i * 360,
                delay: i * 280,
                repeat: -1
            });
        }

        for (let i = 0; i < BACKDROP_NODE_COUNT; i++) {
            const x = Phaser.Math.Between(20, width - 20);
            const maxNodeY = height * BACKDROP_NODE_MAX_HEIGHT_RATIO;
            const minNodeY = Math.min(BACKDROP_NODE_MIN_Y, maxNodeY);
            const y = Phaser.Math.Between(minNodeY, maxNodeY);
            const node = this.add.circle(x, y, Phaser.Math.Between(1, 3), i % 2 ? palette.primary : palette.secondary, 0.6).setDepth(-1);
            this.tweens.add({
                targets: node,
                alpha: 0.15,
                yoyo: true,
                repeat: -1,
                duration: Phaser.Math.Between(700, 1600)
            });
        }
    }

    addPlatform(x, y, width, height, fillColor, strokeColor) {
        const platform = this.add.rectangle(x, y, width, height, fillColor);
        platform.setStrokeStyle(3, strokeColor);
        this.add.rectangle(x, y - height / 2 - 4, width * 0.92, 3, strokeColor, 0.55);
        this.physics.add.existing(platform, true);
        this.platforms.add(platform);
        return platform;
    }

    createRamp(x, y, width, height, direction) {
        const graphics = this.add.graphics();
        graphics.fillStyle(this.district.palette.platform, 0.82);
        this.drawRampPath(graphics, x, y, width, height, direction);
        graphics.fillPath();
        graphics.lineStyle(6, this.district.palette.primary, 0.2);
        this.drawRampPath(graphics, x, y, width, height, direction);
        graphics.strokePath();
        graphics.lineStyle(3, this.district.palette.accent, 1);
        this.drawRampPath(graphics, x, y, width, height, direction);
        graphics.strokePath();

        const zoneX = direction === 'right' ? x - width / 2 : x + width / 2;
        const rampZone = this.add.zone(zoneX, y - height / 2, width, height);
        this.ramps.push({ zone: rampZone, direction, width, height });
    }

    createBoostRing(x, y, radius, vx, vy) {
        const graphics = this.add.graphics();
        graphics.lineStyle(8, this.district.palette.primary, 0.18);
        graphics.strokeCircle(x, y, radius);
        graphics.lineStyle(3, this.district.palette.accent, 0.95);
        graphics.strokeCircle(x, y, radius);
        graphics.lineStyle(2, this.district.palette.secondary, 0.65);
        graphics.strokeCircle(x, y, radius * 0.68);
        const marker = this.add.text(x, y, 'BOOST', {
            fontFamily: '"Press Start 2P"',
            fontSize: '7px',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.7);
        this.tweens.add({ targets: graphics, alpha: 0.48, duration: 700, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: marker, angle: 360, duration: 4200, repeat: -1 });
        this.tweens.add({ targets: marker, alpha: 0.28, duration: 650, yoyo: true, repeat: -1 });

        const zone = this.add.zone(x, y, radius * 2, radius * 2);
        this.boostRings.push({ graphics, marker, zone, radius, vx, vy });
    }

    drawRampPath(graphics, x, y, width, height, direction) {
        graphics.beginPath();
        if (direction === 'right') {
            graphics.moveTo(x - width, y);
            graphics.lineTo(x, y - height);
            graphics.lineTo(x, y);
        } else {
            graphics.moveTo(x, y);
            graphics.lineTo(x, y - height);
            graphics.lineTo(x + width, y);
        }
        graphics.closePath();
    }

    getDistrictColor(key) {
        return this.district.palette[key] ?? this.district.palette.primary;
    }

    spawnSkater(x, y, isPlayer, id) {
        const skater = this.add.container(x, y);
        this.physics.add.existing(skater);

        skater.body.setCollideWorldBounds(true);
        skater.body.setGravityY(this.district.gravityY);
        skater.body.setSize(50, 70);
        skater.body.setOffset(-25, -45);
        skater.body.setDragX(250);

        const board = this.add.rectangle(0, 15, 54, 8, 0x222233);
        board.setStrokeStyle(2, 0x00f0ff);

        const wheelL = this.add.circle(-18, 20, 5, 0xff007f);
        const wheelR = this.add.circle(18, 20, 5, 0xff007f);
        const deckAccent = this.add.rectangle(0, 12, 38, 2, 0xffea00);

        const bodyG = this.add.graphics();
        this.drawRider(bodyG, 0x00f0ff);
        const bodySprite = this.add.image(0, 0, 'spark-dot');
        bodySprite.setVisible(false);

        const weaponContainer = this.add.container(0, -10);
        const weaponSprite = this.add.image(0, 0, 'spark-dot');
        weaponSprite.setVisible(false);
        const weaponGraphics = this.add.graphics();
        weaponContainer.add(weaponSprite);
        weaponContainer.add(weaponGraphics);

        skater.add([bodySprite, board, wheelL, wheelR, deckAccent, bodyG, weaponContainer]);

        skater.isPlayer = isPlayer;
        skater.skaterId = id;
        skater.isLaunching = false;
        skater.isDazed = false;
        skater.facing = 'right';
        skater.weaponRotation = 0;
        skater.victoryFlips = 0;
        skater.lastBoostRingAt = -BOOST_RING_COOLDOWN_MS;
        skater.lastAiThrustAt = -BOT_THRUST_COOLDOWN_MS;
        skater.name = isPlayer ? 'You' : 'Rider';
        skater.cosmetics = { ...DEFAULT_COSMETICS };

        skater.bodyGraphics = bodyG;
        skater.bodySprite = bodySprite;
        skater.weaponGraphics = weaponGraphics;
        skater.weaponSprite = weaponSprite;
        skater.weaponContainer = weaponContainer;
        skater.wheels = [wheelL, wheelR];
        skater.deck = board;
        skater.deckAccent = deckAccent;

        this.updateSkaterVisuals(skater);
        return skater;
    }

    drawRider(g, primaryColor) {
        g.clear();

        g.lineStyle(7, primaryColor, 0.18);
        g.beginPath();
        g.moveTo(-8, 10);
        g.lineTo(-18, 21);
        g.lineTo(-25, 24);
        g.strokePath();
        g.lineStyle(3, primaryColor, 1);
        g.strokePath();

        g.lineStyle(7, 0xff007f, 0.18);
        g.beginPath();
        g.moveTo(2, 9);
        g.lineTo(13, 18);
        g.lineTo(24, 18);
        g.strokePath();
        g.lineStyle(3, 0xff007f, 1);
        g.strokePath();

        g.fillStyle(0x101023, 1);
        g.lineStyle(5, primaryColor, 0.2);
        g.beginPath();
        g.moveTo(-13, -4);
        g.lineTo(10, -10);
        g.lineTo(16, -31);
        g.lineTo(0, -37);
        g.lineTo(-10, -28);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.lineStyle(2, primaryColor, 1);
        g.strokePath();

        g.fillStyle(primaryColor, 0.28);
        g.beginPath();
        g.moveTo(1, -31);
        g.lineTo(10, -28);
        g.lineTo(6, -14);
        g.lineTo(-2, -12);
        g.closePath();
        g.fillPath();

        g.fillStyle(0x070711, 1);
        g.lineStyle(2, 0xff007f, 1);
        g.beginPath();
        g.moveTo(-10, -5);
        g.lineTo(8, -5);
        g.lineTo(5, 12);
        g.lineTo(-6, 12);
        g.closePath();
        g.fillPath();
        g.strokePath();

        g.lineStyle(6, 0xffea00, 0.18);
        g.beginPath();
        g.moveTo(9, -23);
        g.lineTo(24, -15);
        g.lineTo(29, -8);
        g.strokePath();
        g.lineStyle(2, 0xffea00, 1);
        g.strokePath();

        g.fillStyle(primaryColor, 1);
        g.fillCircle(8, -42, 9);
        g.fillStyle(0x05050d, 1);
        g.fillEllipse(11, -42, RIDER_VISOR_WIDTH, RIDER_VISOR_HEIGHT);
        g.fillStyle(0xffea00, 1);
        g.fillRect(10, -45, 8, 2);
    }

    updateSkaterVisuals(skater) {
        const color = skater.cosmetics?.color ?? DEFAULT_COSMETICS.color;
        const weaponType = skater.cosmetics?.weapon ?? DEFAULT_COSMETICS.weapon;
        const deckStyle = skater.cosmetics?.deck ?? DEFAULT_COSMETICS.deck;
        const spriteManifest = this.registry.get(CYBER_JOUST_SPRITE_MANIFEST_KEY);
        const bodyEntry = findCyberJoustBodySprite(spriteManifest, skater.cosmetics);
        const weaponEntry = findCyberJoustWeaponSprite(spriteManifest, skater.cosmetics);
        const bodyTextureKey = bodyEntry ? buildCyberJoustBodyTextureKey(bodyEntry.slug) : null;
        const weaponTextureKey = weaponEntry ? buildCyberJoustWeaponTextureKey(weaponEntry.slug) : null;
        const hasBodySprite = bodyTextureKey && this.textures.exists(bodyTextureKey);
        const hasWeaponSprite = weaponTextureKey && this.textures.exists(weaponTextureKey);

        skater.bodySprite?.setVisible(Boolean(hasBodySprite));
        if (hasBodySprite) {
            skater.bodySprite.setTexture(bodyTextureKey).setScale(1);
            skater.deck.setVisible(false);
            skater.deckAccent.setVisible(false);
            skater.wheels.forEach((wheel) => wheel.setVisible(false));
            skater.bodyGraphics.setVisible(false);
        } else {
            skater.deck.setVisible(true);
            skater.deckAccent.setVisible(true);
            skater.wheels.forEach((wheel) => wheel.setVisible(true));
            skater.bodyGraphics.setVisible(true);
            this.drawRider(skater.bodyGraphics, color);
        }

        if (!hasBodySprite && deckStyle === 'Speedline') {
            skater.deck.setStrokeStyle(2, color);
            skater.wheels.forEach((wheel) => wheel.setFillStyle(0xff007f));
            skater.deckAccent.setFillStyle(0xffea00);
        } else if (!hasBodySprite && deckStyle === 'Gridwave') {
            skater.deck.setStrokeStyle(2, 0xff007f);
            skater.wheels.forEach((wheel) => wheel.setFillStyle(0x00f0ff));
            skater.deckAccent.setFillStyle(color);
        } else if (!hasBodySprite && deckStyle === 'ToxiCorp') {
            skater.deck.setStrokeStyle(2, 0x39ff14);
            skater.wheels.forEach((wheel) => wheel.setFillStyle(0xffea00));
            skater.deckAccent.setFillStyle(0xff0055);
        } else if (!hasBodySprite) {
            skater.deck.setStrokeStyle(2, 0xffea00);
            skater.wheels.forEach((wheel) => wheel.setFillStyle(0x9d00ff));
            skater.deckAccent.setFillStyle(0x00f0ff);
        }

        const wg = skater.weaponGraphics;
        skater.weaponSprite?.setVisible(Boolean(hasWeaponSprite));
        if (hasWeaponSprite) {
            skater.weaponSprite.setTexture(weaponTextureKey).setScale(1);
            wg.clear();
            wg.setVisible(false);
        } else {
            wg.setVisible(true);
            wg.clear();
            wg.lineStyle(3, color, 1);
            wg.fillStyle(0x1a1a2e, 1);

            if (weaponType === 'Hockey Stick') {
                wg.lineStyle(9, color, 0.18);
                wg.beginPath();
                wg.moveTo(-23, -13);
                wg.lineTo(16, 4);
                wg.lineTo(31, -2);
                wg.strokePath();
                wg.lineStyle(5, color, 1);
                wg.strokePath();
                wg.lineStyle(2, 0xffffff, 0.45);
                wg.strokePath();
                wg.lineStyle(2, 0xff007f, 1);
                wg.lineBetween(-1, -4, 18, 4);
                wg.fillStyle(0xff007f, 1);
                wg.fillCircle(5, -2, 3.2);
                wg.fillCircle(19, 3, 3.2);
                wg.fillStyle(0x05050c, 1);
                wg.fillCircle(5, -2, 1.4);
                wg.fillCircle(19, 3, 1.4);
            } else if (weaponType === 'Street Sign') {
                wg.lineStyle(7, 0xcfd7df, 0.22);
                wg.lineBetween(-25, -5, 11, -5);
                wg.lineStyle(4, 0xcfd7df, 1);
                wg.lineBetween(-25, -5, 11, -5);
                wg.lineStyle(6, 0xff0055, 0.2);
                wg.fillStyle(0x9c0037, 1);
                wg.beginPath();
                const signX = 20;
                const signY = -5;
                const radius = 14;
                for (let i = 0; i < OCTAGON_SIDES; i++) {
                    const angle = (i * Math.PI) / (OCTAGON_SIDES / 2);
                    const px = signX + radius * Math.cos(angle);
                    const py = signY + radius * Math.sin(angle);
                    if (i === 0) {
                        wg.moveTo(px, py);
                    } else {
                        wg.lineTo(px, py);
                    }
                }
                wg.closePath();
                wg.fillPath();
                wg.strokePath();
                wg.lineStyle(3, 0xff0055, 1);
                wg.strokePath();
                wg.fillStyle(0xffffff, 1);
                wg.fillRect(signX - 8, signY - 2, 16, 4);
                wg.fillStyle(color, 1);
                wg.fillRect(signX - 4, signY - 10, 8, 3);
            } else {
                wg.lineStyle(8, color, 0.18);
                wg.lineBetween(-23, -5, 17, -5);
                wg.lineBetween(-23, -14, 4, -5);
                wg.lineBetween(-23, 4, 4, -5);
                wg.lineStyle(3, color, 1);
                wg.lineBetween(-23, -5, 17, -5);
                wg.lineBetween(-23, -14, 4, -5);
                wg.lineBetween(-23, 4, 4, -5);
                wg.fillStyle(0xff007f, 1);
                wg.beginPath();
                wg.moveTo(-26, -17);
                wg.lineTo(-14, -13);
                wg.lineTo(-14, 3);
                wg.lineTo(-26, 7);
                wg.closePath();
                wg.fillPath();
                wg.lineStyle(2, 0xffea00, 1);
                wg.beginPath();
                wg.moveTo(8, -5);
                wg.lineTo(14, -11);
                wg.lineTo(21, 0);
                wg.lineTo(27, -5);
                wg.lineTo(32, -5);
                wg.strokePath();
                wg.fillStyle(color, 1);
                wg.fillCircle(32, -5, 3.5);
                wg.fillStyle(0x05050c, 1);
                wg.fillCircle(32, -5, 1.4);
            }
        }
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            thrust: Phaser.Input.Keyboard.KeyCodes.SPACE,
            thrustAlt: Phaser.Input.Keyboard.KeyCodes.SHIFT,
            tiltUp: Phaser.Input.Keyboard.KeyCodes.W,
            tiltDown: Phaser.Input.Keyboard.KeyCodes.S,
            tiltUpAlt: Phaser.Input.Keyboard.KeyCodes.Q,
            tiltDownAlt: Phaser.Input.Keyboard.KeyCodes.E,
            leftAlt: Phaser.Input.Keyboard.KeyCodes.A,
            rightAlt: Phaser.Input.Keyboard.KeyCodes.D,
            brake: Phaser.Input.Keyboard.KeyCodes.CTRL
        });

        const { width, height } = this.scale;
        this.createMobileControls(width, height);
    }

    createMobileControls(width, height) {
        this.mobileControls = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
        const btnRadius = 40;
        const btnY = height - 85;

        const btnLeft = this.add.circle(60, btnY, btnRadius, 0x111122, 0.75);
        btnLeft.setStrokeStyle(3, 0x00f0ff);
        const leftTxt = this.add.text(60, btnY, '◀', { fontSize: '24px', color: '#00f0ff' }).setOrigin(0.5);
        this.makeInteractive(btnLeft, () => {
            this.steerLeft = true;
        }, () => {
            this.steerLeft = false;
        });

        const btnRight = this.add.circle(160, btnY, btnRadius, 0x111122, 0.75);
        btnRight.setStrokeStyle(3, 0x00f0ff);
        const rightTxt = this.add.text(160, btnY, '▶', { fontSize: '24px', color: '#00f0ff' }).setOrigin(0.5);
        this.makeInteractive(btnRight, () => {
            this.steerRight = true;
        }, () => {
            this.steerRight = false;
        });

        const btnThrust = this.add.circle(width - 70, btnY - 20, btnRadius + 10, 0x111122, 0.75);
        btnThrust.setStrokeStyle(4, 0xff007f);
        const thrustTxt = this.add.text(width - 70, btnY - 20, 'BOOST', {
            fontFamily: '"Press Start 2P"',
            fontSize: '13px',
            color: '#ff007f'
        }).setOrigin(0.5);
        this.makeInteractive(btnThrust, () => {
            this.triggerThrust();
        }, null, true);

        const btnTiltUp = this.add.circle(width - 180, btnY - 45, btnRadius - 5, 0x111122, 0.75);
        btnTiltUp.setStrokeStyle(2, 0xffea00);
        const tiltUpTxt = this.add.text(width - 180, btnY - 45, '▲ TILT', { fontSize: '14px', color: '#ffea00' }).setOrigin(0.5);
        this.makeInteractive(btnTiltUp, () => {
            this.tiltLance('up');
        }, () => {
            this.stopTilt();
        });

        const btnTiltDown = this.add.circle(width - 180, btnY + 25, btnRadius - 5, 0x111122, 0.75);
        btnTiltDown.setStrokeStyle(2, 0xffea00);
        const tiltDownTxt = this.add.text(width - 180, btnY + 25, '▼ TILT', { fontSize: '14px', color: '#ffea00' }).setOrigin(0.5);
        this.makeInteractive(btnTiltDown, () => {
            this.tiltLance('down');
        }, () => {
            this.stopTilt();
        });

        this.mobileControls.add([btnLeft, leftTxt, btnRight, rightTxt, btnThrust, thrustTxt, btnTiltUp, tiltUpTxt, btnTiltDown, tiltDownTxt]);

        const desktopInstructions = this.add.text(width / 2, 45, 'ARROWS/A-D: SKATE  SPACE/SHIFT: BOOST  W-S/Q-E: TILT  DOWN/CTRL: BRAKE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.65).setDepth(99);

        this.scale.on('resize', (gameSize) => {
            const { width: w, height: h } = gameSize;
            btnThrust.setPosition(w - 70, h - 105);
            thrustTxt.setPosition(w - 70, h - 105);
            btnTiltUp.setPosition(w - 180, h - 130);
            tiltUpTxt.setPosition(w - 180, h - 130);
            btnTiltDown.setPosition(w - 180, h - 60);
            tiltDownTxt.setPosition(w - 180, h - 60);
            btnLeft.setPosition(60, h - 85);
            leftTxt.setPosition(60, h - 85);
            btnRight.setPosition(160, h - 85);
            rightTxt.setPosition(160, h - 85);
            desktopInstructions.setPosition(w / 2, 45);
        });
    }

    makeInteractive(buttonShape, onDown, onUp, tapOnly = false) {
        buttonShape.setInteractive(new Phaser.Geom.Circle(0, 0, buttonShape.radius), Phaser.Geom.Circle.Contains);
        buttonShape.input.cursor = 'pointer';
        buttonShape.on('pointerdown', () => {
            buttonShape.setScale(0.9);
            buttonShape.setAlpha(1);
            if (onDown) {
                onDown();
            }
        });

        if (!tapOnly) {
            buttonShape.on('pointerup', () => {
                buttonShape.setScale(1);
                buttonShape.setAlpha(0.75);
                if (onUp) {
                    onUp();
                }
            });
            buttonShape.on('pointerout', () => {
                buttonShape.setScale(1);
                buttonShape.setAlpha(0.75);
                if (onUp) {
                    onUp();
                }
            });
        } else {
            buttonShape.on('pointerup', () => {
                buttonShape.setScale(1);
                buttonShape.setAlpha(0.75);
            });
        }
    }

    triggerThrust() {
        if (this.isGameOver || !this.player || this.player.isDazed) {
            return;
        }

        const elapsedSinceThrust = this.time.now - this.lastPlayerThrustAt;
        if (elapsedSinceThrust < PLAYER_THRUST_COOLDOWN_MS) {
            const remainingCooldown = PLAYER_THRUST_COOLDOWN_MS - elapsedSinceThrust;
            this.showBoostStatus('BOOST: WAIT', '#ff0055', remainingCooldown);
            return;
        }
        this.lastPlayerThrustAt = this.time.now;

        const speed = this.getWeaponThrustSpeed(this.myCosmetics.weapon) * this.district.thrustMultiplier;
        const upForce = -240;
        const horizForce = this.player.facing === 'right' ? speed * 0.75 : -speed * 0.75;

        this.player.body.setVelocityY(upForce);
        this.player.body.setVelocityX(this.player.body.velocity.x + horizForce);
        this.playSfx('sfx-boost', 0.55);

        const flareX = this.player.x + (this.player.facing === 'right' ? -25 : 25);
        const flareY = this.player.y + 15;
        this.thrusterEmitter?.emitParticleAt(flareX, flareY, 15);
        this.showBoostStatus('BOOST: CHARGING', '#00f0ff', PLAYER_THRUST_COOLDOWN_MS);

        if (Math.abs(this.player.body.velocity.x) > FLIP_VELOCITY_THRESHOLD) {
            this.tweens.add({
                targets: this.player,
                angle: this.player.facing === 'right' ? 360 : -360,
                duration: 500,
                onComplete: () => {
                    this.player.angle = 0;
                    this.player.victoryFlips++;
                }
            });
        }
    }

    tiltLance(dir) {
        this.tiltDirection = dir;
    }

    stopTilt() {
        this.tiltDirection = null;
    }

    joinMultiplayerRoom() {
        try {
            this.room = db.joinRoom('cyber-joust-game', this.roomId);
            this.room.publishPresence({
                id: this.myPlayerId,
                name: this.myCosmetics.colorName + ' Rider',
                x: this.player.x,
                y: this.player.y,
                vx: 0,
                vy: 0,
                score: this.score,
                lives: this.lives,
                facing: this.player.facing,
                weaponRotation: this.player.weaponRotation,
                cosmetics: this.myCosmetics,
                isDazed: false
            });

            this.room.subscribePresence({}, (data) => {
                const peers = data?.peers || {};

                Object.entries(peers).forEach(([peerId, remoteData]) => {
                    if (remoteData && remoteData.id) {
                        this.updateRemotePlayer(peerId, remoteData);
                    }
                });

                const currentPeerIds = Object.keys(peers);
                Object.keys(this.playersMap).forEach((peerId) => {
                    if (!currentPeerIds.includes(peerId)) {
                        this.playersMap[peerId].destroy();
                        delete this.playersMap[peerId];
                    }
                });

                this.updateRoomCount();
            });

            this.room.subscribeTopic('game_clash', (event) => {
                this.triggerClashVFX(event.x, event.y, event.intensity);
            });
        } catch (error) {
            console.error('InstantDB connection failed. Running in solo-bot fallback mode.', error);
        }
    }

    updateRemotePlayer(peerId, data) {
        if (peerId === this.myPlayerId) {
            return;
        }

        let remoteRider = this.playersMap[peerId];

        if (!remoteRider) {
            remoteRider = this.spawnSkater(data.x, data.y, false, peerId);
            remoteRider.name = data.name || 'Remote Rider';
            remoteRider.cosmetics = { ...DEFAULT_COSMETICS, ...(data.cosmetics || {}) };
            this.updateSkaterVisuals(remoteRider);
            this.physics.add.collider(remoteRider, this.platforms);
            this.playersMap[peerId] = remoteRider;
        }

        remoteRider.setPosition(data.x, data.y);
        remoteRider.body.setVelocity(data.vx || 0, data.vy || 0);

        if (data.facing !== remoteRider.facing) {
            remoteRider.facing = data.facing;
            remoteRider.setScale(data.facing === 'left' ? -1 : 1, 1);
        }

        remoteRider.weaponRotation = data.weaponRotation || 0;
        remoteRider.weaponContainer.setRotation(remoteRider.weaponRotation);
        remoteRider.isDazed = Boolean(data.isDazed);
        remoteRider.setAlpha(remoteRider.isDazed ? 0.4 : 1);
    }

    spawnBots(count) {
        const botNames = ['CyberGrip', 'GigaSkate', 'NeonLance', 'RampFiend', 'OnyxRider'];
        const weaponOptions = ['Hockey Stick', 'Street Sign', 'Crutch Lance'];
        const colorOptions = [
            { name: 'Cyber Pink', value: 0xff007f },
            { name: 'Laser Yellow', value: 0xffea00 },
            { name: 'Toxic Green', value: 0x39ff14 },
            { name: 'Neon Cyan', value: 0x00f0ff }
        ];

        const spriteManifest = this.registry.get(CYBER_JOUST_SPRITE_MANIFEST_KEY);
        const manifestFighters = Array.isArray(spriteManifest?.fighters) ? spriteManifest.fighters : [];

        for (let i = 0; i < count; i++) {
            const rx = Phaser.Math.Between(100, this.scale.width - 100);
            const ry = Phaser.Math.Between(100, this.scale.height - 300);
            const bot = this.spawnSkater(rx, ry, false, 'bot_' + i);

            if (manifestFighters.length > 0) {
                const fighter = manifestFighters[i % manifestFighters.length];
                bot.name = fighter.name || botNames[i % botNames.length];
                const randColor = colorOptions[i % colorOptions.length];
                const fighterColor = fighter.colorName
                    ? (CYBER_JOUST_COLORS_MAP[fighter.colorName.toLowerCase()] || randColor.value)
                    : randColor.value;
                bot.cosmetics = {
                    colorName: fighter.colorName || randColor.name,
                    color: fighterColor,
                    deck: fighter.deck || 'Gridwave',
                    weapon: fighter.weapon || weaponOptions[i % weaponOptions.length]
                };
            } else {
                bot.name = botNames[i % botNames.length];
                const randIdx = Phaser.Math.Between(0, colorOptions.length - 1);
                const chosen = colorOptions[randIdx];
                bot.cosmetics = {
                    colorName: chosen.name,
                    color: chosen.value,
                    deck: 'Gridwave',
                    weapon: weaponOptions[i % weaponOptions.length]
                };
            }

            this.updateSkaterVisuals(bot);
            bot.aiTimer = 0;
            bot.aiTargetX = Phaser.Math.Between(100, this.scale.width - 100);
            bot.aiTargetY = Phaser.Math.Between(100, Math.max(160, this.scale.height - 240));
            bot.aiSkill = Phaser.Math.Clamp((this.district.botSkill || 0.6) + Phaser.Math.FloatBetween(-0.08, 0.08), 0.45, 0.9);
            bot.aiAggression = Phaser.Math.Clamp((this.district.botChaseProbability || 60) / 100 + Phaser.Math.FloatBetween(-0.1, 0.1), 0.35, 0.95);
            this.physics.add.collider(bot, this.platforms);
            this.bots.push(bot);
        }

        this.updateRoomCount();
    }

    update(_time, delta) {
        if (this.isGameOver) {
            return;
        }

        this.handlePlayerMovement();
        this.checkRampLaunches(this.player);
        this.checkBoostRings(this.player);
        this.handleBotsAI(delta);
        this.checkJoustClashes();
        this.checkHazardFalls();
        this.syncNetworkPresence();
    }

    handlePlayerMovement() {
        if (!this.player) {
            return;
        }

        if (this.player.isDazed) {
            this.player.setAlpha(0.4);
            return;
        }

        this.player.setAlpha(1);
        const body = this.player.body;
        const acceleration = this.myCosmetics.weapon === 'Street Sign' ? 220 : 310;

        if (this.cursors.left.isDown || this.steerLeft || this.keys.leftAlt.isDown) {
            body.setAccelerationX(-acceleration);
            if (this.player.facing !== 'left') {
                this.player.facing = 'left';
                this.player.setScale(-1, 1);
            }
        } else if (this.cursors.right.isDown || this.steerRight || this.keys.rightAlt.isDown) {
            body.setAccelerationX(acceleration);
            if (this.player.facing !== 'right') {
                this.player.facing = 'right';
                this.player.setScale(1, 1);
            }
        } else {
            body.setAccelerationX(0);
        }

        if (this.cursors.down.isDown || this.keys.brake.isDown) {
            body.setVelocityX(body.velocity.x * 0.88);
        }

        if (
            Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
            Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
            Phaser.Input.Keyboard.JustDown(this.keys.thrust) ||
            Phaser.Input.Keyboard.JustDown(this.keys.thrustAlt)
        ) {
            this.triggerThrust();
        }

        const tiltSpeed = 0.04;
        const maxTilt = 0.6;

        if (this.keys.tiltUp.isDown || this.keys.tiltUpAlt.isDown || this.tiltDirection === 'up') {
            this.player.weaponRotation = Phaser.Math.Clamp(this.player.weaponRotation - tiltSpeed, -maxTilt, maxTilt);
        } else if (this.keys.tiltDown.isDown || this.keys.tiltDownAlt.isDown || this.tiltDirection === 'down') {
            this.player.weaponRotation = Phaser.Math.Clamp(this.player.weaponRotation + tiltSpeed, -maxTilt, maxTilt);
        } else {
            this.player.weaponRotation *= 0.95;
        }

        this.player.weaponContainer.setRotation(this.player.weaponRotation);

        const margin = 30;
        if (this.player.x < -margin) {
            this.player.x = this.scale.width + margin;
        } else if (this.player.x > this.scale.width + margin) {
            this.player.x = -margin;
        }
    }

    checkRampLaunches(skater) {
        if (!skater || !skater.body) {
            return;
        }

        const skaterBounds = skater.getBounds();
        this.ramps.forEach((ramp) => {
            const rampBounds = ramp.zone.getBounds();
            const touchingRamp = Phaser.Geom.Intersects.RectangleToRectangle(skaterBounds, rampBounds);
            const velX = skater.body.velocity.x;
            const isGoingCorrectWay = (ramp.direction === 'right' && velX > 50) || (ramp.direction === 'left' && velX < -50);

            if (touchingRamp && isGoingCorrectWay && !skater.isLaunching) {
                skater.isLaunching = true;
                const launchLift = Math.min(-380, -Math.abs(velX) * 1.3);
                skater.body.setVelocityY(launchLift);
                skater.body.setVelocityX(velX * 1.5);

                this.playSfx('sfx-boost', 0.6);
                this.sparkEmitter?.emitParticleAt(skater.x, skater.y, 20);

                this.tweens.add({
                    targets: skater,
                    angle: ramp.direction === 'right' ? 30 : -30,
                    duration: 150,
                    yoyo: true,
                    repeat: 0,
                    onComplete: () => {
                        skater.angle = 0;
                    }
                });

                this.time.delayedCall(500, () => {
                    skater.isLaunching = false;
                });
            }
        });
    }

    checkBoostRings(skater) {
        if (!skater || !skater.body || skater.isDazed) {
            return;
        }

        this.boostRings.forEach((ring) => {
            const distance = Phaser.Math.Distance.Between(skater.x, skater.y, ring.zone.x, ring.zone.y);
            const canTrigger = this.time.now - skater.lastBoostRingAt >= BOOST_RING_COOLDOWN_MS;
            if (distance > ring.radius + 24 || !canTrigger) {
                return;
            }

            skater.lastBoostRingAt = this.time.now;
            skater.body.setVelocityX(skater.body.velocity.x * BOOST_RING_VELOCITY_DAMPEN + ring.vx);
            skater.body.setVelocityY(ring.vy);
            this.sparkEmitter?.emitParticleAt(ring.zone.x, ring.zone.y, 22);
            this.playSfx('sfx-boost', skater === this.player ? 0.7 : 0.35);
            this.tweens.add({
                targets: ring.marker,
                scale: 1.18,
                alpha: 1,
                duration: 120,
                yoyo: true
            });
            if (skater === this.player) {
                this.showFeedbackText(ring.zone.x, ring.zone.y - ring.radius - 12, 'RING BOOST!', '#39ff14');
            }
        });
    }

    findNearestBoostRing(skater) {
        if (!this.boostRings.length) {
            return null;
        }

        return this.boostRings.reduce((nearest, ring) => {
            const distance = Phaser.Math.Distance.Between(skater.x, skater.y, ring.zone.x, ring.zone.y);
            if (!nearest || distance < nearest.distance) {
                return { ring, distance };
            }
            return nearest;
        }, null)?.ring || null;
    }

    handleBotsAI(delta) {
        this.bots.forEach((bot) => {
            if (bot.isDazed) {
                bot.setAlpha(0.4);
                return;
            }

            bot.setAlpha(1);
            bot.aiTimer -= delta;
            if (bot.aiTimer <= 0) {
                bot.aiTimer = Phaser.Math.Between(AI_TIMER_MIN_MS, AI_TIMER_MAX_MS) * (AI_TIMER_BASE_MULTIPLIER - bot.aiSkill * AI_SKILL_TIMER_INFLUENCE);
                const playerIsVulnerable = this.player.y > bot.y + 20 || this.player.isDazed;
                const chasePlayer = Phaser.Math.FloatBetween(0, 1) < bot.aiAggression || playerIsVulnerable;
                const nearestRing = this.findNearestBoostRing(bot);
                const wantsRing = nearestRing && Phaser.Math.FloatBetween(0, 1) < bot.aiSkill * 0.45;

                if (wantsRing) {
                    bot.aiTargetX = nearestRing.zone.x;
                    bot.aiTargetY = nearestRing.zone.y;
                } else if (chasePlayer) {
                    bot.aiTargetX = Phaser.Math.Clamp(
                        this.player.x + Phaser.Math.Between(-AI_CHASE_X_JITTER, AI_CHASE_X_JITTER),
                        AI_TARGET_MARGIN_X,
                        this.scale.width - AI_TARGET_MARGIN_X
                    );
                    bot.aiTargetY = Phaser.Math.Clamp(
                        this.player.y - Phaser.Math.Between(AI_CHASE_Y_OFFSET_MIN, AI_CHASE_Y_OFFSET_MAX),
                        AI_TARGET_MIN_Y,
                        this.scale.height - AI_TARGET_BOTTOM_MARGIN
                    );
                } else {
                    bot.aiTargetX = Phaser.Math.Between(AI_TARGET_MARGIN_X, this.scale.width - AI_TARGET_MARGIN_X);
                    bot.aiTargetY = Phaser.Math.Between(80, Math.max(120, this.scale.height - 260));
                }

                const lowAltitude = bot.y > this.scale.height - 170;
                const belowTarget = bot.y > bot.aiTargetY + 36;
                const canThrust = this.time.now - bot.lastAiThrustAt >= BOT_THRUST_COOLDOWN_MS;
                const shouldThrust = canThrust && (
                    lowAltitude ||
                    belowTarget ||
                    (bot.y > this.player.y && Phaser.Math.FloatBetween(0, 1) < bot.aiSkill)
                );
                if (shouldThrust) {
                    bot.lastAiThrustAt = this.time.now;
                    const upForce = lowAltitude ? -310 : -250;
                    const targetDir = bot.aiTargetX >= bot.x ? 1 : -1;
                    const horiz = targetDir * Phaser.Math.Between(BOT_THRUST_HORIZONTAL_MIN, BOT_THRUST_HORIZONTAL_MAX);
                    bot.body.setVelocityY(upForce);
                    bot.body.setVelocityX(bot.body.velocity.x * 0.4 + horiz);
                    if (Phaser.Math.Between(0, 10) < 3) {
                        this.thrusterEmitter?.emitParticleAt(bot.x, bot.y + 15, 6);
                    }
                }
            }

            const acceleration = 220 + bot.aiSkill * 120;
            if (bot.x < bot.aiTargetX - 20) {
                bot.body.setAccelerationX(acceleration);
                if (bot.facing !== 'right') {
                    bot.facing = 'right';
                    bot.setScale(1, 1);
                }
            } else if (bot.x > bot.aiTargetX + 20) {
                bot.body.setAccelerationX(-acceleration);
                if (bot.facing !== 'left') {
                    bot.facing = 'left';
                    bot.setScale(-1, 1);
                }
            } else {
                bot.body.setAccelerationX(0);
            }

            const desiredTilt = Phaser.Math.Clamp((this.player.y - bot.y) / AI_TILT_DISTANCE_FACTOR, -0.55, 0.55);
            bot.weaponRotation = Phaser.Math.Linear(bot.weaponRotation, desiredTilt, 0.045 + bot.aiSkill * 0.04);
            bot.weaponContainer.setRotation(bot.weaponRotation);

            this.checkRampLaunches(bot);
            this.checkBoostRings(bot);

            const margin = 30;
            if (bot.x < -margin) {
                bot.x = this.scale.width + margin;
            } else if (bot.x > this.scale.width + margin) {
                bot.x = -margin;
            }
        });
    }

    checkJoustClashes() {
        const activeOpponents = [...this.bots, ...Object.values(this.playersMap)];
        activeOpponents.forEach((opponent) => {
            if (opponent.isDazed || this.player.isDazed) {
                return;
            }

            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, opponent.x, opponent.y);
            if (dist < CLASH_THRESHOLD) {
                const heightDiff = opponent.y - this.player.y;
                if (Math.abs(heightDiff) < BOUNCE_HEIGHT_MARGIN) {
                    this.executeJoustBounce(this.player, opponent);
                } else if (heightDiff > 0) {
                    this.executeJoustVictory(this.player, opponent);
                } else {
                    this.executeJoustVictory(opponent, this.player);
                }
            }
        });

        for (let i = 0; i < this.bots.length; i++) {
            for (let j = i + 1; j < this.bots.length; j++) {
                const b1 = this.bots[i];
                const b2 = this.bots[j];
                if (b1.isDazed || b2.isDazed) {
                    continue;
                }

                const dist = Phaser.Math.Distance.Between(b1.x, b1.y, b2.x, b2.y);
                if (dist < CLASH_THRESHOLD) {
                    const heightDiff = b2.y - b1.y;
                    if (Math.abs(heightDiff) < BOUNCE_HEIGHT_MARGIN) {
                        this.executeJoustBounce(b1, b2);
                    } else if (heightDiff > 0) {
                        this.executeJoustVictory(b1, b2);
                    } else {
                        this.executeJoustVictory(b2, b1);
                    }
                }
            }
        }
    }

    executeJoustBounce(rider1, rider2) {
        const pushForce = 340;
        const dir = rider1.x < rider2.x ? -1 : 1;
        rider1.body.setVelocityX(dir * pushForce);
        rider2.body.setVelocityX(-dir * pushForce);
        rider1.body.setVelocityY(-150);
        rider2.body.setVelocityY(-150);

        this.playSfx('sfx-clash', 0.65);
        this.triggerClashVFX((rider1.x + rider2.x) / 2, (rider1.y + rider2.y) / 2, 'medium');
        this.flashRider(rider1);
        this.flashRider(rider2);

        if (this.room) {
            this.room.publishTopic('game_clash', {
                x: (rider1.x + rider2.x) / 2,
                y: (rider1.y + rider2.y) / 2,
                intensity: 'medium'
            });
        }
    }

    executeJoustVictory(winner, loser) {
        this.playSfx('sfx-clash', 1.0);
        this.triggerClashVFX(loser.x, loser.y, 'heavy');

        if (winner === this.player) {
            const points = this.district.scoreBonus;
            this.score += points;
            this.scoreText?.setText('SCORE: ' + this.score);
            this.showFeedbackText(loser.x, loser.y - 40, `+${points}`, '#00f0ff');
        } else if (loser === this.player) {
            this.lives = Math.max(0, this.lives - 1);
            this.livesText?.setText('LIVES: ' + '⚡'.repeat(this.lives));
            this.showFeedbackText(loser.x, loser.y - 40, 'CRASHED!', '#ff0055');
            this.cameras.main.shake(200, 0.012);
            if (this.lives <= 0) {
                this.triggerGameOver();
            }
        }

        loser.isDazed = true;
        loser.body.setVelocity(0, 0);
        loser.body.setAccelerationX(0);
        loser.setAlpha(0.35);
        this.flashRider(loser);

        if (winner?.body) {
            winner.body.setVelocityY(-220);
            winner.body.setVelocityX(winner.body.velocity.x * 0.85);
        }

        if (this.room) {
            this.room.publishTopic('game_clash', {
                x: loser.x,
                y: loser.y,
                intensity: 'heavy'
            });
        }

        this.time.delayedCall(1200, () => {
            this.recoverRider(loser);
        });
    }

    recoverRider(rider) {
        if (!rider || !rider.active || !rider.scene) {
            return;
        }

        rider.isDazed = false;
        rider.setAlpha(1);
        rider.angle = 0;
        rider.weaponRotation = 0;
        rider.weaponContainer?.setRotation(0);

        const spawnX = Phaser.Math.Between(120, this.scale.width - 120);
        const spawnY = Phaser.Math.Between(120, Math.max(160, this.scale.height * 0.45));
        rider.setPosition(spawnX, spawnY);
        rider.body.setVelocity(0, 0);
    }

    checkHazardFalls() {
        const riders = [this.player, ...this.bots, ...Object.values(this.playersMap)];
        riders.forEach((rider) => {
            if (!rider || rider.isDazed) {
                return;
            }

            const hitHazard = rider.y >= this.hazardY || Phaser.Geom.Intersects.RectangleToRectangle(rider.getBounds(), this.hazard.getBounds());
            if (!hitHazard) {
                return;
            }

            rider.isDazed = true;
            rider.body.setVelocity(0, -120);
            rider.body.setAccelerationX(0);
            this.triggerClashVFX(rider.x, this.hazardY, 'light');

            if (rider === this.player) {
                this.lives = Math.max(0, this.lives - 1);
                this.livesText?.setText('LIVES: ' + '⚡'.repeat(this.lives));
                this.showFeedbackText(rider.x, rider.y - 30, 'VOID!', '#ff0055');
                if (this.lives <= 0) {
                    this.triggerGameOver();
                    return;
                }
            }

            this.time.delayedCall(800, () => {
                this.recoverRider(rider);
            });
        });
    }

    syncNetworkPresence() {
        if (!this.room || !this.player) {
            return;
        }

        this.room.publishPresence({
            id: this.myPlayerId,
            name: this.player.name,
            x: Number(this.player.x.toFixed(1)),
            y: Number(this.player.y.toFixed(1)),
            vx: Number(this.player.body.velocity.x.toFixed(1)),
            vy: Number(this.player.body.velocity.y.toFixed(1)),
            score: this.score,
            lives: this.lives,
            facing: this.player.facing,
            weaponRotation: Number(this.player.weaponRotation.toFixed(3)),
            cosmetics: this.myCosmetics,
            isDazed: this.player.isDazed
        });
    }

    createHUD() {
        this.scoreText = this.add.text(24, 20, 'SCORE: 0', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            color: '#00f0ff'
        }).setScrollFactor(0).setDepth(120);

        this.livesText = this.add.text(24, 44, 'LIVES: ' + '⚡'.repeat(this.lives), {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            color: '#ffea00'
        }).setScrollFactor(0).setDepth(120);

        this.add.text(24, 68, 'DISTRICT: ' + this.district.name.toUpperCase(), {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#ffffff'
        }).setScrollFactor(0).setDepth(120);

        this.boostText = this.add.text(24, 90, 'BOOST: READY', {
            fontFamily: '"Press Start 2P"',
            fontSize: '9px',
            color: '#39ff14'
        }).setScrollFactor(0).setDepth(120);

        this.roomText = this.add.text(this.scale.width - 24, 20, 'ROOM: ' + this.roomId, {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#ffffff',
            align: 'right'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(120);

        this.opponentsText = this.add.text(this.scale.width - 24, 40, 'RIDERS: 1', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#ff007f',
            align: 'right'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(120);

        this.updateRoomCount();
    }

    updateRoomCount() {
        if (!this.opponentsText) {
            return;
        }

        const totalRiders = 1 + this.bots.length + Object.keys(this.playersMap).length;
        this.opponentsText.setText('RIDERS: ' + totalRiders);
    }

    setupSoundButton() {
        const x = this.scale.width - 32;
        const y = this.scale.height - 28;
        this.soundButton = this.add.text(x, y, 'SFX ON', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#ffffff',
            backgroundColor: '#111122'
        }).setOrigin(1, 1).setDepth(120).setPadding(8, 6);

        this.soundButton.setInteractive({ useHandCursor: true });
        this.soundButton.on('pointerdown', () => {
            this.sound.mute = !this.sound.mute;
            this.soundButton.setText(this.sound.mute ? 'SFX OFF' : 'SFX ON');
        });
    }

    playSfx(key, volume = 1) {
        if (!this.cache.audio.exists(key)) {
            return;
        }

        this.sound.play(key, { volume });
    }

    getWeaponThrustSpeed(weaponType) {
        if (weaponType === 'Hockey Stick') {
            return 380;
        }

        if (weaponType === 'Street Sign') {
            return 290;
        }

        return 330;
    }

    triggerClashVFX(x, y, intensity = 'medium') {
        const particleCount = intensity === 'heavy' ? 28 : intensity === 'light' ? 10 : 16;
        this.sparkEmitter?.emitParticleAt(x, y, particleCount);

        const ring = this.add.circle(x, y, 12, 0xffffff, 0.2).setStrokeStyle(3, intensity === 'heavy' ? 0xff0055 : 0x00f0ff);
        this.tweens.add({
            targets: ring,
            scale: intensity === 'heavy' ? 3 : 2,
            alpha: 0,
            duration: intensity === 'heavy' ? 320 : 220,
            onComplete: () => ring.destroy()
        });
    }

    flashRider(rider) {
        this.tweens.add({
            targets: rider,
            alpha: 0.15,
            yoyo: true,
            repeat: 3,
            duration: 60,
            onComplete: () => {
                if (!rider.isDazed) {
                    rider.setAlpha(1);
                }
            }
        });
    }

    showFeedbackText(x, y, text, color) {
        const feedback = this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            color,
            stroke: '#111122',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(130);

        this.tweens.add({
            targets: feedback,
            y: y - 30,
            alpha: 0,
            duration: 700,
            onComplete: () => feedback.destroy()
        });
    }

    triggerGameOver() {
        if (this.isGameOver) {
            return;
        }

        this.isGameOver = true;
        this.player.body.setAccelerationX(0);
        this.player.body.setVelocity(0, 0);
        this.sparkEmitter?.stop();
        this.thrusterEmitter?.stop();

        const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x050510, 0.82)
            .setDepth(200)
            .setScrollFactor(0);
        const title = this.add.text(this.scale.width / 2, this.scale.height * 0.3, 'GAME OVER', {
            fontFamily: '"Press Start 2P"',
            fontSize: '28px',
            color: '#ff0055'
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);
        const subtitle = this.add.text(this.scale.width / 2, this.scale.height * 0.3 + 48, `FINAL SCORE: ${this.score}`, {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        // Name input prompt
        const promptText = this.add.text(this.scale.width / 2, this.scale.height * 0.5 - 20, 'ENTER YOUR NAME:', {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            color: '#ffea00'
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        // Create a DOM input for the player name
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.maxLength = 12;
        inputEl.placeholder = 'ANON RIDER';
        inputEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;font-family:"Press Start 2P",monospace;font-size:14px;padding:10px 16px;background:#0a0a1a;color:#00f0ff;border:2px solid #ff007f;text-align:center;outline:none;width:220px;text-transform:uppercase;';
        document.body.appendChild(inputEl);
        inputEl.focus();

        const submitBtn = this.add.text(this.scale.width / 2, this.scale.height * 0.5 + 50, 'SUBMIT SCORE', {
            fontFamily: '"Press Start 2P"',
            fontSize: '12px',
            color: '#111122',
            backgroundColor: '#00f0ff',
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setInteractive({ cursor: 'pointer' });

        const restart = this.add.text(this.scale.width / 2, this.scale.height * 0.5 + 100, 'TAP OR PRESS SPACE TO RESTART', {
            fontFamily: '"Press Start 2P"',
            fontSize: '10px',
            color: '#00f0ff'
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0).setAlpha(0);

        let scoreSaved = false;

        const saveScore = () => {
            if (scoreSaved) return;
            scoreSaved = true;
            const playerName = (inputEl.value.trim() || 'ANON RIDER').toUpperCase().substring(0, 12);
            inputEl.remove();
            promptText.setText(`SAVED: ${playerName}`);
            submitBtn.setVisible(false);
            restart.setAlpha(1);

            try {
                const scoreId = typeof crypto?.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `score-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
                db.transact(db.tx.scores[scoreId].update({
                    playerName,
                    score: this.score,
                    weapon: this.myCosmetics.weapon || 'Unknown',
                    district: this.district.slug,
                    createdAt: Date.now()
                }));
            } catch (e) {
                console.warn('Failed to persist score to InstantDB.', e);
            }

            this.enableRestart(overlay, title, subtitle, promptText, submitBtn, restart);
        };

        submitBtn.on('pointerdown', saveScore);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveScore();
        });

        // Allow skip without saving — also cleans up DOM input
        const skipAndRestart = () => {
            if (!scoreSaved) {
                inputEl.remove();
            }
            if (!scoreSaved) {
                scoreSaved = true;
                this.enableRestart(overlay, title, subtitle, promptText, submitBtn, restart);
            }
        };
        this.time.delayedCall(5000, () => {
            if (!scoreSaved) {
                restart.setAlpha(0.6);
                restart.setText('TAP/SPACE TO SKIP & RESTART');
                this.input.keyboard.once('keydown-SPACE', skipAndRestart);
                this.input.once('pointerdown', skipAndRestart);
            }
        });
    }

    enableRestart(overlay, title, subtitle, promptText, submitBtn, restart) {
        const restartGame = () => {
            this.input.keyboard.off('keydown-SPACE', restartGame);
            this.input.off('pointerdown', restartGame);
            // Clean up any orphaned DOM input
            const staleInput = document.querySelector('input[placeholder="ANON RIDER"]');
            if (staleInput) staleInput.remove();
            overlay.destroy();
            title.destroy();
            subtitle.destroy();
            promptText.destroy();
            submitBtn.destroy();
            restart.destroy();
            this.scene.restart({ cosmetics: this.myCosmetics, district: this.district.slug });
        };

        this.input.keyboard.once('keydown-SPACE', restartGame);
        this.input.once('pointerdown', restartGame);
    }
}

export default GameScene;
