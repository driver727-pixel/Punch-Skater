import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import 'dotenv/config';
import { createRequire } from 'module';

// Load the shared pricing config — the single source of truth for Stripe
// price IDs, buy URLs, and display prices.  Update src/lib/tierPricing.json
// to change prices; this file derives ALLOWED_PRICE_IDS from it automatically.
const nodeRequire = createRequire(import.meta.url);
const tierPricing = nodeRequire('../src/lib/tierPricing.json');

const app = express();

// Render (and most PaaS reverse-proxies) add X-Forwarded-For so Express can
// determine the real client IP.  Without trust proxy = 1, express-rate-limit
// throws a ValidationError and rate-limiting cannot identify callers correctly.
app.set('trust proxy', 1);

// ── Security headers ─────────────────────────────────────────────────────────
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

const FAL_KEY = process.env.FAL_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || '';
const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const FAL_URL = 'https://fal.run/fal-ai/flux/dev';
const BIREFNET_URL = 'https://fal.run/fal-ai/birefnet';

// Allowed Stripe price IDs — derived from src/lib/tierPricing.json so that
// updating prices only requires editing that one file.
const ALLOWED_PRICE_IDS = new Set(
  Object.values(tierPricing)
    .map((t) => t.stripePriceId)
    .filter(Boolean),
);

// Stripe client — instantiated once at startup so it is reused across requests.
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

if (!FAL_KEY) {
  console.warn('⚠️  FAL_KEY environment variable is not set — requests will be rejected by Fal.ai.');
}
if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY environment variable is not set — checkout sessions will be unavailable.');
}

// Transparent proxy: the React front-end POSTs to /api/generate-image and
// this server forwards the request to Fal.ai, attaching the secret key.
app.post('/api/generate-image', imageRateLimit, async (req, res) => {
  try {
    const upstream = await fetch(FAL_URL, {
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

// ── Stripe Checkout Sessions ──────────────────────────────────────────────────
// Creates a Stripe Checkout Session for one of the two allowed price IDs and
// returns the hosted payment page URL.  The caller supplies success_url and
// cancel_url so the user is returned to the correct page after payment.
app.post('/api/create-checkout-session', checkoutRateLimit, async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: 'Payment processing is not configured.' });
    return;
  }

  const { priceId, successUrl, cancelUrl } = req.body ?? {};

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
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
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
  const adminEmails = (process.env.VITE_ADMIN_EMAILS ?? '')
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
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'password must be at least 6 characters.' });
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
