import {
  extractFalRequestConfigCandidate,
  sanitizeFalRequestConfig,
} from './fal.js';

const DEFAULT_FAL_IMAGE_SIZE = { width: 750, height: 1050 };
const DEFAULT_FAL_NUM_INFERENCE_STEPS = 20;
const DEFAULT_FAL_GUIDANCE_SCALE = 3.5;
const DEFAULT_FAL_NUM_IMAGES = 1;
const DEFAULT_FAL_ENABLE_SAFETY_CHECKER = true;
const DEFAULT_FAL_OUTPUT_FORMAT = 'png';
const DEFAULT_FAL_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_FAL_CONFIG_CACHE_ENTRIES = 8;

function resolveFalLoraScale(rawValue, envName, logger) {
  const parsedValue = Number.parseFloat(rawValue || '1');
  if (rawValue && !Number.isFinite(parsedValue)) {
    logger.warn(`⚠️  ${envName} is invalid — falling back to 1.`);
    return 1;
  }

  return Number.isFinite(parsedValue) ? parsedValue : 1;
}

function buildDefaultLoras(path, scale) {
  return path ? [{ path, scale }] : [];
}

function buildSavedCacheEntry(payload, fetchedAt) {
  return { payload, fetchedAt };
}

export function normalizeFalProfile(value) {
  return value === 'character' ? 'character' : 'default';
}

export function readFalRequestConfig(env = process.env, logger = console) {
  const defaultFalLoraScale = resolveFalLoraScale(env.FAL_LORA_SCALE, 'FAL_LORA_SCALE', logger);
  const characterFalLoraScale = resolveFalLoraScale(
    env.FAL_CHARACTER_LORA_SCALE,
    'FAL_CHARACTER_LORA_SCALE',
    logger,
  );

  return {
    cacheTtlMs: DEFAULT_FAL_CONFIG_CACHE_TTL_MS,
    maxCacheEntries: DEFAULT_MAX_FAL_CONFIG_CACHE_ENTRIES,
    profiles: {
      character: {
        modelUrl: env.FAL_CHARACTER_IMAGE_MODEL_URL || 'https://fal.run/fal-ai/flux-2/lora',
        configUrl: env.FAL_CHARACTER_CONFIG_URL || 'https://v3b.fal.media/files/b/0a962cdb/GvvgV0ByFDT7TB0SNb9Dc_config_cf867d1b-1b55-45d1-a4a4-fe5e223ec932.json',
        defaultLoras: buildDefaultLoras(
          env.FAL_CHARACTER_LORA_PATH || 'https://v3b.fal.media/files/b/0a962cda/rW-WL7L6NIqULjsRzuyV7_pytorch_lora_weights.safetensors',
          characterFalLoraScale,
        ),
      },
      default: {
        modelUrl: env.FAL_IMAGE_MODEL_URL || 'https://fal.run/fal-ai/flux-lora',
        configUrl: env.FAL_CONFIG_URL || env.FAL_LORA_CONFIG_URL || '',
        defaultLoras: buildDefaultLoras(
          env.FAL_LORA_PATH || 'https://v3b.fal.media/files/b/0a961b80/LZYfVjdfVXWWb7gMl4kL2_pytorch_lora_weights.safetensors',
          defaultFalLoraScale,
        ),
      },
    },
    requestDefaults: {
      enable_safety_checker: DEFAULT_FAL_ENABLE_SAFETY_CHECKER,
      guidance_scale: DEFAULT_FAL_GUIDANCE_SCALE,
      image_size: DEFAULT_FAL_IMAGE_SIZE,
      num_images: DEFAULT_FAL_NUM_IMAGES,
      num_inference_steps: DEFAULT_FAL_NUM_INFERENCE_STEPS,
      output_format: DEFAULT_FAL_OUTPUT_FORMAT,
    },
  };
}

export function resolveFalProfile(profile, profiles) {
  return normalizeFalProfile(profile) === 'character'
    ? profiles.character
    : profiles.default;
}

export function createFalRequestConfigLoader({
  fetchImpl = fetch,
  cacheTtlMs = DEFAULT_FAL_CONFIG_CACHE_TTL_MS,
  maxCacheEntries = DEFAULT_MAX_FAL_CONFIG_CACHE_ENTRIES,
  logger = console,
} = {}) {
  const falRequestConfigCache = new Map();

  function cacheFalRequestConfig(configUrl, payload, fetchedAt) {
    if (!falRequestConfigCache.has(configUrl) && falRequestConfigCache.size >= maxCacheEntries) {
      // This cache intentionally uses FIFO eviction because configs are refreshed
      // on a short TTL and do not need full LRU bookkeeping.
      const oldestKey = falRequestConfigCache.keys().next().value;
      if (oldestKey) falRequestConfigCache.delete(oldestKey);
    }

    falRequestConfigCache.set(configUrl, buildSavedCacheEntry(payload, fetchedAt));
    return payload;
  }

  return async function getRemoteFalRequestConfig(configUrl) {
    if (!configUrl) return null;

    const now = Date.now();
    const cachedEntry = falRequestConfigCache.get(configUrl);
    const hasFreshCache =
      cachedEntry?.payload &&
      now - cachedEntry.fetchedAt < cacheTtlMs;

    if (hasFreshCache) {
      return cachedEntry.payload;
    }

    try {
      const upstream = await fetchImpl(configUrl);
      if (!upstream.ok) {
        throw new Error(`Remote FAL config fetch from ${configUrl} failed with ${upstream.status} ${upstream.statusText}.`);
      }

      const payload = await upstream.json();
      const config = sanitizeFalRequestConfig(extractFalRequestConfigCandidate(payload));

      if (!config) {
        return cacheFalRequestConfig(configUrl, {}, now);
      }

      return cacheFalRequestConfig(configUrl, config, now);
    } catch (error) {
      logger.error(`Fal config refresh failed for ${configUrl}:`, error);

      if (cachedEntry?.payload) {
        return cachedEntry.payload;
      }

      return null;
    }
  };
}

export function createFalImageRequestBuilder({
  getRemoteFalRequestConfig,
  requestDefaults,
  resolveFalProfile,
}) {
  return async function buildFalImageRequest(body = {}) {
    const profile = normalizeFalProfile(typeof body.fal_profile === 'string' ? body.fal_profile.trim() : '');
    const profileSettings = resolveFalProfile(profile);
    const remoteConfig = await getRemoteFalRequestConfig(profileSettings.configUrl);
    const requestedLoras = Array.isArray(body.loras) ? body.loras : undefined;
    const remoteDefaults = remoteConfig ?? {};
    const upstreamBody = { ...body };
    delete upstreamBody.fal_profile;

    return {
      ...upstreamBody,
      image_size: body.image_size ?? remoteDefaults.image_size ?? requestDefaults.image_size,
      num_inference_steps: body.num_inference_steps ?? remoteDefaults.num_inference_steps ?? requestDefaults.num_inference_steps,
      guidance_scale: body.guidance_scale ?? remoteDefaults.guidance_scale ?? requestDefaults.guidance_scale,
      num_images: body.num_images ?? remoteDefaults.num_images ?? requestDefaults.num_images,
      enable_safety_checker: body.enable_safety_checker ?? remoteDefaults.enable_safety_checker ?? requestDefaults.enable_safety_checker,
      output_format: body.output_format ?? remoteDefaults.output_format ?? requestDefaults.output_format,
      loras: requestedLoras ?? remoteDefaults.loras ?? profileSettings.defaultLoras,
    };
  };
}
