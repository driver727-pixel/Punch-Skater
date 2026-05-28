import Phaser from 'phaser';
import { init } from '@instantdb/core';
import { INSTANT_DB_APP_ID } from './instant_db_config.js';

const db = init({ appId: INSTANT_DB_APP_ID });

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.selectedColorIdx = 0;
        this.selectedDeckIdx = 0;
        this.selectedWeaponIdx = 2;

        this.colors = [
            { name: 'Neon Cyan', value: 0x00f0ff },
            { name: 'Cyber Pink', value: 0xff007f },
            { name: 'Laser Yellow', value: 0xffea00 },
            { name: 'Toxic Green', value: 0x39ff14 }
        ];
        this.decks = ['Speedline', 'Gridwave', 'ToxiCorp', 'Hologram'];
        this.weapons = [
            { name: 'Hockey Stick', speed: '⚡⚡⚡', weight: '⚡', reach: '⚡⚡' },
            { name: 'Street Sign', speed: '⚡', weight: '⚡⚡⚡', reach: '⚡⚡' },
            { name: 'Crutch Lance', speed: '⚡⚡', weight: '⚡⚡', reach: '⚡⚡⚡' }
        ];
        this.highScores = [];
    }

    create() {
        const { width, height } = this.scale;

        const bg = this.add.image(width / 2, height / 2, 'cyber-bg');
        bg.setDisplaySize(width, height).setAlpha(0.65);

        this.add.text(width / 2, height * 0.12, 'CYBER JOUST', {
            fontFamily: '"Press Start 2P"', fontSize: 'min(38px, 6vw)', color: '#ff007f', stroke: '#00f0ff', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.17, 'SKATEBOARD ARENA CLASH', {
            fontFamily: '"Press Start 2P"', fontSize: 'min(14px, 2.5vw)', color: '#ffea00'
        }).setOrigin(0.5);

        this.setupBackgroundMusic();
        this.createPanels(width, height);
        this.createActionButtons(width, height);
        this.fetchLeaderboard();
    }

    setupBackgroundMusic() {
        if (!this.sound.get('cyber-music')) {
            try { this.sound.add('cyber-music', { loop: true, volume: 0.35 }); } catch (e) {}
        }
        this.input.once('pointerdown', () => {
            const music = this.sound.get('cyber-music');
            if (music && !music.isPlaying) {
                try { music.play(); } catch (e) {}
            }
        });
    }

    createPanels(width, height) {
        const isPortrait = height > width;
        const panelY = height * 0.48;
        const panelWidth = isPortrait ? width * 0.9 : width * 0.42;
        const panelHeight = isPortrait ? height * 0.22 : height * 0.52;

        const custX = isPortrait ? width / 2 : width * 0.72;
        const custY = isPortrait ? height * 0.36 : panelY;
        const leadX = isPortrait ? width / 2 : width * 0.28;
        const leadY = isPortrait ? height * 0.62 : panelY;

        this.drawCustomizerPanel(custX, custY, panelWidth, panelHeight);
        this.drawLeaderboardPanel(leadX, leadY, panelWidth, panelHeight);
    }

    drawCustomizerPanel(x, y, w, h) {
        const panelBg = this.add.rectangle(x, y, w, h, 0x0a0a1a, 0.85);
        panelBg.setStrokeStyle(3, 0x00f0ff);

        this.add.text(x, y - h / 2 + 25, 'RIDER PROFILE', {
            fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#00f0ff'
        }).setOrigin(0.5);

        this.previewGraphics = this.add.graphics();
        this.previewContainer = this.add.container(x - w * 0.3, y).setDepth(10);
        this.previewContainer.add(this.previewGraphics);
        this.updateRiderPreview();

        const controlX = x + w * 0.12;
        const optionSpacing = h * 0.22;

        this.colorText = this.add.text(controlX, y - optionSpacing, 'COLOR: ' + this.colors[this.selectedColorIdx].name, {
            fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
        }).setOrigin(0.5);

        const colorBtn = this.add.rectangle(controlX, y - optionSpacing, w * 0.6, 32, 0x000000, 0);
        colorBtn.setInteractive({ cursor: 'pointer' });
        colorBtn.on('pointerdown', () => {
            this.selectedColorIdx = (this.selectedColorIdx + 1) % this.colors.length;
            this.colorText.setText('COLOR: ' + this.colors[this.selectedColorIdx].name.toUpperCase());
            this.updateRiderPreview();
            this.playTick();
        });

        this.deckText = this.add.text(controlX, y, 'DECK: ' + this.decks[this.selectedDeckIdx], {
            fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
        }).setOrigin(0.5);

        const deckBtn = this.add.rectangle(controlX, y, w * 0.6, 32, 0x000000, 0);
        deckBtn.setInteractive({ cursor: 'pointer' });
        deckBtn.on('pointerdown', () => {
            this.selectedDeckIdx = (this.selectedDeckIdx + 1) % this.decks.length;
            this.deckText.setText('DECK: ' + this.decks[this.selectedDeckIdx].toUpperCase());
            this.updateRiderPreview();
            this.playTick();
        });

        this.weaponText = this.add.text(controlX, y + optionSpacing, 'WEAPON: ' + this.weapons[this.selectedWeaponIdx].name, {
            fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#ffffff'
        }).setOrigin(0.5);

        this.statsText = this.add.text(controlX, y + optionSpacing + 20, '', {
            fontFamily: '"Press Start 2P"', fontSize: '8px', color: '#ffea00'
        }).setOrigin(0.5);

        this.updateWeaponStats();
        const weaponBtn = this.add.rectangle(controlX, y + optionSpacing, w * 0.6, 32, 0x000000, 0);
        weaponBtn.setInteractive({ cursor: 'pointer' });
        weaponBtn.on('pointerdown', () => {
            this.selectedWeaponIdx = (this.selectedWeaponIdx + 1) % this.weapons.length;
            this.weaponText.setText('WEAPON: ' + this.weapons[this.selectedWeaponIdx].name.toUpperCase());
            this.updateWeaponStats();
            this.updateRiderPreview();
            this.playTick();
        });
    }

    updateWeaponStats() {
        const weapon = this.weapons[this.selectedWeaponIdx];
        this.statsText.setText(`SPD:${weapon.speed} WT:${weapon.weight} RNG:${weapon.reach}`);
    }

    updateRiderPreview() {
        const color = this.colors[this.selectedColorIdx].value;
        const weaponType = this.weapons[this.selectedWeaponIdx].name;
        const g = this.previewGraphics;
        g.clear();

        g.fillStyle(0x222233, 1);
        g.lineStyle(2, color, 1);
        g.fillRect(-22, 10, 44, 6);
        g.strokeRect(-22, 10, 44, 6);
        g.fillStyle(0xff007f, 1);
        g.fillCircle(-15, 18, 4);
        g.fillCircle(15, 18, 4);

        g.fillStyle(0x16122c, 1);
        g.lineStyle(2, color, 1);
        g.beginPath();
        g.moveTo(-8, -10);
        g.lineTo(8, -14);
        g.lineTo(12, -30);
        g.lineTo(-4, -34);
        g.closePath();
        g.fillPath();
        g.strokePath();

        g.fillStyle(color, 1);
        g.fillCircle(6, -42, 8);
        g.fillStyle(0xffea00, 1);
        g.fillRect(8, -44, 4, 3);

        g.lineStyle(3, color, 1);
        g.fillStyle(0x1a1a2e, 1);

        if (weaponType === 'Hockey Stick') {
            g.lineStyle(3.5, color, 1);
            g.lineBetween(-5, -15, 20, -5);
            g.lineBetween(20, -5, 28, -8);
        } else if (weaponType === 'Street Sign') {
            g.lineStyle(3, 0xff0055, 1);
            g.fillStyle(0xb2003b, 1);
            g.strokeRect(12, -22, 14, 14);
            g.fillRect(12, -22, 14, 14);
            g.lineStyle(3, 0xcccccc, 1);
            g.lineBetween(-5, -15, 14, -15);
        } else {
            g.lineStyle(2.5, 0x00f0ff, 1);
            g.lineBetween(-10, -15, 22, -15);
            g.lineStyle(2, 0xffea00, 1);
            g.lineBetween(12, -15, 22, -15);
            g.fillStyle(0x00f0ff, 1);
            g.fillCircle(22, -15, 3);
        }
    }

    drawLeaderboardPanel(x, y, w, h) {
        const panelBg = this.add.rectangle(x, y, w, h, 0x0a0a1a, 0.85);
        panelBg.setStrokeStyle(3, 0xff007f);
        this.add.text(x, y - h / 2 + 25, 'HIGH SCORES', {
            fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#ff007f'
        }).setOrigin(0.5);

        this.leaderboardContainer = this.add.container(x, y - 25);
        this.renderLeaderboardText();
    }

    fetchLeaderboard() {
        try {
            db.subscribeQuery({ scores: {} }, (result) => {
                if (result.data && result.data.scores) {
                    this.highScores = result.data.scores
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 5);
                    this.renderLeaderboardText();
                }
            });
        } catch (e) {
            console.warn('Could not load high scores from database.', e);
            this.highScores = [
                { playerName: 'CyberGrip', score: 3250 },
                { playerName: 'NeonLance', score: 2100 },
                { playerName: 'RampFiend', score: 1750 }
            ];
            this.renderLeaderboardText();
        }
    }

    renderLeaderboardText() {
        if (!this.leaderboardContainer) return;
        this.leaderboardContainer.removeAll(true);
        if (this.highScores.length === 0) {
            const loading = this.add.text(0, 15, 'LOADING DATA...', {
                fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#888888'
            }).setOrigin(0.5);
            this.leaderboardContainer.add(loading);
            return;
        }

        this.highScores.forEach((row, idx) => {
            const name = row.playerName || 'ANON RIDER';
            const score = row.score || 0;
            const rank = idx + 1;
            const rankColor = rank === 1 ? '#ffea00' : rank === 2 ? '#00f0ff' : '#ffffff';
            const txt = this.add.text(0, idx * 24, `${rank}. ${name.substring(0, 12).padEnd(12, '.')} ${score}`, {
                fontFamily: '"Press Start 2P"', fontSize: '10px', color: rankColor
            }).setOrigin(0.5);
            this.leaderboardContainer.add(txt);
        });
    }

    createActionButtons(width, height) {
        const isPortrait = height > width;
        const btnY = height * 0.85;

        const playBtn = this.add.rectangle(width * 0.28, btnY, width * 0.38, 55, 0xff0055);
        playBtn.setStrokeStyle(3, 0xffffff);
        const playTxt = this.add.text(width * 0.28, btnY, 'SOLO ARENA', {
            fontFamily: '"Press Start 2P"', fontSize: 'min(14px, 2.8vw)', color: '#ffffff'
        }).setOrigin(0.5);

        playBtn.setInteractive({ cursor: 'pointer' });
        playBtn.on('pointerdown', () => this.launchGameScene());

        const multiBtn = this.add.rectangle(width * 0.72, btnY, width * 0.38, 55, 0x00f0ff);
        multiBtn.setStrokeStyle(3, 0xffffff);
        const multiTxt = this.add.text(width * 0.72, btnY, 'SHARE ROOM LINK', {
            fontFamily: '"Press Start 2P"', fontSize: 'min(12px, 2.5vw)', color: '#111122'
        }).setOrigin(0.5);

        multiBtn.setInteractive({ cursor: 'pointer' });
        multiBtn.on('pointerdown', () => this.copyRoomLink());

        if (isPortrait) {
            playBtn.setPosition(width / 2, height * 0.8);
            playTxt.setPosition(width / 2, height * 0.8);
            playBtn.setSize(width * 0.8, 55);
            multiBtn.setPosition(width / 2, height * 0.89);
            multiTxt.setPosition(width / 2, height * 0.89);
            multiBtn.setSize(width * 0.8, 55);
        }

        this.scale.on('resize', (gameSize) => {
            const { width: w, height: h } = gameSize;
            const isP = h > w;
            const bY = h * 0.85;
            if (isP) {
                playBtn.setPosition(w / 2, h * 0.8);
                playTxt.setPosition(w / 2, h * 0.8);
                playBtn.setSize(w * 0.8, 55);
                multiBtn.setPosition(w / 2, h * 0.89);
                multiTxt.setPosition(w / 2, h * 0.89);
                multiBtn.setSize(w * 0.8, 55);
            } else {
                playBtn.setPosition(w * 0.28, bY);
                playTxt.setPosition(w * 0.28, bY);
                playBtn.setSize(w * 0.38, 55);
                multiBtn.setPosition(w * 0.72, bY);
                multiTxt.setPosition(w * 0.72, bY);
                multiBtn.setSize(w * 0.38, 55);
            }
        });
    }

    launchGameScene() {
        const payload = {
            cosmetics: {
                colorName: this.colors[this.selectedColorIdx].name,
                color: this.colors[this.selectedColorIdx].value,
                deck: this.decks[this.selectedDeckIdx],
                weapon: this.weapons[this.selectedWeaponIdx].name
            }
        };
        const music = this.sound.get('cyber-music');
        if (music) music.stop();
        this.scene.start('GameScene', payload);
    }

    copyRoomLink() {
        const uniqueSegment = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
        const lobbyId = `room-${uniqueSegment}`;
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${lobbyId}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            const notify = this.add.text(this.scale.width / 2, this.scale.height - 30, 'ROOM LINK COPIED! SHARE WITH A FRIEND!', {
                fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#39ff14'
            }).setOrigin(0.5);

            this.tweens.add({
                targets: notify,
                alpha: 0,
                y: this.scale.height - 80,
                duration: 2500,
                onComplete: () => { notify.destroy(); }
            });
        }).catch((err) => console.warn('Clipboard access denied.', err));

        window.history.replaceState({}, '', `?room=${lobbyId}`);
        this.launchGameScene();
    }

    playTick() {
        try { this.sound.play('sfx-clash', { volume: 0.15, rate: 1.5 }); } catch (e) {}
    }
}
