import Phaser from 'phaser';

const VIRTUAL_CONTROL_KEYS = ['left', 'right', 'up', 'down', 'boost'];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.virtualControls = Object.fromEntries(VIRTUAL_CONTROL_KEYS.map((key) => [key, false]));
    this.boostCooldown = 0;
    this.pendingBoost = false;
  }

  init(data) {
    this.cosmetics = data?.cosmetics ?? {
      colorName: 'Neon Cyan',
      color: 0x00f0ff,
      deck: 'Speedline',
      weapon: 'Crutch Lance'
    };
  }

  create() {
    const { width, height } = this.scale;
    this.roomId = new URLSearchParams(window.location.search).get('room');

    this.bg = this.add.image(width / 2, height / 2, 'cyber-bg')
      .setDisplaySize(width, height)
      .setAlpha(0.72)
      .setDepth(-3);
    this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x04040c, 0.45)
      .setDepth(-2);

    this.drawArena(width, height);

    this.infoText = this.add.text(width / 2, 34, this.roomId ? `ROOM ${this.roomId.toUpperCase()}` : 'SOLO GRID', {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#ffea00'
    }).setOrigin(0.5).setDepth(3);

    this.statusText = this.add.text(width / 2, height - 28, `DECK ${this.cosmetics.deck.toUpperCase()} • ${this.cosmetics.weapon.toUpperCase()}`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(3);

    this.createPlayer(width, height);
    this.createUi(width, height);
    this.createControls();
    this.createParticles();
    this.createMobileControls(width, height);

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  drawArena(width, height) {
    this.arenaElements?.forEach((element) => element.destroy());

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x00f0ff, 0.22);

    for (let x = 0; x <= width; x += 48) {
      grid.lineBetween(x, height * 0.18, x, height * 0.82);
    }

    for (let y = height * 0.18; y <= height * 0.82; y += 48) {
      grid.lineBetween(width * 0.08, y, width * 0.92, y);
    }

    const frame = this.add.rectangle(width / 2, height / 2, width * 0.84, height * 0.62)
      .setStrokeStyle(4, 0xff007f, 0.8)
      .setFillStyle(0x0c1026, 0.2);

    grid.setDepth(-1);
    frame.setDepth(-1);
    this.arenaElements = [grid, frame];
  }

  createPlayer(width, height) {
    this.player = this.add.container(width / 2, height / 2);
    this.playerBoard = this.add.graphics();
    this.redrawPlayer();
    this.player.add(this.playerBoard);
    this.physics.add.existing(this.player);
    this.player.setDepth(2);
    this.player.body.setCircle(26).setOffset(-26, -26).setCollideWorldBounds(true).setDrag(520, 520).setMaxVelocity(340, 340);
  }

  redrawPlayer() {
    const g = this.playerBoard;
    const color = this.cosmetics.color;
    const weapon = this.cosmetics.weapon;

    g.clear();
    g.fillStyle(0x222233, 1);
    g.lineStyle(2, color, 1);
    g.fillRoundedRect(-30, 8, 60, 10, 4);
    g.strokeRoundedRect(-30, 8, 60, 10, 4);
    g.fillStyle(0xff007f, 1);
    g.fillCircle(-20, 22, 5);
    g.fillCircle(20, 22, 5);

    g.fillStyle(0x171731, 1);
    g.beginPath();
    g.moveTo(-10, -6);
    g.lineTo(10, -10);
    g.lineTo(15, -28);
    g.lineTo(-5, -33);
    g.closePath();
    g.fillPath();
    g.strokePath();

    g.fillStyle(color, 1);
    g.fillCircle(8, -40, 9);
    g.fillStyle(0xffea00, 1);
    g.fillRect(9, -42, 5, 3);

    if (weapon === 'Hockey Stick') {
      g.lineStyle(4, color, 1);
      g.lineBetween(-4, -12, 26, -2);
      g.lineBetween(26, -2, 36, -6);
    } else if (weapon === 'Street Sign') {
      g.lineStyle(3, 0xb2003b, 1);
      g.fillStyle(0xff0055, 1);
      g.fillRect(12, -22, 16, 16);
      g.strokeRect(12, -22, 16, 16);
      g.lineStyle(3, 0xd0d0d0, 1);
      g.lineBetween(-2, -14, 13, -14);
    } else {
      g.lineStyle(3, 0x00f0ff, 1);
      g.lineBetween(-8, -16, 25, -16);
      g.lineStyle(2, 0xffea00, 1);
      g.lineBetween(12, -16, 25, -16);
      g.fillStyle(0x00f0ff, 1);
      g.fillCircle(25, -16, 4);
    }
  }

  createUi(width, height) {
    this.backButton = this.add.text(22, 22, '← MENU', {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#00f0ff'
    }).setOrigin(0, 0.5).setInteractive({ cursor: 'pointer' }).setDepth(3);

    this.backButton.on('pointerdown', () => {
      window.history.replaceState({}, '', window.location.pathname);
      this.scene.start('MenuScene');
    });

    this.riderText = this.add.text(width - 22, 22, `${this.cosmetics.colorName.toUpperCase()} RIDER`, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#ff007f'
    }).setOrigin(1, 0.5).setDepth(3);
  }

  createControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,SHIFT,SPACE');

    this.input.on('pointerdown', (pointer) => {
      this.triggerBurst(pointer.worldX, pointer.worldY);
    });
  }

  createParticles() {
    this.particles = this.add.particles(0, 0, 'spark-dot', {
      speed: { min: 10, max: 50 },
      scale: { start: 0.45, end: 0 },
      lifespan: 500,
      blendMode: 'ADD',
      frequency: 70,
      follow: this.player,
      followOffset: { x: -12, y: 18 }
    });
    this.particles.setDepth(1);
  }

  createMobileControls(width, height) {
    this.mobileControlsGroup?.destroy(true);
    this.mobileControlsGroup = null;

    if (!this.sys.game.device.input.touch) {
      return;
    }

    this.mobileControlsGroup = this.add.container(0, 0).setDepth(4);

    const makeButton = (x, y, label, key, fill) => {
      const circle = this.add.circle(x, y, 28, fill, 0.72).setStrokeStyle(2, 0xffffff, 0.65);
      const text = this.add.text(x, y, label, {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#ffffff'
      }).setOrigin(0.5);

      const press = (value) => () => {
        this.virtualControls[key] = value;
        if (key === 'boost' && value) {
          this.pendingBoost = true;
        }
        circle.setAlpha(value ? 1 : 0.72);
      };

      circle.setInteractive();
      circle.on('pointerdown', press(true));
      circle.on('pointerup', press(false));
      circle.on('pointerout', press(false));
      circle.on('pointerupoutside', press(false));
      text.setInteractive();
      text.on('pointerdown', press(true));
      text.on('pointerup', press(false));
      text.on('pointerout', press(false));
      text.on('pointerupoutside', press(false));
      this.mobileControlsGroup.add([circle, text]);
    };

    makeButton(60, height - 88, '◀', 'left', 0x00f0ff);
    makeButton(128, height - 88, '▶', 'right', 0x00f0ff);
    makeButton(94, height - 132, '▲', 'up', 0x00f0ff);
    makeButton(94, height - 44, '▼', 'down', 0x00f0ff);
    makeButton(width - 80, height - 88, 'BOOST', 'boost', 0xff007f);
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;

    this.bg.setPosition(width / 2, height / 2).setDisplaySize(width, height);
    this.overlay.setPosition(width / 2, height / 2).setSize(width, height);
    this.drawArena(width, height);
    this.infoText.setPosition(width / 2, 34);
    this.statusText.setPosition(width / 2, height - 28);
    this.backButton.setPosition(22, 22);
    this.riderText.setPosition(width - 22, 22);
    this.player.setPosition(
      Phaser.Math.Clamp(this.player.x, width * 0.08, width * 0.92),
      Phaser.Math.Clamp(this.player.y, height * 0.18, height * 0.82)
    );
    this.createMobileControls(width, height);
  }

  triggerBurst(targetX, targetY) {
    const direction = new Phaser.Math.Vector2(targetX - this.player.x, targetY - this.player.y);
    if (direction.lengthSq() === 0) {
      return;
    }

    direction.normalize().scale(220);
    this.player.body.velocity.add(direction);
    this.flashArena('#ffea00');
    try {
      this.sound.play('sfx-zap', { volume: 0.3, rate: 1.1 });
    } catch {
      // Ignore audio failures.
    }
  }

  flashArena(color) {
    const pulse = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, Phaser.Display.Color.HexStringToColor(color).color, 0.12);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      duration: 220,
      onComplete: () => pulse.destroy()
    });
  }

  update(_, delta) {
    if (!this.player?.body) {
      return;
    }

    const moveX = (this.cursors.left.isDown || this.wasd.A.isDown || this.virtualControls.left ? -1 : 0)
      + (this.cursors.right.isDown || this.wasd.D.isDown || this.virtualControls.right ? 1 : 0);
    const moveY = (this.cursors.up.isDown || this.wasd.W.isDown || this.virtualControls.up ? -1 : 0)
      + (this.cursors.down.isDown || this.wasd.S.isDown || this.virtualControls.down ? 1 : 0);

    const accel = 18;
    this.player.body.velocity.x += moveX * accel;
    this.player.body.velocity.y += moveY * accel;

    this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, this.player.body.velocity.angle(), 0.08);

    this.boostCooldown -= delta;
    const wantsBoost = Phaser.Input.Keyboard.JustDown(this.wasd.SHIFT)
      || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE)
      || this.pendingBoost;

    if (wantsBoost && this.boostCooldown <= 0) {
      const facing = new Phaser.Math.Vector2(1, 0).setAngle(this.player.rotation || 0).scale(180);
      this.player.body.velocity.add(facing);
      this.boostCooldown = 450;
      this.flashArena('#00f0ff');
      try {
        this.sound.play('sfx-boost', { volume: 0.28, rate: 1.2 });
      } catch {
        // Ignore audio failures.
      }
    }

    this.pendingBoost = false;
  }
}
