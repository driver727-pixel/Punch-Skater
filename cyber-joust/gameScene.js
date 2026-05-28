import Phaser from 'phaser';
import { init, id } from '@instantdb/core';
import { INSTANT_DB_APP_ID } from './instant_db_config.js';

const db = init({ appId: INSTANT_DB_APP_ID });

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playersMap = {};
        this.bots = [];
        this.myPlayerId = null;
        this.room = null;
        this.score = 0;
        this.lives = 5;
        this.isGameOver = false;

        this.myCosmetics = {
            colorName: 'Cyan',
            color: 0x00f0ff,
            deck: 'Speedline',
            weapon: 'Crutch Lance'
        };
    }

    init(data) {
        if (data && data.cosmetics) {
            this.myCosmetics = data.cosmetics;
        }
        this.score = 0;
        this.lives = 5;
        this.isGameOver = false;
        this.bots = [];
        this.playersMap = {};
    }

    create() {
        const { width, height } = this.scale;

        const bg = this.add.image(width / 2, height / 2, 'cyber-bg');
        bg.setDisplaySize(width, height);

        const params = new URLSearchParams(window.location.search);
        this.roomId = params.get('room') || 'cyber-joust-lobby';
        if (!params.get('room')) {
            window.history.replaceState({}, '', `?room=${this.roomId}`);
        }

        this.setupSoundButton();
        this.createEnvironment(width, height);

        this.myPlayerId = 'rider_' + Math.random().toString(36).slice(2, 9);
        this.player = this.spawnSkater(width / 4, height - 250, true, this.myPlayerId);
        this.player.name = 'You';
        this.player.cosmetics = this.myCosmetics;

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
        this.spawnBots(2);
        this.createHUD();
    }

    createEnvironment(width, height) {
        this.platforms = this.physics.add.staticGroup();
        const platformThickness = 24;
        const groundY = height - 100;
        const groundW = width * 0.35;

        const leftGround = this.add.rectangle(groundW / 2, groundY, groundW, platformThickness, 0x111122);
        leftGround.setStrokeStyle(3, 0xff007f);
        this.platforms.add(leftGround);

        const rightGround = this.add.rectangle(width - groundW / 2, groundY, groundW, platformThickness, 0x111122);
        rightGround.setStrokeStyle(3, 0xff007f);
        this.platforms.add(rightGround);

        const midLeftLedge = this.add.rectangle(width * 0.25, height * 0.6, width * 0.3, platformThickness, 0x111122);
        midLeftLedge.setStrokeStyle(3, 0x00f0ff);
        this.platforms.add(midLeftLedge);

        const midRightLedge = this.add.rectangle(width * 0.75, height * 0.6, width * 0.3, platformThickness, 0x111122);
        midRightLedge.setStrokeStyle(3, 0x00f0ff);
        this.platforms.add(midRightLedge);

        const topCenterLedge = this.add.rectangle(width * 0.5, height * 0.35, width * 0.25, platformThickness, 0x111122);
        topCenterLedge.setStrokeStyle(3, 0xffea00);
        this.platforms.add(topCenterLedge);

        this.ramps = [];
        this.createRamp(groundW, groundY, 120, 80, 'right');
        this.createRamp(width - groundW, groundY, 120, 80, 'left');
        this.createRamp(width * 0.4, height * 0.6, 100, 60, 'right');
        this.createRamp(width * 0.6, height * 0.6, 100, 60, 'left');

        this.hazardY = height - 55;
        this.hazard = this.add.rectangle(width / 2, this.hazardY + 20, width * 0.45, 40, 0xff0055, 0.3);
        this.physics.add.existing(this.hazard, true);

        this.hazardGrid = this.add.grid(width / 2, this.hazardY + 20, width * 0.45, 40, 20, 10, 0xff0055, 0.4, 0xff007f, 0.9);
        this.tweens.add({ targets: this.hazardGrid, alpha: 0.5, yoyo: true, repeat: -1, duration: 800 });
    }

    createRamp(x, y, width, height, direction) {
        const graphics = this.add.graphics();
        graphics.lineStyle(3, 0x00f0ff, 1);
        graphics.fillStyle(0x111122, 0.8);
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
        graphics.fillPath();
        graphics.strokePath();

        const rampZone = this.add.zone(x - (direction === 'right' ? width / 2 : -width / 2), y - height / 2, width, height);
        this.physics.add.existing(rampZone, true);
        this.ramps.push({ zone: rampZone, direction: direction, highX: x, highY: y - height, width: width, height: height });
    }

    spawnSkater(x, y, isPlayer, riderId) {
        const skater = this.add.container(x, y);
        this.physics.add.existing(skater);

        skater.body.setCollideWorldBounds(true);
        skater.body.setGravityY(750);
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

        const weaponContainer = this.add.container(0, -10);
        const weaponGraphics = this.add.graphics();
        weaponContainer.add(weaponGraphics);

        skater.add([board, wheelL, wheelR, deckAccent, bodyG, weaponContainer]);

        skater.isPlayer = isPlayer;
        skater.skaterId = riderId;
        skater.isLaunching = false;
        skater.isDazed = false;
        skater.facing = 'right';
        skater.weaponRotation = 0;
        skater.victoryFlips = 0;

        skater.cosmetics = {
            color: 0x00f0ff, deck: 'Speedline', weapon: 'Crutch Lance'
        };

        skater.bodyGraphics = bodyG;
        skater.weaponGraphics = weaponGraphics;
        skater.weaponContainer = weaponContainer;
        skater.wheels = [wheelL, wheelR];
        skater.deck = board;
        skater.deckAccent = deckAccent;

        this.updateSkaterVisuals(skater);
        return skater;
    }

    drawRider(g, primaryColor) {
        g.clear();
        g.fillStyle(0x16122c, 1);
        g.lineStyle(2, primaryColor, 1);
        g.beginPath();
        g.moveTo(-10, -5);
        g.lineTo(10, -10);
        g.lineTo(15, -30);
        g.lineTo(-5, -35);
        g.closePath();
        g.fillPath();
        g.strokePath();

        g.fillStyle(0x11111d, 1);
        g.lineStyle(2, 0xff007f, 1);
        g.beginPath();
        g.moveTo(-8, -5);
        g.lineTo(8, -5);
        g.lineTo(5, 12);
        g.lineTo(-5, 12);
        g.closePath();
        g.fillPath();
        g.strokePath();

        g.fillStyle(primaryColor, 1);
        g.fillCircle(8, -42, 9);
        g.fillStyle(0x000000, 1);
        g.fillCircle(10, -42, 6);
        g.fillStyle(0xffea00, 1);
        g.fillRect(11, -44, 4, 3);
    }

    updateSkaterVisuals(skater) {
        const color = skater.cosmetics.color;
        const weaponType = skater.cosmetics.weapon;
        const deckStyle = skater.cosmetics.deck;

        this.drawRider(skater.bodyGraphics, color);

        if (deckStyle === 'Speedline') {
            skater.deck.setStrokeStyle(2, color);
            skater.wheels.forEach((w) => w.setFillStyle(0xff007f));
            skater.deckAccent.setFillStyle(0xffea00);
        } else if (deckStyle === 'Gridwave') {
            skater.deck.setStrokeStyle(2, 0xff007f);
            skater.wheels.forEach((w) => w.setFillStyle(0x00f0ff));
            skater.deckAccent.setFillStyle(color);
        } else if (deckStyle === 'ToxiCorp') {
            skater.deck.setStrokeStyle(2, 0x39ff14);
            skater.wheels.forEach((w) => w.setFillStyle(0xffea00));
            skater.deckAccent.setFillStyle(0xff0055);
        } else {
            skater.deck.setStrokeStyle(2, 0xffea00);
            skater.wheels.forEach((w) => w.setFillStyle(0x9d00ff));
            skater.deckAccent.setFillStyle(0x00f0ff);
        }

        const wg = skater.weaponGraphics;
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
            wg.fillCircle(20, 3, 3);
        } else if (weaponType === 'Street Sign') {
            wg.lineStyle(3, 0xff0055, 1);
            wg.fillStyle(0xb2003b, 1);
            wg.beginPath();
            const signX = 25;
            const signY = -5;
            const r = 14;
            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI) / 4;
                const px = signX + r * Math.cos(angle);
                const py = signY + r * Math.sin(angle);
                if (i === 0) wg.moveTo(px, py);
                else wg.lineTo(px, py);
            }
            wg.closePath();
            wg.fillPath();
            wg.strokePath();
            wg.lineStyle(4, 0xcccccc, 1);
            wg.lineBetween(-5, -5, 15, -5);
            wg.fillStyle(0xffffff, 1);
            wg.fillRect(signX - 6, signY - 2, 12, 4);
        } else {
            wg.lineStyle(3, 0x00f0ff, 1);
            wg.lineBetween(-15, -5, 18, -5);
            wg.lineBetween(-15, -12, 5, -5);
            wg.lineBetween(-15, 2, 5, -5);
            wg.fillStyle(0xff007f, 1);
            wg.fillRect(-18, -14, 4, 16);
            wg.lineStyle(2, 0xffea00, 1);
            wg.beginPath();
            wg.moveTo(10, -5);
            wg.lineTo(15, -9);
            wg.lineTo(20, -1);
            wg.lineTo(25, -5);
            wg.lineTo(32, -5);
            wg.strokePath();
            wg.fillStyle(0x00f0ff, 1);
            wg.fillCircle(32, -5, 3.5);
        }
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            thrust: Phaser.Input.Keyboard.KeyCodes.SPACE,
            tiltUp: Phaser.Input.Keyboard.KeyCodes.W,
            tiltDown: Phaser.Input.Keyboard.KeyCodes.S,
            leftAlt: Phaser.Input.Keyboard.KeyCodes.A,
            rightAlt: Phaser.Input.Keyboard.KeyCodes.D
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
        this.makeInteractive(btnLeft, () => { this.steerLeft = true; }, () => { this.steerLeft = false; });

        const btnRight = this.add.circle(160, btnY, btnRadius, 0x111122, 0.75);
        btnRight.setStrokeStyle(3, 0x00f0ff);
        const rightTxt = this.add.text(160, btnY, '▶', { fontSize: '24px', color: '#00f0ff' }).setOrigin(0.5);
        this.makeInteractive(btnRight, () => { this.steerRight = true; }, () => { this.steerRight = false; });

        const btnThrust = this.add.circle(width - 70, btnY - 20, btnRadius + 10, 0x111122, 0.75);
        btnThrust.setStrokeStyle(4, 0xff007f);
        const thrustTxt = this.add.text(width - 70, btnY - 20, 'BOOST', { fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#ff007f' }).setOrigin(0.5);
        this.makeInteractive(btnThrust, () => { this.triggerThrust(); }, null, true);

        const btnTiltUp = this.add.circle(width - 180, btnY - 45, btnRadius - 5, 0x111122, 0.75);
        btnTiltUp.setStrokeStyle(2, 0xffea00);
        const tiltUpTxt = this.add.text(width - 180, btnY - 45, '▲ TILT', { fontSize: '14px', color: '#ffea00' }).setOrigin(0.5);
        this.makeInteractive(btnTiltUp, () => { this.tiltLance('up'); }, () => { this.stopTilt(); });

        const btnTiltDown = this.add.circle(width - 180, btnY + 25, btnRadius - 5, 0x111122, 0.75);
        btnTiltDown.setStrokeStyle(2, 0xffea00);
        const tiltDownTxt = this.add.text(width - 180, btnY + 25, '▼ TILT', { fontSize: '14px', color: '#ffea00' }).setOrigin(0.5);
        this.makeInteractive(btnTiltDown, () => { this.tiltLance('down'); }, () => { this.stopTilt(); });

        this.mobileControls.add([btnLeft, leftTxt, btnRight, rightTxt, btnThrust, thrustTxt, btnTiltUp, tiltUpTxt, btnTiltDown, tiltDownTxt]);

        const desktopInstructions = this.add.text(width / 2, 45, 'DESKTOP: ARROWS to Skate / SPACE to BOOST / W-S to TILT LANCE', {
            fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ffffff'
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
        buttonShape.setInteractive(new Phaser.Geom.Circle(buttonShape.x, buttonShape.y, buttonShape.radius), Phaser.Geom.Circle.Contains);
        buttonShape.input.cursor = 'pointer';
        buttonShape.on('pointerdown', () => {
            buttonShape.setScale(0.9);
            buttonShape.setAlpha(1);
            if (onDown) onDown();
        });

        if (!tapOnly) {
            buttonShape.on('pointerup', () => {
                buttonShape.setScale(1);
                buttonShape.setAlpha(0.75);
                if (onUp) onUp();
            });
            buttonShape.on('pointerout', () => {
                buttonShape.setScale(1);
                buttonShape.setAlpha(0.75);
                if (onUp) onUp();
            });
        } else {
            buttonShape.on('pointerup', () => {
                buttonShape.setScale(1);
                buttonShape.setAlpha(0.75);
            });
        }
    }

    triggerThrust() {
        if (this.isGameOver || this.player.isDazed) return;
        const speed = this.myCosmetics.weapon === 'Hockey Stick' ? 380 : this.myCosmetics.weapon === 'Street Sign' ? 290 : 330;
        const upForce = -240;
        const horizForce = this.player.facing === 'right' ? speed * 0.75 : -speed * 0.75;

        this.player.body.setVelocityY(upForce);
        this.player.body.setVelocityX(this.player.body.velocity.x + horizForce);
        this.playSfx('sfx-boost', 0.55);

        const flareX = this.player.x + (this.player.facing === 'right' ? -25 : 25);
        const flareY = this.player.y + 15;
        this.thrusterEmitter.emitParticleAt(flareX, flareY, 15);

        if (Math.abs(this.player.body.velocity.x) > 300) {
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

    tiltLance(dir) { this.tiltDirection = dir; }
    stopTilt() { this.tiltDirection = null; }

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
                const { peers } = data;
                Object.entries(peers).forEach(([peerId, remoteData]) => {
                    if (remoteData && remoteData.id) {
                        this.updateRemotePlayer(remoteData.id, remoteData);
                    }
                });

                const currentPeerIds = Object.keys(peers);
                Object.keys(this.playersMap).forEach((peerId) => {
                    if (!currentPeerIds.includes(peerId)) {
                        this.playersMap[peerId].destroy();
                        delete this.playersMap[peerId];
                    }
                });
            });

            this.room.subscribeTopic('game_clash', (event, peer) => {
                this.triggerClashVFX(event.x, event.y, event.intensity);
            });
        } catch (e) {
            console.error('InstantDB connection failed. Running in solo-bot fallback mode.', e);
        }
    }

    updateRemotePlayer(peerId, data) {
        if (peerId === this.myPlayerId) return;
        let remoteRider = this.playersMap[peerId];

        if (!remoteRider) {
            remoteRider = this.spawnSkater(data.x, data.y, false, peerId);
            remoteRider.name = data.name || 'Remote Rider';
            remoteRider.cosmetics = data.cosmetics;
            this.updateSkaterVisuals(remoteRider);
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
        remoteRider.isDazed = data.isDazed;
        remoteRider.setAlpha(data.isDazed ? 0.4 : 1);
    }

    spawnBots(count) {
        const botNames = ['CyberGrip', 'GigaSkate', 'NeonLance', 'RampFiend', 'OnyxRider'];
        const weaponOptions = ['Hockey Stick', 'Street Sign', 'Crutch Lance'];
        const colors = [0xff007f, 0xffea00, 0x39ff14, 0x9d00ff];
        const colorNames = ['Pink', 'Yellow', 'Toxic Green', 'Violet'];

        for (let i = 0; i < count; i++) {
            const rx = Phaser.Math.Between(100, this.scale.width - 100);
            const ry = Phaser.Math.Between(100, this.scale.height - 300);
            const bot = this.spawnSkater(rx, ry, false, 'bot_' + i);
            bot.name = botNames[i % botNames.length];

            const randIdx = Phaser.Math.Between(0, colors.length - 1);
            bot.cosmetics = {
                colorName: colorNames[randIdx],
                color: colors[randIdx],
                deck: 'Gridwave',
                weapon: weaponOptions[i % weaponOptions.length]
            };

            this.updateSkaterVisuals(bot);
            bot.aiTimer = 0;
            bot.aiTargetX = Phaser.Math.Between(100, this.scale.width - 100);
            this.physics.add.collider(bot, this.platforms);
            this.bots.push(bot);
        }
    }

    update(time, delta) {
        if (this.isGameOver) return;
        this.handlePlayerMovement(delta);
        this.checkRampLaunches(this.player);
        this.handleBotsAI(delta);
        this.checkJoustClashes();
        this.checkHazardFalls();
        this.syncNetworkPresence();
    }

    handlePlayerMovement(delta) {
        if (this.player.isDazed) {
            this.player.setAlpha(0.4);
            return;
        } else {
            this.player.setAlpha(1);
        }

        const body = this.player.body;
        const acceleration = this.myCosmetics.weapon === 'Street Sign' ? 220 : 310;

        if (this.cursors.left.isDown || this.steerLeft) {
            body.setAccelerationX(-acceleration);
            if (this.player.facing !== 'left') {
                this.player.facing = 'left';
                this.player.setScale(-1, 1);
            }
        } else if (this.cursors.right.isDown || this.steerRight) {
            body.setAccelerationX(acceleration);
            if (this.player.facing !== 'right') {
                this.player.facing = 'right';
                this.player.setScale(1, 1);
            }
        } else {
            body.setAccelerationX(0);
        }

        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space) || Phaser.Input.Keyboard.JustDown(this.keys.thrust)) {
            this.triggerThrust();
        }

        const tiltSpeed = 0.04;
        const maxTilt = 0.6;

        if (this.keys.tiltUp.isDown || this.tiltDirection === 'up') {
            this.player.weaponRotation = Phaser.Math.Clamp(this.player.weaponRotation - tiltSpeed, -maxTilt, maxTilt);
        } else if (this.keys.tiltDown.isDown || this.tiltDirection === 'down') {
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
        this.ramps.forEach((ramp) => {
            if (Phaser.Geom.Intersects.RectangleToRectangle(skater.body, ramp.zone)) {
                const velX = skater.body.velocity.x;
                const isGoingCorrectWay = (ramp.direction === 'right' && velX > 50) || (ramp.direction === 'left' && velX < -50);

                if (isGoingCorrectWay && !skater.isLaunching) {
                    skater.isLaunching = true;
                    const launchLift = Math.min(-380, -Math.abs(velX) * 1.3);
                    skater.body.setVelocityY(launchLift);
                    skater.body.setVelocityX(velX * 1.5);

                    this.playSfx('sfx-boost', 0.6);
                    this.sparkEmitter.emitParticleAt(skater.x, skater.y, 20);

                    this.tweens.add({
                        targets: skater,
                        angle: ramp.direction === 'right' ? 30 : -30,
                        duration: 150,
                        yoyo: true,
                        repeat: 0,
                        onComplete: () => { skater.angle = 0; }
                    });

                    this.time.delayedCall(500, () => {
                        skater.isLaunching = false;
                    });
                }
            }
        });
    }

    handleBotsAI(delta) {
        this.bots.forEach((bot) => {
            if (bot.isDazed) {
                bot.setAlpha(0.4);
                return;
            } else {
                bot.setAlpha(1);
            }

            bot.aiTimer -= delta;
            if (bot.aiTimer <= 0) {
                bot.aiTimer = Phaser.Math.Between(800, 2200);
                const chasePlayer = Phaser.Math.Between(0, 100) < 65;
                if (chasePlayer) {
                    bot.aiTargetX = this.player.x;
                } else {
                    bot.aiTargetX = Phaser.Math.Between(50, this.scale.width - 50);
                }

                const shouldThrust = (bot.y > this.player.y && Phaser.Math.Between(0, 100) < 50) || Phaser.Math.Between(0, 100) < 20;
                if (shouldThrust) {
                    const upForce = -230;
                    const horiz = bot.facing === 'right' ? 180 : -180;
                    bot.body.setVelocityY(upForce);
                    bot.body.setVelocityX(bot.body.velocity.x + horiz);
                    if (Phaser.Math.Between(0, 10) < 3) {
                        this.thrusterEmitter.emitParticleAt(bot.x, bot.y + 15, 6);
                    }
                }
            }

            const acceleration = 240;
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

            this.checkRampLaunches(bot);

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
            if (opponent.isDazed || this.player.isDazed) return;

            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, opponent.x, opponent.y);
            const clashThreshold = 48;
            if (dist < clashThreshold) {
                const myY = this.player.y;
                const opponentY = opponent.y;
                const heightDiff = opponentY - myY;
                const bounceHeightMargin = 12;

                if (Math.abs(heightDiff) < bounceHeightMargin) {
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
                if (b1.isDazed || b2.isDazed) continue;

                const dist = Phaser.Math.Distance.Between(b1.x, b1.y, b2.x, b2.y);
                if (dist < 45) {
                    const hDiff = b2.y - b1.y;
                    if (Math.abs(hDiff) < 12) {
                        this.executeJoustBounce(b1, b2);
                    } else if (hDiff > 0) {
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
        this.flashRider(rider1, 0xffffff);
        this.flashRider(rider2, 0xffffff);

        if (this.room) {
            this.room.publishTopic('game_clash', { x: (rider1.x + rider2.x) / 2, y: (rider1.y + rider2.y) / 2, intensity: 'medium' });
        }
    }

    executeJoustVictory(winner, loser) {
        this.playSfx('sfx-clash', 1.0);
        this.triggerClashVFX(loser.x, loser.y, 'heavy');

        if (winner === this.player) {
            this.score += 250;
            this.scoreText.setText('SCORE: ' + this.score);
            this.showFeedbackText(loser.x, loser.y - 40, '+250', '#00f0ff');
        } else if (loser === this.player) {
            this.lives = Math.max(0, this.lives - 1);
            this.livesText.setText('LIVES: ' + '⚡'.repeat(this.lives));
            this.showFeedbackText(loser.x, loser.y - 40, 'CRASHED!', '#ff0055');
            this.cameras.main.shake(200, 0.012);
            if (this.lives <= 0) {
                this.triggerGameOver();
            }
        }

        loser.isDazed = true;
        loser.body.setVelocity(0, 0);
        loser.body.setAccelerationX(0);

        this.tweens.add({
            targets: loser,
            scaleY: 0.1,
            scaleX: 0.1,
            alpha: 0,
            angle: 180,
            duration: 350,
            onComplete: () => {
                this.time.delayedCall(2000, () => {
                    this.respawnSkaterEntity(loser);
                });
            }
        });

        if (this.room) {
            this.room.publishTopic('game_clash', { x: loser.x, y: loser.y, intensity: 'heavy' });
        }
    }

    respawnSkaterEntity(rider) {
        if (this.isGameOver) return;
        const rx = Phaser.Math.Between(100, this.scale.width - 100);
        const ry = 150;

        rider.setPosition(rx, ry);
        rider.body.setVelocity(0, 0);
        rider.body.setAccelerationX(0);
        rider.setScale(rider.facing === 'left' ? -1 : 1, 1);
        rider.alpha = 1;
        rider.isDazed = false;

        this.tweens.add({
            targets: rider,
            alpha: 0.3,
            yoyo: true,
            repeat: 5,
            duration: 150,
            onComplete: () => { rider.alpha = 1; }
        });
    }

    flashRider(rider, color) {
        this.tweens.add({
            targets: [rider.wheels, rider.deck],
            alpha: 0.2,
            yoyo: true,
            repeat: 1,
            duration: 100
        });
    }

    triggerClashVFX(x, y, intensity) {
        const count = intensity === 'heavy' ? 45 : 15;
        this.sparkEmitter.emitParticleAt(x, y, count);
    }

    checkHazardFalls() {
        const allJousters = [this.player, ...this.bots, ...Object.values(this.playersMap)];
        allJousters.forEach((rider) => {
            if (rider.isDazed) return;
            if (rider.y > this.hazardY - 10) {
                this.playSfx('sfx-zap', 0.85);
                this.triggerClashVFX(rider.x, rider.y, 'heavy');

                if (rider === this.player) {
                    this.lives = Math.max(0, this.lives - 1);
                    this.livesText.setText('LIVES: ' + '⚡'.repeat(this.lives));
                    this.showFeedbackText(rider.x, this.hazardY - 50, 'ZAPPED!', '#ff007f');
                    this.cameras.main.shake(250, 0.015);
                    if (this.lives <= 0) {
                        this.triggerGameOver();
                    }
                } else if (this.bots.includes(rider)) {
                    this.score += 100;
                    this.scoreText.setText('SCORE: ' + this.score);
                    this.showFeedbackText(rider.x, this.hazardY - 50, 'BOT ZAPPED!', '#39ff14');
                }

                rider.isDazed = true;
                rider.body.setVelocity(0, 0);
                this.tweens.add({
                    targets: rider,
                    scaleY: 0,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        this.time.delayedCall(2000, () => {
                            this.respawnSkaterEntity(rider);
                        });
                    }
                });
            }
        });
    }

    syncNetworkPresence() {
        if (!this.room) return;
        this.room.publishPresence({
            id: this.myPlayerId,
            name: this.myCosmetics.colorName + ' Rider',
            x: this.player.x,
            y: this.player.y,
            vx: this.player.body.velocity.x,
            vy: this.player.body.velocity.y,
            score: this.score,
            lives: this.lives,
            facing: this.player.facing,
            weaponRotation: this.player.weaponRotation,
            cosmetics: this.myCosmetics,
            isDazed: this.player.isDazed
        });
    }

    createHUD() {
        this.scoreText = this.add.text(35, 30, 'SCORE: 0', {
            fontFamily: '"Press Start 2P"', fontSize: '18px', color: '#ffea00'
        }).setDepth(99);

        this.livesText = this.add.text(35, 65, 'LIVES: ⚡⚡⚡⚡⚡', {
            fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#ff007f'
        }).setDepth(99);

        this.roomInfoText = this.add.text(this.scale.width - 35, 30, 'ROOM: ' + this.roomId.toUpperCase(), {
            fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#00f0ff'
        }).setOrigin(1, 0).setDepth(99);

        this.weaponInfoText = this.add.text(35, 100, 'EQUIPPED: ' + this.myCosmetics.weapon.toUpperCase(), {
            fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
        }).setAlpha(0.65).setDepth(99);

        const backBtn = this.add.text(this.scale.width - 35, 65, '[ BACK TO MENU ]', {
            fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#ff007f'
        }).setOrigin(1, 0).setDepth(99).setInteractive({ cursor: 'pointer' });

        backBtn.on('pointerdown', () => {
            this.isGameOver = true;
            this.scene.start('MenuScene');
        });

        this.scale.on('resize', (gameSize) => {
            const { width: w } = gameSize;
            this.roomInfoText.setPosition(w - 35, 30);
            backBtn.setPosition(w - 35, 65);
        });
    }

    setupSoundButton() {
        const isMuted = localStorage.getItem('isMuted') === 'true';
        this.sound.setMute(isMuted);

        const btn = this.add.text(this.scale.width - 35, 95, isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON', {
            fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
        }).setOrigin(1, 0).setDepth(101).setInteractive({ cursor: 'pointer' });

        btn.on('pointerdown', () => {
            const currentMute = this.sound.mute;
            const newMute = !currentMute;
            this.sound.setMute(newMute);
            localStorage.setItem('isMuted', newMute ? 'true' : 'false');
            btn.setText(newMute ? '🔇 SOUND OFF' : '🔊 SOUND ON');
        });

        this.scale.on('resize', (gameSize) => {
            btn.setPosition(gameSize.width - 35, 95);
        });
    }

    showFeedbackText(x, y, text, color) {
        const txt = this.add.text(x, y, text, {
            fontFamily: '"Press Start 2P"', fontSize: '11px', color: color
        }).setOrigin(0.5).setDepth(102);

        this.tweens.add({
            targets: txt,
            y: y - 50,
            alpha: 0,
            duration: 900,
            onComplete: () => { txt.destroy(); }
        });
    }

    triggerGameOver() {
        this.isGameOver = true;
        this.player.body.setVelocity(0, 0);

        try {
            const highscoreId = id();
            db.transact(
                db.tx.scores[highscoreId].update({
                    roomId: this.roomId,
                    playerId: this.myPlayerId,
                    playerName: this.myCosmetics.colorName + ' Rider',
                    weaponUsed: this.myCosmetics.weapon,
                    score: this.score,
                    timestamp: Date.now()
                })
            );
        } catch (e) {
            console.warn('Failed saving highscore to InstantDB');
        }

        const localHigh = Math.max(Number(localStorage.getItem('joust_high_score') || 0), this.score);
        localStorage.setItem('joust_high_score', localHigh.toString());

        const { width, height } = this.scale;
        const rect = this.add.rectangle(width / 2, height / 2, width * 0.6, 260, 0x070714, 0.9);
        rect.setStrokeStyle(4, 0xff0055);

        this.add.text(width / 2, height / 2 - 70, 'GAME OVER', {
            fontFamily: '"Press Start 2P"', fontSize: '32px', color: '#ff0055'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 10, 'FINAL SCORE: ' + this.score, {
            fontFamily: '"Press Start 2P"', fontSize: '16px', color: '#ffea00'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 25, 'BEST RECORD: ' + localHigh, {
            fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#00f0ff'
        }).setOrigin(0.5);

        const btnRestart = this.add.rectangle(width / 2, height / 2 + 80, 240, 44, 0xff0055);
        this.add.text(width / 2, height / 2 + 80, 'PLAY AGAIN', {
            fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#ffffff'
        }).setOrigin(0.5);

        btnRestart.setInteractive({ cursor: 'pointer' });
        btnRestart.on('pointerdown', () => {
            this.scene.restart();
        });
    }

    playSfx(key, volume = 0.5) {
        if (this.sound.mute) return;
        try { this.sound.play(key, { volume: volume }); } catch (e) {}
    }
}
