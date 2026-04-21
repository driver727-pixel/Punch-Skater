import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFalRequestConfigCandidate,
  normalizeBoardReferenceUrls,
  sanitizeFalRequestConfig,
} from '../lib/fal.js';
import {
  createFalImageRequestBuilder,
  createFalRequestConfigLoader,
  normalizeFalProfile,
  readFalRequestConfig,
  resolveFalProfile,
} from '../lib/falRequest.js';

test('extractFalRequestConfigCandidate finds nested config payloads', () => {
  const candidate = extractFalRequestConfigCandidate({
    settings: { guidance_scale: 4, lora_path: 'https://fal.media/files/x/model.safetensors' },
  });
  assert.deepEqual(candidate, {
    guidance_scale: 4,
    lora_path: 'https://fal.media/files/x/model.safetensors',
  });
});

test('sanitizeFalRequestConfig normalizes lora shorthand into loras array', () => {
  const config = sanitizeFalRequestConfig({
    guidance_scale: 4,
    lora_path: 'https://fal.media/files/x/model.safetensors',
    lora_scale: '0.75',
  });

  assert.deepEqual(config, {
    guidance_scale: 4,
    loras: [{ path: 'https://fal.media/files/x/model.safetensors', scale: 0.75 }],
  });
});

test('normalizeBoardReferenceUrls accepts canonical board asset URLs including webp', () => {
  const urls = normalizeBoardReferenceUrls([
    'https://punchskater.com/assets/boards/deck/street.webp',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.webp',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.webp',
    'https://punchskater.com/assets/boards/battery/peli.webp',
  ]);

  assert.deepEqual(urls, [
    'https://punchskater.com/assets/boards/deck/street.webp',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.webp',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.webp',
    'https://punchskater.com/assets/boards/battery/peli.webp',
  ]);
});

test('normalizeBoardReferenceUrls accepts canonical board asset URLs with png extension', () => {
  const urls = normalizeBoardReferenceUrls([
    'https://punchskater.com/assets/boards/deck/street.png',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.png',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.png',
    'https://punchskater.com/assets/boards/battery/slim-battery.png',
  ]);

  assert.deepEqual(urls, [
    'https://punchskater.com/assets/boards/deck/street.png',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.png',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.png',
    'https://punchskater.com/assets/boards/battery/slim-battery.png',
  ]);
});

test('normalizeBoardReferenceUrls accepts canonical board asset URLs with version query params', () => {
  const urls = normalizeBoardReferenceUrls([
    'https://punchskater.com/assets/boards/deck/street.png?v=2026-04-20',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.png?v=2026-04-20',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.png?v=2026-04-20',
    'https://punchskater.com/assets/boards/battery/slim-battery.png?v=2026-04-20',
  ]);

  assert.deepEqual(urls, [
    'https://punchskater.com/assets/boards/deck/street.png?v=2026-04-20',
    'https://punchskater.com/assets/boards/drivetrain/gear-drive.png?v=2026-04-20',
    'https://punchskater.com/assets/boards/wheels/cloud-wheels.png?v=2026-04-20',
    'https://punchskater.com/assets/boards/battery/slim-battery.png?v=2026-04-20',
  ]);
});

test('normalizeBoardReferenceUrls rejects non-canonical origins and paths', () => {
  assert.equal(
    normalizeBoardReferenceUrls([
      'https://evil.example/assets/boards/deck/street.webp',
      'https://punchskater.com/assets/boards/drivetrain/gear-drive.webp',
      'https://punchskater.com/assets/boards/wheels/cloud-wheels.webp',
      'https://punchskater.com/assets/boards/battery/peli.webp',
    ]),
    null,
  );
});

test('readFalRequestConfig normalizes env-backed Fal profiles and warns on invalid scales', () => {
  const warnings = [];
  const config = readFalRequestConfig({
    FAL_IMAGE_MODEL_URL: 'https://fal.run/default-model',
    FAL_LORA_PATH: 'https://fal.media/default.safetensors',
    FAL_LORA_SCALE: '0.75',
    FAL_CHARACTER_IMAGE_MODEL_URL: 'https://fal.run/character-model',
    FAL_CHARACTER_LORA_PATH: 'https://fal.media/character.safetensors',
    FAL_CHARACTER_LORA_SCALE: 'nope',
  }, {
    warn: (message) => warnings.push(message),
  });

  assert.equal(normalizeFalProfile('unknown'), 'default');
  assert.equal(normalizeFalProfile('character'), 'character');
  assert.deepEqual(resolveFalProfile('character', config.profiles), {
    modelUrl: 'https://fal.run/character-model',
    configUrl: 'https://v3b.fal.media/files/b/0a962cdb/GvvgV0ByFDT7TB0SNb9Dc_config_cf867d1b-1b55-45d1-a4a4-fe5e223ec932.json',
    defaultLoras: [{ path: 'https://fal.media/character.safetensors', scale: 1 }],
  });
  assert.deepEqual(resolveFalProfile('default', config.profiles), {
    modelUrl: 'https://fal.run/default-model',
    configUrl: '',
    defaultLoras: [{ path: 'https://fal.media/default.safetensors', scale: 0.75 }],
  });
  assert.deepEqual(warnings, ['⚠️  FAL_CHARACTER_LORA_SCALE is invalid — falling back to 1.']);
});

test('normalizeFalProfile falls back to default for invalid values', () => {
  assert.equal(normalizeFalProfile(''), 'default');
  assert.equal(normalizeFalProfile(null), 'default');
  assert.equal(normalizeFalProfile(undefined), 'default');
  assert.equal(normalizeFalProfile(123), 'default');
  assert.equal(normalizeFalProfile({ profile: 'character' }), 'default');
});

test('createFalImageRequestBuilder merges remote config with request and profile defaults', async () => {
  const fetchCalls = [];
  const getRemoteFalRequestConfig = createFalRequestConfigLoader({
    fetchImpl: async (url) => {
      fetchCalls.push(url);
      return {
        ok: true,
        json: async () => ({
          config: {
            guidance_scale: 6,
            num_inference_steps: 28,
            output_format: 'jpeg',
          },
        }),
      };
    },
    logger: { error: () => {} },
  });
  const profiles = {
    character: {
      modelUrl: 'https://fal.run/character-model',
      configUrl: 'https://fal.media/character-config.json',
      defaultLoras: [{ path: 'https://fal.media/character.safetensors', scale: 0.9 }],
    },
    default: {
      modelUrl: 'https://fal.run/default-model',
      configUrl: '',
      defaultLoras: [{ path: 'https://fal.media/default.safetensors', scale: 1 }],
    },
  };
  const buildFalImageRequest = createFalImageRequestBuilder({
    getRemoteFalRequestConfig,
    requestDefaults: {
      enable_safety_checker: true,
      guidance_scale: 3.5,
      image_size: { width: 750, height: 1050 },
      num_images: 1,
      num_inference_steps: 20,
      output_format: 'png',
    },
    resolveFalProfile: (profile) => resolveFalProfile(profile, profiles),
  });

  const request = await buildFalImageRequest({
    fal_profile: 'character',
    num_images: 2,
    prompt: 'A skater portrait',
  });

  assert.deepEqual(request, {
    prompt: 'A skater portrait',
    image_size: { width: 750, height: 1050 },
    num_inference_steps: 28,
    guidance_scale: 6,
    num_images: 2,
    enable_safety_checker: true,
    output_format: 'jpeg',
    loras: [{ path: 'https://fal.media/character.safetensors', scale: 0.9 }],
  });
  assert.deepEqual(fetchCalls, ['https://fal.media/character-config.json']);
});
