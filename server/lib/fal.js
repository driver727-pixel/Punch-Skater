const BOARD_REFERENCE_IMAGE_PATH_PATTERN =
  // Board reference assets may be PNG, WebP, or JPEG files, with a
  // case-insensitive extension match across the canonical deck, drivetrain,
  // motor, wheels, and battery folders.
  /^\/assets\/boards\/(deck|drivetrain|motor|wheels|battery)\/[a-z0-9-]+\.(png|webp|jpe?g)$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseFalScale(value, fallback = 1) {
  const parsed =
    value == null
      ? fallback
      : typeof value === 'number'
        ? value
        : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFalLoraEntry(entry) {
  if (!isPlainObject(entry)) return null;

  const path = typeof entry.path === 'string' ? entry.path.trim()
    : typeof entry.url === 'string' ? entry.url.trim()
      : '';
  if (!path) return null;

  return {
    path,
    scale: parseFalScale(entry.scale, 1),
  };
}

function normalizeFalLoras(value, fallbackScale = 1) {
  if (Array.isArray(value)) {
    const loras = value
      .map((entry) => normalizeFalLoraEntry(entry))
      .filter(Boolean);
    return loras.length ? loras : undefined;
  }

  if (isPlainObject(value)) {
    const lora = normalizeFalLoraEntry(value);
    return lora ? [lora] : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    return [{ path: value.trim(), scale: fallbackScale }];
  }

  return undefined;
}

export function extractFalRequestConfigCandidate(payload) {
  if (!isPlainObject(payload)) return null;

  const candidates = [
    payload.input,
    payload.config,
    payload.settings,
    payload.parameters,
    payload.defaults,
    payload.fal,
    payload.fal_config,
    payload.falConfig,
    payload.request,
    payload.request_body,
    payload,
  ];

  return candidates.find((candidate) => {
    if (!isPlainObject(candidate)) return false;

    return [
      'image_size',
      'num_inference_steps',
      'guidance_scale',
      'num_images',
      'enable_safety_checker',
      'output_format',
      'loras',
      'lora',
      'lora_path',
      'path',
      'diffusers_lora_file',
      'config_file',
    ].some((key) => candidate[key] !== undefined);
  }) ?? null;
}

export function sanitizeFalRequestConfig(candidate) {
  if (!isPlainObject(candidate)) return null;

  const config = {};
  const loraScale = parseFalScale(candidate.lora_scale, 1);
  const scale = parseFalScale(candidate.scale, 1);

  const maybeLoras =
    normalizeFalLoras(candidate.loras) ??
    normalizeFalLoras(candidate.lora) ??
    normalizeFalLoras(candidate.lora_path, loraScale) ??
    normalizeFalLoras(candidate.path, scale) ??
    normalizeFalLoras(candidate.diffusers_lora_file, loraScale);

  if (candidate.image_size !== undefined) config.image_size = candidate.image_size;
  if (candidate.num_inference_steps !== undefined) config.num_inference_steps = candidate.num_inference_steps;
  if (candidate.guidance_scale !== undefined) config.guidance_scale = candidate.guidance_scale;
  if (candidate.num_images !== undefined) config.num_images = candidate.num_images;
  if (candidate.enable_safety_checker !== undefined) config.enable_safety_checker = candidate.enable_safety_checker;
  if (candidate.output_format !== undefined) config.output_format = candidate.output_format;
  if (maybeLoras !== undefined) config.loras = maybeLoras;

  return Object.keys(config).length ? config : null;
}

export function normalizeBoardReferenceUrls(value, publicOrigin = 'https://punchskater.com') {
  if (!Array.isArray(value) || value.length !== 4) return null;

  const urls = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    const trimmed = entry.trim();
    if (!trimmed) return null;

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }

    if (parsed.origin !== publicOrigin) return null;
    if (!BOARD_REFERENCE_IMAGE_PATH_PATTERN.test(parsed.pathname)) return null;
    urls.push(parsed.toString());
  }

  return urls;
}

export { isPlainObject, parseFalScale, normalizeFalLoras };
