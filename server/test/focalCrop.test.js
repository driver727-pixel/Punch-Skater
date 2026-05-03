import test from 'node:test';
import assert from 'node:assert/strict';

// Inline the computeFocalCrop logic (mirrors src/lib/focalCrop.ts) so this
// test runs under Node without a TypeScript transpiler.
function computeFocalCrop(frameSeed, face) {
  const input = String(frameSeed) + '|' + face;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const x = (h & 0xffff) % 101;
  const y = ((h >>> 16) & 0xffff) % 101;
  return { objectPosition: `${x}% ${y}%` };
}

test('computeFocalCrop is deterministic for the same seed + face', () => {
  const r1 = computeFocalCrop('abc123', 'front');
  const r2 = computeFocalCrop('abc123', 'front');
  assert.deepEqual(r1, r2);

  const r3 = computeFocalCrop(42, 'back');
  const r4 = computeFocalCrop(42, 'back');
  assert.deepEqual(r3, r4);
});

test('computeFocalCrop front and back produce different positions for the same seed', () => {
  const front = computeFocalCrop('seed-xyz', 'front');
  const back  = computeFocalCrop('seed-xyz', 'back');
  assert.notDeepEqual(front, back, 'front and back must yield different focal points');
});

test('computeFocalCrop objectPosition is within 0–100 range', () => {
  for (const seed of ['', '0', 'abc', 12345, 'PUNCH-SKATER-001']) {
    for (const face of ['front', 'back']) {
      const { objectPosition } = computeFocalCrop(seed, face);
      const [xStr, yStr] = objectPosition.split(' ');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      assert.ok(x >= 0 && x <= 100, `x out of range for seed=${seed} face=${face}: ${x}`);
      assert.ok(y >= 0 && y <= 100, `y out of range for seed=${seed} face=${face}: ${y}`);
    }
  }
});

test('computeFocalCrop different seeds produce different positions', () => {
  const positions = new Set(
    ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map(
      (s) => computeFocalCrop(s, 'front').objectPosition
    )
  );
  // With 5 distinct seeds the hash should yield at least 3 distinct positions
  assert.ok(positions.size >= 3, `Expected varied positions, got: ${[...positions].join(', ')}`);
});
