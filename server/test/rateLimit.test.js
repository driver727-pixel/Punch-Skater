import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSkipRateLimitRequest } from '../lib/rateLimit.js';

test('shouldSkipRateLimitRequest skips CORS preflight requests', () => {
  assert.equal(shouldSkipRateLimitRequest({ method: 'OPTIONS' }), true);
  assert.equal(shouldSkipRateLimitRequest({ method: 'POST' }), false);
  assert.equal(shouldSkipRateLimitRequest({ method: 'GET' }), false);
});
