const Phaser = globalThis.__PS_PHASER__;

if (!Phaser) {
  throw new Error('Classic Race booted before Phaser finished loading.');
}

export default Phaser;
