import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import 'dotenv/config';
import { createRequire } from 'module';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { cert, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { createBattleCardSnapshot, resolveBattleWithEffects } from './battle.js';

// Load the shared pricing config — the single source of truth for Stripe
// price IDs, buy URLs, and display prices.  Update src/lib/tierPricing.json
// to change prices; this file derives ALLOWED_PRICE_IDS from it automatically.
const nodeRequire = createRequire(import.meta.url);
const tierPricing = nodeRequire('../src/lib/tierPricing.json');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Render (and most PaaS reverse-proxies) add X-Forwarded-For so Express can
// determine the real client IP.  Without trust proxy = 1, express-rate-limit
// throws a ValidationError and rate-limiting cannot identify callers correctly.
app.set('trust proxy', 1);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https://*.fal.media', 'https://*.firebaseapp.com'],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      workerSrc: ["'self'", 'blob:'],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS only when the connection is already secure (behind TLS proxy like Render)
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Allow the production site, GitHub Pages, and localhost to call this server
app.use(cors({
  origin: ['https://punchskater.com', 'https://driver727-pixel.github.io', 'http://localhost:5173'],
}));

app.use(express.json({ limit: '256kb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Each IP may call the image-generation / background-removal endpoints at most
// 20 times per minute. This prevents abuse that would run up the Fal.ai bill.
const imageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many image requests — please wait a moment and try again.' },
});

// The import endpoint is cheaper to call, so allow a somewhat higher burst.
const importRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

// Stripe checkout sessions — tightly rate-limited to prevent abuse.
const checkoutRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many checkout requests — please wait a moment and try again.' },
});

// Admin user-creation — very tightly rate-limited.
const adminUserRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many admin requests — please wait a moment and try again.' },
});

const weatherRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many weather requests — please wait a moment and try again.' },
});

const battleRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many battle requests — please wait a moment and try again.' },
});

const FAL_KEY = process.env.FAL_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
const FIREBASE_ADMIN_CLIENT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
const FIREBASE_ADMIN_PRIVATE_KEY = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const DEFAULT_FAL_URL = process.env.FAL_IMAGE_MODEL_URL || 'https://fal.run/fal-ai/flux-lora';
const DEFAULT_FAL_CONFIG_URL = process.env.FAL_CONFIG_URL || process.env.FAL_LORA_CONFIG_URL || '';
const DEFAULT_FAL_LORA_PATH = process.env.FAL_LORA_PATH || 'https://v3b.fal.media/files/b/0a961b80/LZYfVjdfVXWWb7gMl4kL2_pytorch_lora_weights.safetensors';
const rawFalLoraScale = Number.parseFloat(process.env.FAL_LORA_SCALE || '1');
const DEFAULT_FAL_LORA_SCALE = Number.isFinite(rawFalLoraScale) ? rawFalLoraScale : 1;
if (process.env.FAL_LORA_SCALE && !Number.isFinite(rawFalLoraScale)) {
  console.warn('⚠️  FAL_LORA_SCALE is invalid — falling back to 1.');
}
const DEFAULT_FAL_LORAS = DEFAULT_FAL_LORA_PATH
  ? [{ path: DEFAULT_FAL_LORA_PATH, scale: DEFAULT_FAL_LORA_SCALE }]
  : [];
const CHARACTER_FAL_URL = process.env.FAL_CHARACTER_IMAGE_MODEL_URL || 'https://fal.run/fal-ai/flux-2/lora';
const CHARACTER_FAL_CONFIG_URL = process.env.FAL_CHARACTER_CONFIG_URL || 'https://v3b.fal.media/files/b/0a962cdb/GvvgV0ByFDT7TB0SNb9Dc_config_cf867d1b-1b55-45d1-a4a4-fe5e223ec932.json';
const CHARACTER_FAL_LORA_PATH = process.env.FAL_CHARACTER_LORA_PATH || 'https://v3b.fal.media/files/b/0a962cda/rW-WL7L6NIqULjsRzuyV7_pytorch_lora_weights.safetensors';
const rawCharacterFalLoraScale = Number.parseFloat(process.env.FAL_CHARACTER_LORA_SCALE || '1');
const CHARACTER_FAL_LORA_SCALE = Number.isFinite(rawCharacterFalLoraScale) ? rawCharacterFalLoraScale : 1;
if (process.env.FAL_CHARACTER_LORA_SCALE && !Number.isFinite(rawCharacterFalLoraScale)) {
  console.warn('⚠️  FAL_CHARACTER_LORA_SCALE is invalid — falling back to 1.');
}
const CHARACTER_FAL_LORAS = CHARACTER_FAL_LORA_PATH
  ? [{ path: CHARACTER_FAL_LORA_PATH, scale: CHARACTER_FAL_LORA_SCALE }]
  : [];
const DEFAULT_FAL_IMAGE_SIZE = { width: 750, height: 1050 };
const DEFAULT_FAL_NUM_INFERENCE_STEPS = 28;
const DEFAULT_FAL_GUIDANCE_SCALE = 3.5;
const DEFAULT_FAL_NUM_IMAGES = 1;
const DEFAULT_FAL_ENABLE_SAFETY_CHECKER = true;
const DEFAULT_FAL_OUTPUT_FORMAT = 'png';
const FAL_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const BIREFNET_URL = 'https://fal.run/fal-ai/birefnet';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
const HEAVY_RAIN_MM = 7;
const HEATWAVE_TEMP_C = 35;
const STRONG_WIND_KPH = 45;
const HEAVY_RAIN_CODES = new Set([63, 65, 82, 95, 96, 99]);

const DISTRICT_WEATHER_LOCATIONS = {
  Airaway: { city: 'Brisbane', state: 'QLD', latitude: -27.4698, longitude: 153.0251 },
  Electropolis: { city: 'Sydney', state: 'NSW', latitude: -33.8688, longitude: 151.2093 },
  'Glass City': { city: 'Melbourne', state: 'VIC', latitude: -37.8136, longitude: 144.9631 },
  'The Grid': { city: 'Canberra', state: 'ACT', latitude: -35.2809, longitude: 149.13 },
  Batteryville: { city: 'Adelaide', state: 'SA', latitude: -34.9285, longitude: 138.6007 },
  'The Roads': { city: 'Alice Springs', state: 'NT', latitude: -23.698, longitude: 133.8807 },
  Nightshade: { city: 'Perth', state: 'WA', latitude: -31.9523, longitude: 115.8613 },
  'The Forest': { city: 'Hobart', state: 'TAS', latitude: -42.8821, longitude: 147.3272 },
};

let districtWeatherCache = {
  payload: null,
  fetchedAt: 0,
};

const falRequestConfigCache = new Map();

// Allowed Stripe price IDs — derived from src/lib/tierPricing.json so that
// updating prices only requires editing that one file.
const ALLOWED_PRICE_IDS = new Set(
  Object.values(tierPricing)
    .map((t) => t.stripePriceId)
    .filter(Boolean),
);

function resolveTierFromPriceId(priceId) {
  for (const [tier, config] of Object.entries(tierPricing)) {
    if (config.stripePriceId === priceId) return tier;
  }
  return null;
}

// Stripe client — instantiated once at startup so it is reused across requests.
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

function createComparableDigest(value) {
  return createHash('sha256').update(value).digest();
}

function timingSafeEmailMatches(left, right) {
  return timingSafeEqual(
    createComparableDigest(left.trim().toLowerCase()),
    createComparableDigest(right.trim().toLowerCase()),
  );
}

function sendCheckoutVerificationFailure(res) {
  res.status(409).json({ error: 'Checkout session could not be verified.' });
}

if (!FAL_KEY) {
  console.warn('⚠️  FAL_KEY environment variable is not set — requests will be rejected by Fal.ai.');
}
if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY environment variable is not set — checkout sessions will be unavailable.');
}
if (!FIREBASE_API_KEY) {
  console.warn('⚠️  FIREBASE_API_KEY environment variable is not set — admin user creation will be unavailable.');
}

function getFirebaseServiceAccount() {
  if (FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
      return {
        projectId: parsed.project_id ?? parsed.projectId ?? FIREBASE_PROJECT_ID,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: typeof parsed.private_key === 'string'
          ? parsed.private_key.replace(/\\n/g, '\n')
          : typeof parsed.privateKey === 'string'
            ? parsed.privateKey.replace(/\\n/g, '\n')
            : '',
      };
    } catch (error) {
      console.error('Firebase service-account JSON is invalid:', error);
      return null;
    }
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
    return null;
  }

  return {
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
}

function createFirebaseAdminServices() {
  const serviceAccount = getFirebaseServiceAccount();
  if (!serviceAccount?.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    return { adminAuth: null, adminDb: null };
  }

  const app = getApps()[0] ?? initializeAdminApp({
    credential: cert(serviceAccount),
  });

  return {
    adminAuth: getAdminAuth(app),
    adminDb: getAdminFirestore(app),
  };
}

const { adminAuth, adminDb } = createFirebaseAdminServices();

if (!adminAuth || !adminDb) {
  console.warn(
    '⚠️  Firebase Admin credentials are not set — set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY to enable secure battle resolution.',
  );
}

async function authenticateFirebaseUser(req) {
  if (!adminAuth) {
    throw Object.assign(new Error('Firebase Admin authentication is not configured.'), { statusCode: 503 });
  }

  const authHeader = req.headers.authorization ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    throw Object.assign(new Error('Missing Authorization header.'), { statusCode: 401 });
  }

  try {
    return await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    throw Object.assign(new Error('Invalid or expired ID token.'), { statusCode: 401 });
  }
}

function roundWeatherMetric(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(1));
}

function resolveWeatherSummary({ rainMm, weatherCode, windSpeedKph, temperatureC }) {
  if ((rainMm ?? 0) >= HEAVY_RAIN_MM || HEAVY_RAIN_CODES.has(weatherCode ?? -1)) return 'Heavy rain';
  if ((rainMm ?? 0) > 0) return 'Rain';
  if ((windSpeedKph ?? 0) >= STRONG_WIND_KPH) return 'Strong wind';
  if ((temperatureC ?? 0) >= HEATWAVE_TEMP_C) return 'Heatwave';
  return 'Clear';
}

function buildWeatherAccessRule(district, city, summary) {
  if (summary !== 'Heavy rain') return null;
  return {
    requiredBoardType: 'Mountain',
    reason: `Heavy rain over ${city} has turned ${district} into Mountain-board-only territory.`,
    source: 'heavy-rain',
  };
}

function buildFallbackDistrictWeatherPayload() {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    stale: true,
    source: 'fallback',
    districts: Object.entries(DISTRICT_WEATHER_LOCATIONS).map(([district, location]) => ({
      district,
      city: location.city,
      state: location.state,
      summary: 'Weather uplink offline',
      temperatureC: null,
      windSpeedKph: null,
      rainMm: null,
      weatherCode: null,
      updatedAt: generatedAt,
      accessRule: null,
    })),
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFalLoraEntry(entry) {
  if (!isPlainObject(entry)) return null;

  const path = typeof entry.path === 'string' ? entry.path.trim() : '';
  if (!path) return null;

  const rawScale = parseFalScale(entry.scale, 1);

  return {
    path,
    scale: Number.isFinite(rawScale) ? rawScale : 1,
  };
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

function extractFalRequestConfigCandidate(payload) {
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
    ].some((key) => candidate[key] !== undefined);
  }) ?? null;
}

function sanitizeFalRequestConfig(candidate) {
  if (!isPlainObject(candidate)) return null;

  const config = {};
  const loraScale = parseFalScale(candidate.lora_scale, 1);
  const scale = parseFalScale(candidate.scale, 1);

  const maybeLoras =
    normalizeFalLoras(candidate.loras) ??
    normalizeFalLoras(candidate.lora) ??
    normalizeFalLoras(candidate.lora_path, loraScale) ??
    normalizeFalLoras(candidate.path, scale);

  if (candidate.image_size !== undefined) config.image_size = candidate.image_size;
  if (candidate.num_inference_steps !== undefined) config.num_inference_steps = candidate.num_inference_steps;
  if (candidate.guidance_scale !== undefined) config.guidance_scale = candidate.guidance_scale;
  if (candidate.num_images !== undefined) config.num_images = candidate.num_images;
  if (candidate.enable_safety_checker !== undefined) config.enable_safety_checker = candidate.enable_safety_checker;
  if (candidate.output_format !== undefined) config.output_format = candidate.output_format;
  if (maybeLoras !== undefined) config.loras = maybeLoras;

  return Object.keys(config).length ? config : null;
}

function normalizeFalProfile(value) {
  return value === 'character' ? 'character' : 'default';
}

function resolveFalProfile(profile) {
  if (profile === 'character') {
    return {
      modelUrl: CHARACTER_FAL_URL,
      configUrl: CHARACTER_FAL_CONFIG_URL,
      defaultLoras: CHARACTER_FAL_LORAS,
    };
  }

  return {
    modelUrl: DEFAULT_FAL_URL,
    configUrl: DEFAULT_FAL_CONFIG_URL,
    defaultLoras: DEFAULT_FAL_LORAS,
  };
}

async function getRemoteFalRequestConfig(configUrl) {
  if (!configUrl) return null;

  const now = Date.now();
  const cachedEntry = falRequestConfigCache.get(configUrl);
  const hasFreshCache =
    cachedEntry?.payload &&
    now - cachedEntry.fetchedAt < FAL_CONFIG_CACHE_TTL_MS;

  if (hasFreshCache) {
    return cachedEntry.payload;
  }

  try {
    const upstream = await fetch(configUrl);
    if (!upstream.ok) {
      throw new Error(`Remote Fal config fetch from ${configUrl} failed with ${upstream.status} ${upstream.statusText}.`);
    }

    const payload = await upstream.json();
    const config = sanitizeFalRequestConfig(extractFalRequestConfigCandidate(payload));

    if (!config) {
      throw new Error('Remote config JSON did not contain supported Fal request fields.');
    }

    falRequestConfigCache.set(configUrl, {
      payload: config,
      fetchedAt: now,
    });

    return config;
  } catch (err) {
    console.error(`Fal config refresh failed for ${configUrl}:`, err);

    if (cachedEntry?.payload) {
      return cachedEntry.payload;
    }

    return null;
  }
}

async function buildFalImageRequest(body = {}) {
  const profile = normalizeFalProfile(typeof body.fal_profile === 'string' ? body.fal_profile.trim() : '');
  const profileSettings = resolveFalProfile(profile);
  const remoteConfig = await getRemoteFalRequestConfig(profileSettings.configUrl);
  const requestedLoras = Array.isArray(body.loras) ? body.loras : undefined;
  const remoteDefaults = remoteConfig ?? {};
  const upstreamBody = { ...body };
  delete upstreamBody.fal_profile;

  return {
    ...upstreamBody,
    image_size: body.image_size ?? remoteDefaults.image_size ?? DEFAULT_FAL_IMAGE_SIZE,
    num_inference_steps: body.num_inference_steps ?? remoteDefaults.num_inference_steps ?? DEFAULT_FAL_NUM_INFERENCE_STEPS,
    guidance_scale: body.guidance_scale ?? remoteDefaults.guidance_scale ?? DEFAULT_FAL_GUIDANCE_SCALE,
    num_images: body.num_images ?? remoteDefaults.num_images ?? DEFAULT_FAL_NUM_IMAGES,
    enable_safety_checker: body.enable_safety_checker ?? remoteDefaults.enable_safety_checker ?? DEFAULT_FAL_ENABLE_SAFETY_CHECKER,
    output_format: body.output_format ?? remoteDefaults.output_format ?? DEFAULT_FAL_OUTPUT_FORMAT,
    loras: requestedLoras ?? remoteDefaults.loras ?? profileSettings.defaultLoras,
  };
}

async function fetchDistrictWeatherSnapshot(district, location) {
  const url = new URL(WEATHER_URL);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,rain,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'Australia/Sydney');
  url.searchParams.set('forecast_days', '1');

  const upstream = await fetch(url);
  if (!upstream.ok) {
    throw new Error(`Weather upstream failed for ${district} with ${upstream.status}.`);
  }

  const data = await upstream.json();
  const current = data?.current ?? {};
  const temperatureC = roundWeatherMetric(current.temperature_2m);
  const windSpeedKph = roundWeatherMetric(current.wind_speed_10m);
  const rainMm = roundWeatherMetric(current.rain);
  const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : null;
  const summary = resolveWeatherSummary({ rainMm, weatherCode, windSpeedKph, temperatureC });

  return {
    district,
    city: location.city,
    state: location.state,
    summary,
    temperatureC,
    windSpeedKph,
    rainMm,
    weatherCode,
    updatedAt: new Date().toISOString(),
    accessRule: buildWeatherAccessRule(district, location.city, summary),
  };
}

async function buildDistrictWeatherPayload() {
  const districts = await Promise.all(
    Object.entries(DISTRICT_WEATHER_LOCATIONS).map(([district, location]) =>
      fetchDistrictWeatherSnapshot(district, location),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    stale: false,
    source: 'live',
    districts,
  };
}

async function getDistrictWeatherPayload() {
  const now = Date.now();
  const hasFreshCache =
    districtWeatherCache.payload &&
    now - districtWeatherCache.fetchedAt < WEATHER_CACHE_TTL_MS;

  if (hasFreshCache) {
    return {
      ...districtWeatherCache.payload,
      stale: false,
      source: districtWeatherCache.payload.source === 'fallback' ? 'fallback' : 'cache',
    };
  }

  try {
    const payload = await buildDistrictWeatherPayload();
    districtWeatherCache = { payload, fetchedAt: now };
    return payload;
  } catch (err) {
    console.error('District weather refresh failed:', err);

    if (districtWeatherCache.payload) {
      return {
        ...districtWeatherCache.payload,
        stale: true,
        source: districtWeatherCache.payload.source === 'fallback' ? 'fallback' : 'cache',
      };
    }

    const fallback = buildFallbackDistrictWeatherPayload();
    districtWeatherCache = { payload: fallback, fetchedAt: now };
    return fallback;
  }
}

// Transparent proxy: the React front-end POSTs to /api/generate-image and
// this server forwards the request to Fal.ai, attaching the secret key.
app.post('/api/generate-image', imageRateLimit, async (req, res) => {
  try {
    const profile = normalizeFalProfile(typeof req.body?.fal_profile === 'string' ? req.body.fal_profile.trim() : '');
    const profileSettings = resolveFalProfile(profile);
    const upstream = await fetch(profileSettings.modelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(await buildFalImageRequest(req.body)),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { error: text }; }
      res.status(upstream.status).json(body);
      return;
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Image generation proxy failed.' });
  }
});

// Background removal proxy: strips the white/solid background from a generated
// character image and returns a transparent PNG via the Fal.ai birefnet model.
app.post('/api/remove-background', imageRateLimit, async (req, res) => {
  try {
    const upstream = await fetch(BIREFNET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${FAL_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let body;
      try { body = JSON.parse(text); } catch { body = { error: text }; }
      res.status(upstream.status).json(body);
      return;
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    console.error('Background removal proxy error:', err);
    res.status(500).json({ error: 'Background removal proxy failed.' });
  }
});

// ── JSON Import validation endpoint ──────────────────────────────────────────
// Accepts a Craftlingua envelope, a collection export, or a raw CardPayload[]
// array.  Validates structure and returns a report; does NOT persist any data.
app.post('/api/import', importRateLimit, (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object or array.' });
    return;
  }

  /** Minimal per-card required-key check (mirrors client-side importJson.ts). */
  const REQUIRED_CARD_KEYS = [
    'id', 'version', 'prompts', 'seed',
    'identity', 'stats', 'traits', 'flavorText',
    'visuals', 'tags', 'createdAt',
  ];

  let cardEntries = [];
  let detectedFormat = 'unknown';
  let language = undefined;
  let vocabulary = undefined;

  try {
    if (Array.isArray(body)) {
      cardEntries = body;
      detectedFormat = 'raw-array';
    } else if (body.source === 'craftlingua') {
      detectedFormat = 'craftlingua-envelope';
      if (!body.language || typeof body.language !== 'object' || !body.language.name || !body.language.code) {
        res.status(422).json({ error: 'Craftlingua envelope missing required "language" object with "name" and "code".' });
        return;
      }
      language = body.language;
      vocabulary = Array.isArray(body.vocabulary) ? body.vocabulary : [];
      cardEntries = Array.isArray(body.cards) ? body.cards : [];
    } else if (typeof body.version === 'string' && Array.isArray(body.cards)) {
      detectedFormat = 'collection-export';
      cardEntries = body.cards;
    } else {
      res.status(422).json({
        error: 'Unrecognised JSON format. Expected CardPayload[], { version, cards }, or { source: "craftlingua", language, cards }.',
      });
      return;
    }
  } catch (err) {
    res.status(400).json({ error: 'Failed to interpret JSON body.' });
    return;
  }

  const accepted = [];
  const rejected = [];

  for (let i = 0; i < cardEntries.length; i++) {
    const card = cardEntries[i];
    const errors = [];

    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      rejected.push({ index: i, errors: ['Entry is not an object.'] });
      continue;
    }

    for (const key of REQUIRED_CARD_KEYS) {
      if (card[key] === undefined || card[key] === null) {
        errors.push(`Missing required field: "${key}"`);
      }
    }

    if (errors.length > 0) {
      rejected.push({ index: i, id: card.id, errors });
    } else {
      accepted.push({ index: i, id: card.id });
    }
  }

  res.json({
    format: detectedFormat,
    total: cardEntries.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    accepted,
    rejected,
    ...(language ? { language } : {}),
    ...(vocabulary ? { vocabularyCount: vocabulary.length } : {}),
  });
});

app.get('/api/district-weather', weatherRateLimit, async (_req, res) => {
  const payload = await getDistrictWeatherPayload();
  res.json(payload);
});

app.post('/api/resolve-battle', battleRateLimit, async (req, res) => {
  if (!adminDb) {
    res.status(503).json({ error: 'Battle resolution is not configured on this server.' });
    return;
  }

  let caller;
  try {
    caller = await authenticateFirebaseUser(req);
  } catch (error) {
    res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
    return;
  }

  const challengerUid = caller.uid;
  const challengerDeckId = typeof req.body?.challengerDeckId === 'string' ? req.body.challengerDeckId.trim() : '';
  const defenderUid = typeof req.body?.defenderUid === 'string' ? req.body.defenderUid.trim() : '';
  const defenderDeckId = typeof req.body?.defenderDeckId === 'string' ? req.body.defenderDeckId.trim() : '';

  if (!challengerDeckId || !defenderUid || !defenderDeckId) {
    res.status(400).json({ error: 'challengerDeckId, defenderUid, and defenderDeckId are required.' });
    return;
  }

  if (challengerUid === defenderUid) {
    res.status(400).json({ error: 'You cannot challenge yourself.' });
    return;
  }

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const challengerArenaRef = adminDb.collection('arena').doc(challengerUid);
      const defenderArenaRef = adminDb.collection('arena').doc(defenderUid);
      const challengerDeckRef = adminDb.collection('users').doc(challengerUid).collection('decks').doc(challengerDeckId);
      const defenderDeckRef = adminDb.collection('users').doc(defenderUid).collection('decks').doc(defenderDeckId);
      const [challengerArenaSnap, defenderArenaSnap, challengerDeckSnap, defenderDeckSnap] = await Promise.all([
        tx.get(challengerArenaRef),
        tx.get(defenderArenaRef),
        tx.get(challengerDeckRef),
        tx.get(defenderDeckRef),
      ]);

      if (!challengerArenaSnap.exists || !defenderArenaSnap.exists) {
        throw Object.assign(new Error('One of the arena entries is no longer available.'), { statusCode: 409 });
      }

      const challengerArena = challengerArenaSnap.data();
      const defenderArena = defenderArenaSnap.data();
      if (challengerArena.deckId !== challengerDeckId || defenderArena.deckId !== defenderDeckId) {
        throw Object.assign(new Error('One of the selected decks is no longer readied for battle.'), { statusCode: 409 });
      }

      if (!challengerDeckSnap.exists || !defenderDeckSnap.exists) {
        throw Object.assign(new Error('One of the selected decks no longer exists.'), { statusCode: 409 });
      }

      const challengerDeck = challengerDeckSnap.data();
      const defenderDeck = defenderDeckSnap.data();
      if (challengerDeck.battleReady !== true || defenderDeck.battleReady !== true) {
        throw Object.assign(new Error('One of the selected decks is no longer readied for battle.'), { statusCode: 409 });
      }

      const challengerCards = Array.isArray(challengerDeck.cards) ? challengerDeck.cards.map(createBattleCardSnapshot) : [];
      const defenderCards = Array.isArray(defenderDeck.cards) ? defenderDeck.cards.map(createBattleCardSnapshot) : [];
      if (challengerCards.length === 0 || defenderCards.length === 0) {
        throw Object.assign(new Error('Both battle decks must contain at least one card.'), { statusCode: 409 });
      }

      const battleId = `battle-${randomUUID()}`;
      const battleSeed = randomUUID();
      const resolution = resolveBattleWithEffects(challengerCards, defenderCards, battleSeed);
      const winnerUid =
        resolution.winnerSide === 'challenger'
          ? challengerUid
          : resolution.winnerSide === 'defender'
            ? defenderUid
            : '';
      const now = new Date().toISOString();
      const result = {
        id: battleId,
        challengerUid,
        challengerDeckId,
        challengerDeckName: challengerDeck.name ?? challengerArena.deckName ?? 'Challenger Deck',
        defenderUid,
        defenderDeckId,
        defenderDeckName: defenderDeck.name ?? defenderArena.deckName ?? 'Defender Deck',
        winnerUid,
        challengerScore: resolution.challengerScore,
        defenderScore: resolution.defenderScore,
        wagerPoints: resolution.wagerPoints,
        winningDeckCardIds: resolution.winningDeckCardIds,
        challengerCardResolutions: resolution.challengerCardResolutions,
        defenderCardResolutions: resolution.defenderCardResolutions,
        createdAt: now,
      };

      tx.set(adminDb.collection('battleResults').doc(battleId), {
        ...result,
        _ts: FieldValue.serverTimestamp(),
      });
      tx.delete(challengerArenaRef);
      tx.delete(defenderArenaRef);
      tx.update(challengerDeckRef, { battleReady: false, updatedAt: now });
      tx.update(defenderDeckRef, { battleReady: false, updatedAt: now });

      return result;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Battle resolution error:', error);
    res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to resolve battle.' });
  }
});

// ── Stripe Checkout Sessions ──────────────────────────────────────────────────
// Creates a Stripe Checkout Session for one of the two allowed price IDs and
// returns the hosted payment page URL.  The caller supplies success_url and
// cancel_url so the user is returned to the correct page after payment.
app.post('/api/create-checkout-session', checkoutRateLimit, async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: 'Payment processing is not configured.' });
    return;
  }

  const { priceId, successUrl, cancelUrl, email } = req.body ?? {};

  if (!priceId || typeof priceId !== 'string' || !ALLOWED_PRICE_IDS.has(priceId)) {
    res.status(400).json({ error: 'Invalid or unsupported price ID.' });
    return;
  }

  const validUrl = (u) => {
    if (typeof u !== 'string') return false;
    try {
      const p = new URL(u);
      return p.protocol === 'https:' || (p.protocol === 'http:' && p.hostname === 'localhost');
    } catch { return false; }
  };

  if (!validUrl(successUrl) || !validUrl(cancelUrl)) {
    res.status(400).json({ error: 'successUrl and cancelUrl must be valid HTTPS URLs.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      ...(typeof email === 'string' && email.trim()
        ? { customer_email: email.trim() }
        : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

app.get('/api/verify-checkout-session', checkoutRateLimit, async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: 'Payment processing is not configured.' });
    return;
  }

  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';
  const expectedEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  if (!sessionId) {
    res.status(400).json({ error: 'session_id is required.' });
    return;
  }
  if (!expectedEmail) {
    res.status(400).json({ error: 'email is required.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
    const priceId = lineItems.data[0]?.price?.id;
    const paidTier = resolveTierFromPriceId(priceId);
    const sessionEmail = (session.customer_details?.email ?? session.customer_email ?? '').trim().toLowerCase();

    if (
      !priceId ||
      !paidTier ||
      session.payment_status !== 'paid' ||
      !sessionEmail ||
      !timingSafeEmailMatches(sessionEmail, expectedEmail)
    ) {
      console.warn('Stripe checkout verification rejected.', {
        sessionId,
        hasPriceId: Boolean(priceId),
        hasPaidTier: Boolean(paidTier),
        paymentStatus: session.payment_status,
        hasSessionEmail: Boolean(sessionEmail),
      });
      sendCheckoutVerificationFailure(res);
      return;
    }

    res.json({
      tier: paidTier,
      email: sessionEmail,
    });
  } catch (err) {
    console.error('Stripe checkout verification error:', err);
    res.status(500).json({ error: 'Failed to verify checkout session.' });
  }
});

// ── Admin: Create user ────────────────────────────────────────────────────────
// Creates a new Firebase Auth user on behalf of an authenticated admin.
// The caller must supply a valid Firebase ID token in the Authorization header.
// The token is verified via the Firebase Auth REST API; only emails listed in
// VITE_ADMIN_EMAILS may use this endpoint.
app.post('/api/admin/create-user', adminUserRateLimit, async (req, res) => {
  if (!FIREBASE_API_KEY) {
    res.status(503).json({ error: 'Firebase is not configured on this server.' });
    return;
  }

  // ── 1. Verify caller's ID token ──────────────────────────────────────────
  const authHeader = req.headers.authorization ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    res.status(401).json({ error: 'Missing Authorization header.' });
    return;
  }

  let callerEmail;
  try {
    const lookupRes = await fetch(
      `${FIREBASE_AUTH_URL}:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    const lookupData = await lookupRes.json();
    if (!lookupRes.ok || !Array.isArray(lookupData.users) || lookupData.users.length === 0) {
      res.status(401).json({ error: 'Invalid or expired ID token.' });
      return;
    }
    callerEmail = (lookupData.users[0].email ?? '').toLowerCase();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(500).json({ error: 'Could not verify identity.' });
    return;
  }

  // ── 2. Check admin privileges ────────────────────────────────────────────
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    res.status(503).json({ error: 'Admin email list is not configured on this server.' });
    return;
  }

  if (!adminEmails.includes(callerEmail)) {
    res.status(403).json({ error: 'Forbidden: admin access required.' });
    return;
  }

  // ── 3. Validate payload ──────────────────────────────────────────────────
  const { email, password } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email is required.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 10) {
    res.status(400).json({ error: 'password must be at least 10 characters.' });
    return;
  }

  // ── 4. Create the new user via Firebase Auth REST API ────────────────────
  try {
    const signUpRes = await fetch(
      `${FIREBASE_AUTH_URL}:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, returnSecureToken: false }),
      }
    );
    const signUpData = await signUpRes.json();
    if (!signUpRes.ok) {
      const msg = signUpData?.error?.message ?? 'Failed to create user.';
      res.status(400).json({ error: msg });
      return;
    }
    res.status(201).json({ uid: signUpData.localId, email: signUpData.email });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Health-check route — required so Render's uptime ping returns 200 instead of
// Express's default "Cannot GET /" 404.
app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Card Forge Proxy running on port ${PORT}`);
});
