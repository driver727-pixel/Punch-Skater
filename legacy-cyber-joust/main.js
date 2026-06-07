import * as Phaser from 'phaser';
import { MenuScene } from './ui.js';
import { GameScene } from './gameScene.js';
import {
    buildCyberJoustBodyTextureKey,
    buildCyberJoustWeaponTextureKey,
    CYBER_JOUST_SPRITE_MANIFEST_KEY,
    loadCyberJoustSpriteManifest,
    resolveCyberJoustSpriteUrl
} from './fighterSprites.js';

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

        const loadingText = this.add.text(width / 2, height / 2 - 60, 'BOOTING SYSTEM...', {
            fontFamily: '"Press Start 2P"',
            fontSize: '14px',
            color: '#00f0ff'
        }).setOrigin(0.5);

        const percentText = this.add.text(width / 2, height / 2 + 60, '0%', {
            fontFamily: '"Press Start 2P"',
            fontSize: '11px',
            color: '#ffffff'
        }).setOrigin(0.5);

        const onProgress = (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffea00, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
            percentText.setText(Math.round(value * 100) + '%');
        };
        this.load.on('progress', onProgress);

        this.load.once('complete', () => {
            this.load.off('progress', onProgress);
            loadingBox.destroy();
            progressBar.destroy();
            loadingText.destroy();
            percentText.destroy();
        });

        this.load.image('cyber-bg', 'assets/cyber-joust-arena-bg.webp');
        this.load.audio('cyber-music', 'assets/audio/cyber-synthwave-theme.mp3');
        this.load.audio('sfx-clash', 'assets/audio/sfx-clash.mp3');
        this.load.audio('sfx-boost', 'assets/audio/sfx-boost.mp3');
        this.load.audio('sfx-zap', 'assets/audio/sfx-zap.mp3');
    }

    async create() {
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
                console.warn(
                    'Cyber Joust sprite load failed:',
                    file?.src || file?.key || 'unknown',
                    'type:',
                    file?.type || 'unknown',
                    'error:',
                    file?.error || 'unknown'
                );
            };
            this.load.on('loaderror', onLoadError);
            this.load.once('complete', () => {
                this.load.off('loaderror', onLoadError);
                this.scene.start('MenuScene');
            });
            this.load.start();
            return;
        }

        this.scene.start('MenuScene');
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [BootScene, MenuScene, GameScene]
};

const game = new Phaser.Game(config);
export default game;
