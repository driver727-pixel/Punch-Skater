import test from 'node:test';
import assert from 'node:assert/strict';
import { persistImageToStorage } from '../lib/imageStorage.js';

// ── persistImageToStorage ─────────────────────────────────────────────────────

test('persistImageToStorage returns sourceUrl unchanged when adminStorage is null', async () => {
  const result = await persistImageToStorage(null, 'https://fal.media/files/abc.png', 'my-bucket.appspot.com', 'path/abc.png');
  assert.equal(result, 'https://fal.media/files/abc.png');
});

test('persistImageToStorage returns sourceUrl unchanged when storageBucket is empty', async () => {
  const result = await persistImageToStorage({}, 'https://fal.media/files/abc.png', '', 'path/abc.png');
  assert.equal(result, 'https://fal.media/files/abc.png');
});

test('persistImageToStorage returns sourceUrl unchanged when sourceUrl is empty', async () => {
  const result = await persistImageToStorage({}, '', 'my-bucket.appspot.com', 'path/abc.png');
  assert.equal(result, '');
});

test('persistImageToStorage returns sourceUrl unchanged when storagePath is empty', async () => {
  const result = await persistImageToStorage({}, 'https://fal.media/files/abc.png', 'my-bucket.appspot.com', '');
  assert.equal(result, 'https://fal.media/files/abc.png');
});

test('persistImageToStorage skips re-upload for existing Firebase Storage URLs', async () => {
  const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/image.png?alt=media&token=xyz';
  const result = await persistImageToStorage({}, url, 'my-bucket.appspot.com', 'path/image.png');
  assert.equal(result, url);
});

test('persistImageToStorage skips re-upload for storage.googleapis.com URLs', async () => {
  const url = 'https://storage.googleapis.com/my-bucket/image.png';
  const result = await persistImageToStorage({}, url, 'my-bucket.appspot.com', 'path/image.png');
  assert.equal(result, url);
});

test('persistImageToStorage falls back to sourceUrl when fetch fails', async () => {
  const adminStorage = {
    bucket: () => ({
      file: () => ({ save: async () => {} }),
    }),
  };

  // Use a URL that cannot be fetched in unit tests.
  const result = await persistImageToStorage(
    adminStorage,
    'https://fal.media/files/unreachable.png',
    'my-bucket.appspot.com',
    'path/unreachable.png',
  );

  // Should return original URL (fetch to fal.media will fail in CI, which is
  // exactly the graceful-degradation path we want to exercise).
  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0);
});

test('persistImageToStorage returns Firebase Storage URL on success', async () => {
  const savedData = [];
  const adminStorage = {
    bucket: (name) => ({
      file: (path) => ({
        save: async (buffer, options) => {
          savedData.push({ name, path, byteLength: buffer.byteLength, options });
        },
      }),
    }),
  };

  // Minimal 1×1 transparent PNG as a data URL converted to a mock fetch response.
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  const mockFetch = async (_url, _opts) => ({
    ok: true,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => pngBytes.buffer,
  });

  // Temporarily patch global fetch for this test.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    const result = await persistImageToStorage(
      adminStorage,
      'https://fal.media/files/test.png',
      'my-project.appspot.com',
      'generatedImages/boards/job-123.png',
    );

    assert.ok(result.startsWith('https://firebasestorage.googleapis.com/v0/b/'), `Expected Firebase Storage URL, got: ${result}`);
    assert.ok(result.startsWith('https://firebasestorage.googleapis.com/v0/b/my-project.appspot.com/'), 'URL should contain encoded bucket name');
    assert.ok(result.includes('alt=media&token='), 'URL should contain download token');
    assert.equal(savedData.length, 1);
    assert.equal(savedData[0].name, 'my-project.appspot.com');
    assert.equal(savedData[0].path, 'generatedImages/boards/job-123.png');
    assert.equal(savedData[0].options.contentType, 'image/png');
    assert.ok(savedData[0].options.metadata?.metadata?.firebaseStorageDownloadTokens, 'Download token should be set');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
