import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPROVED_MOUNTAINBOARD_IMAGE_PATH,
  APPROVED_MOUNTAINBOARD_IMAGE_URL,
  resolveApprovedBoardImage,
} from '../lib/approvedBoardImages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

test('resolveApprovedBoardImage returns the global approved mountainboard asset for Mountain configs', () => {
  assert.deepEqual(
    resolveApprovedBoardImage({
      boardType: 'Mountain',
      drivetrain: 'Belt',
      motor: 'Standard',
      wheels: 'Urethane',
      battery: 'SlimStealth',
    }),
    {
      imageUrl: APPROVED_MOUNTAINBOARD_IMAGE_URL,
      backgroundRemovalRequired: false,
    },
  );
});

test('resolveApprovedBoardImage returns null for non-Mountain configs', () => {
  assert.equal(
    resolveApprovedBoardImage({
      boardType: 'Street',
      drivetrain: 'Belt',
      motor: 'Standard',
      wheels: 'Urethane',
      battery: 'SlimStealth',
    }),
    null,
  );
});

test('approved mountainboard master asset exists in public assets', () => {
  const assetPath = path.join(repoRoot, 'public', APPROVED_MOUNTAINBOARD_IMAGE_PATH.replace(/^\/assets\//, 'assets/'));
  assert.equal(fs.existsSync(assetPath), true, `Expected approved Mountain asset at ${assetPath}`);
});
