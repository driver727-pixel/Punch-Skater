import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import Stripe from 'stripe';
import { fal } from '@fal-ai/client';
import 'dotenv/config';
import { createRequire } from 'module';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { createBattleCardSnapshot, resolveBattleWithEffects } from './battle.js';
import {
  buildUserDisplayName,
  getConfiguredAdminEmails,
  isStrongPassword,
  normalizeEmail,
  shouldGrantAdminAccess,
} from './lib/auth.js';
import {
  isPlainObject,
  normalizeBoardReferenceUrls,
  normalizeFalLoras,
  parseFalScale,
} from './lib/fal.js';
import { createFirebaseAdminServices } from './lib/firebaseAdmin.js';
import {
  createFalImageRequestBuilder,
  createFalRequestConfigLoader,
  normalizeFalProfile,
  readFalRequestConfig,
  resolveFalProfile as resolveConfiguredFalProfile,
} from './lib/falRequest.js';
import { buildRateLimiter, createRateLimitStore } from './lib/rateLimit.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerBattleRoutes } from './routes/battle.js';
import { registerImageRoutes } from './routes/images.js';
import { registerImportRoutes } from './routes/import.js';
import { registerPaymentRoutes } from './routes/payments.js';
import { registerWeatherRoutes } from './routes/weather.js';

// Load the shared pricing config — the single source of truth for Stripe
// price IDs, buy URLs, and display prices.  Update src/lib/tierPricing.json
// to change prices; this file derives ALLOWED_PRICE_IDS from it automatically.
const nodeRequire = createRequire(import.meta.url);
const tierPricing = nodeRequire('../src/lib/tierPricing.json');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_ALLOWED_APP_ORIGINS = [
  'https://punchskater.com',
  'https://driver727-pixel.github.io',
  'http://localhost:5173',
];
const APP_ORIGINS = (process.env.APP_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_APP_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_APP_ORIGINS,
  ...APP_ORIGINS,
]);
const MAX_TEXT_FIELD_LENGTH = 4_000;
const MAX_BOARD_PROMPT_LENGTH = 1_500;
const MAX_IMAGE_DIMENSION = 1_536;
const MIN_IMAGE_DIMENSION = 64;
const MIN_INFERENCE_STEPS = 1;
const MAX_INFERENCE_STEPS = 50;
const MIN_GUIDANCE_SCALE = 1;
const MAX_GUIDANCE_SCALE = 20;
const ALLOWED_OUTPUT_FORMAT = 'png';
const BOARD_IMAGE_JOB_TTL_MS = 20 * 60 * 1000;
const ALLOWED_REMOTE_IMAGE_HOST_PATTERNS = [
  /(^|\.)fal\.media$/i,
  /^firebasestorage\.googleapis\.com$/i,
  /^storage\.googleapis\.com$/i,
];
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const boardImageJobs = new Map();
const REDIS_URL = process.env.REDIS_URL || '';

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
      imgSrc: ["'self'", 'data:', 'https://*.fal.media', 'https://*.firebaseapp.com', 'https://firebasestorage.googleapis.com'],
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
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()');
  // HSTS only when the connection is already secure (behind TLS proxy like Render)
  if (req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_APP_ORIGINS.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin is not allowed.'));
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const { store: sharedRateLimitStore } = createRateLimitStore(REDIS_URL);

// Each IP may call the image-generation / background-removal endpoints at most
// 20 times per minute. This prevents abuse that would run up the Fal.ai bill.
const imageRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many image requests — please wait a moment and try again.' },
  store: sharedRateLimitStore,
});

// Status-check polling is cheap (no AI inference), so allow a higher burst.
const boardImageStatusRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many status requests — please slow down.' },
  store: sharedRateLimitStore,
});

// The import endpoint is cheaper to call, so allow a somewhat higher burst.
const importRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests — please slow down.' },
  store: sharedRateLimitStore,
});

// Stripe checkout sessions — tightly rate-limited to prevent abuse.
const checkoutRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many checkout requests — please wait a moment and try again.' },
  store: sharedRateLimitStore,
});

const authSyncRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many auth sync requests — please wait a moment and try again.' },
  store: sharedRateLimitStore,
});

// Admin user-creation — very tightly rate-limited.
const adminUserRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many admin requests — please wait a moment and try again.' },
  store: sharedRateLimitStore,
});

const weatherRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many weather requests — please wait a moment and try again.' },
  store: sharedRateLimitStore,
});

const battleRateLimit = buildRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many battle requests — please wait a moment and try again.' },
  store: sharedRateLimitStore,
});

const FAL_KEY = process.env.FAL_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const BIREFNET_URL = 'https://fal.run/fal-ai/birefnet';
const falRequestConfig = readFalRequestConfig(process.env, console);
const getRemoteFalRequestConfig = createFalRequestConfigLoader({
  cacheTtlMs: falRequestConfig.cacheTtlMs,
  logger: console,
  maxCacheEntries: falRequestConfig.maxCacheEntries,
});
const resolveFalProfile = (profile) => resolveConfiguredFalProfile(profile, falRequestConfig.profiles);
const buildFalImageRequest = createFalImageRequestBuilder({
  getRemoteFalRequestConfig,
  requestDefaults: falRequestConfig.requestDefaults,
  resolveFalProfile,
});

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

function isAllowedAppOrigin(origin) {
  return ALLOWED_APP_ORIGINS.has(origin);
}

function isAllowedRedirectUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') {
      return isAllowedAppOrigin(parsed.origin);
    }
    return parsed.protocol === 'http:' && (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function isAllowedRemoteImageUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' &&
      ALLOWED_REMOTE_IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

function getTrimmedString(value, maxLength = MAX_TEXT_FIELD_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeTextField(value, { fieldName, maxLength = MAX_TEXT_FIELD_LENGTH, required = false } = {}) {
  const trimmed = getTrimmedString(value, maxLength);
  if (!trimmed) {
    if (required) {
      throw Object.assign(new Error(`${fieldName} is required.`), { statusCode: 400 });
    }
    return undefined;
  }
  return trimmed;
}

function sanitizeInteger(value, {
  fieldName,
  minimum,
  maximum,
  required = false,
} = {}) {
  if (value == null || value === '') {
    if (required) {
      throw Object.assign(new Error(`${fieldName} is required.`), { statusCode: 400 });
    }
    return undefined;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(
      new Error(`${fieldName} must be an integer between ${minimum} and ${maximum}.`),
      { statusCode: 400 },
    );
  }
  return parsed;
}

function sanitizeNumber(value, {
  fieldName,
  minimum,
  maximum,
} = {}) {
  if (value == null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw Object.assign(
      new Error(`${fieldName} must be a number between ${minimum} and ${maximum}.`),
      { statusCode: 400 },
    );
  }
  return parsed;
}

function sanitizeFalImageSize(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed;
  }
  if (!isPlainObject(value)) {
    throw Object.assign(new Error('image_size must be a string or { width, height } object.'), { statusCode: 400 });
  }
  const width = sanitizeInteger(value.width, {
    fieldName: 'image_size.width',
    minimum: MIN_IMAGE_DIMENSION,
    maximum: MAX_IMAGE_DIMENSION,
    required: true,
  });
  const height = sanitizeInteger(value.height, {
    fieldName: 'image_size.height',
    minimum: MIN_IMAGE_DIMENSION,
    maximum: MAX_IMAGE_DIMENSION,
    required: true,
  });
  return { width, height };
}

function sanitizeFalProfileInput(value) {
  if (value == null || value === '') return undefined;
  const profile = normalizeFalProfile(getTrimmedString(value, 32));
  return profile;
}

function sanitizeGenerateImageBody(body = {}) {
  if (!isPlainObject(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { statusCode: 400 });
  }

  return {
    prompt: sanitizeTextField(body.prompt, { fieldName: 'prompt', required: true }),
    negative_prompt: sanitizeTextField(body.negative_prompt, { fieldName: 'negative_prompt' }),
    seed: sanitizeInteger(body.seed, {
      fieldName: 'seed',
      minimum: 0,
      maximum: 4_294_967_295,
    }),
    image_size: sanitizeFalImageSize(body.image_size),
    num_inference_steps: sanitizeInteger(body.num_inference_steps, {
      fieldName: 'num_inference_steps',
      minimum: MIN_INFERENCE_STEPS,
      maximum: MAX_INFERENCE_STEPS,
    }),
    guidance_scale: sanitizeNumber(body.guidance_scale, {
      fieldName: 'guidance_scale',
      minimum: MIN_GUIDANCE_SCALE,
      maximum: MAX_GUIDANCE_SCALE,
    }),
    fal_profile: sanitizeFalProfileInput(body.fal_profile),
    output_format: ALLOWED_OUTPUT_FORMAT,
    enable_safety_checker: true,
    num_images: 1,
  };
}

function sanitizeBoardImageBody(body = {}) {
  if (!isPlainObject(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { statusCode: 400 });
  }
  return {
    prompt: sanitizeTextField(body.prompt, {
      fieldName: 'prompt',
      required: true,
      maxLength: MAX_BOARD_PROMPT_LENGTH,
    }),
    imageUrls: normalizeBoardReferenceUrls(body.imageUrls),
  };
}

function sanitizeBackgroundRemovalBody(body = {}) {
  if (!isPlainObject(body)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { statusCode: 400 });
  }
  const imageUrl = sanitizeTextField(body.image_url, { fieldName: 'image_url', required: true });
  if (!isAllowedRemoteImageUrl(imageUrl)) {
    throw Object.assign(new Error('image_url must point to an approved remote image host.'), { statusCode: 400 });
  }
  return { image_url: imageUrl };
}

function pruneBoardImageJobs(now = Date.now()) {
  for (const [jobId, entry] of boardImageJobs.entries()) {
    if (!entry || now - entry.createdAt > BOARD_IMAGE_JOB_TTL_MS) {
      boardImageJobs.delete(jobId);
    }
  }
}

async function syncPurchasedTier({ tier, email, sessionId }) {
  if (!adminDb || !tier) return;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  const exactEmail = getTrimmedString(email, 320);
  // Prefer the normalized field, but fall back to legacy exact-email queries so
  // purchases still sync for older profiles that predate emailLower.
  const snapshots = await Promise.all([
    adminDb.collection('userProfiles').where('emailLower', '==', normalizedEmail).limit(25).get(),
    exactEmail ? adminDb.collection('userProfiles').where('email', '==', exactEmail).limit(25).get() : null,
    exactEmail && exactEmail !== normalizedEmail
      ? adminDb.collection('userProfiles').where('email', '==', normalizedEmail).limit(25).get()
      : null,
  ]);
  const matchingDocs = new Map();
  snapshots.filter(Boolean).forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      matchingDocs.set(docSnap.ref.path, docSnap);
    });
  });
  if (matchingDocs.size === 0) return;

  const batch = adminDb.batch();
  matchingDocs.forEach((docSnap) => {
    batch.set(docSnap.ref, {
      tier,
      purchaseEmail: normalizedEmail,
      lastCheckoutSessionId: sessionId,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
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

registerPaymentRoutes(app, {
  stripe,
  stripeWebhookSecret,
  checkoutRateLimit,
  resolveTierFromPriceId,
  syncPurchasedTier,
  isAllowedRedirectUrl,
  normalizeEmail,
  timingSafeEmailMatches,
  sendCheckoutVerificationFailure,
});

app.use(compression());
app.use(express.json({ limit: '256kb' }));

if (!FAL_KEY) {
  console.warn('⚠️  FAL_KEY environment variable is not set — requests will be rejected by Fal.ai.');
} else {
  fal.config({ credentials: FAL_KEY });
}
if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY environment variable is not set — checkout sessions will be unavailable.');
}
if (!stripeWebhookSecret) {
  console.warn('⚠️  STRIPE_WEBHOOK_SECRET environment variable is not set — Stripe webhooks will be unavailable.');
}

const { adminAuth, adminDb } = createFirebaseAdminServices({
  env: process.env,
  logger: console,
});

if (!adminAuth || !adminDb) {
  console.warn(
    '⚠️  Firebase Admin credentials are not set — configure FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY, or application default credentials to enable secure battle resolution, authenticated image proxies, and admin account management.',
  );
}
if (REDIS_URL) {
  console.info('Redis-backed rate limiting enabled.');
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

async function syncAdminClaim(uid, email) {
  if (!adminAuth) return { admin: false, claimsUpdated: false };
  const adminEmails = getConfiguredAdminEmails(process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '');
  const shouldBeAdmin = shouldGrantAdminAccess(email, adminEmails);
  const userRecord = await adminAuth.getUser(uid);
  const currentClaims = userRecord.customClaims ?? {};
  const currentAdmin = currentClaims.admin === true;

  const syncAdminProfileState = async () => {
    if (!adminDb) return;
    await adminDb.collection('userProfiles').doc(uid).set({
      isAdmin: shouldBeAdmin,
      ...(shouldBeAdmin ? { tier: 'tier3' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  };

  if (currentAdmin !== shouldBeAdmin) {
    const nextClaims = { ...currentClaims };
    if (shouldBeAdmin) nextClaims.admin = true;
    else delete nextClaims.admin;
    await adminAuth.setCustomUserClaims(uid, nextClaims);
    await syncAdminProfileState();
    return { admin: shouldBeAdmin, claimsUpdated: true };
  }

  await syncAdminProfileState();

  return { admin: currentAdmin, claimsUpdated: false };
}

async function upsertUserLookupRecord({ uid, email, displayName }) {
  if (!adminDb) return;
  const normalizedEmail = normalizeEmail(email);
  const resolvedDisplayName = buildUserDisplayName({ email, displayName });
  const profilePayload = {
    uid,
    email: typeof email === 'string' ? email.trim() : '',
    emailLower: normalizedEmail,
    displayName: resolvedDisplayName,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const lookupPayload = {
    uid,
    emailLower: normalizedEmail,
    displayName: resolvedDisplayName,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await Promise.all([
    adminDb.collection('userProfiles').doc(uid).set(profilePayload, { merge: true }),
    adminDb.collection('userLookup').doc(uid).set(lookupPayload, { merge: true }),
  ]);
}

async function authenticateAdminRequest(req) {
  const decodedToken = await authenticateFirebaseUser(req);
  const adminEmails = getConfiguredAdminEmails(process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || '');
  if (decodedToken.admin === true) {
    return decodedToken;
  }
  if (adminEmails.length === 0) {
    throw Object.assign(new Error('Admin email list is not configured on this server.'), { statusCode: 503 });
  }
  if (!shouldGrantAdminAccess(decodedToken.email ?? '', adminEmails)) {
    throw Object.assign(new Error('Forbidden: admin access required.'), { statusCode: 403 });
  }
  return decodedToken;
}

async function deleteCollectionDocs(collectionRef, pageSize = 200) {
  while (true) {
    const snap = await collectionRef.limit(pageSize).get();
    if (snap.empty) return;
    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    if (snap.size < pageSize) return;
  }
}

async function deleteQueryDocs(queryRef, pageSize = 200) {
  while (true) {
    const snap = await queryRef.limit(pageSize).get();
    if (snap.empty) return;
    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    if (snap.size < pageSize) return;
  }
}

registerAdminRoutes(app, {
  adminAuth,
  adminDb,
  authSyncRateLimit,
  adminUserRateLimit,
  authenticateFirebaseUser,
  authenticateAdminRequest,
  syncAdminClaim,
  isStrongPassword,
  buildUserDisplayName,
  upsertUserLookupRecord,
  deleteCollectionDocs,
  deleteQueryDocs,
});

registerWeatherRoutes(app, {
  weatherRateLimit,
});

registerBattleRoutes(app, {
  adminDb,
  battleRateLimit,
  authenticateFirebaseUser,
  createBattleCardSnapshot,
  resolveBattleWithEffects,
  randomUUID,
  FieldValue,
});

registerImageRoutes(app, {
  fal,
  FAL_KEY,
  BIREFNET_URL,
  imageRateLimit,
  boardImageStatusRateLimit,
  authenticateFirebaseUser,
  sanitizeGenerateImageBody,
  sanitizeBoardImageBody,
  sanitizeBackgroundRemovalBody,
  buildFalImageRequest,
  normalizeFalProfile,
  resolveFalProfile,
  boardImageJobs,
  pruneBoardImageJobs,
});

registerImportRoutes(app, {
  importRateLimit,
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
