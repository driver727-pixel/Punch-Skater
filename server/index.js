import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();

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

app.use(express.json());

const FAL_KEY = process.env.FAL_KEY || '';
const FAL_URL = 'https://fal.run/fal-ai/flux/dev';
const BIREFNET_URL = 'https://fal.run/fal-ai/birefnet';

if (!FAL_KEY) {
  console.warn('⚠️  FAL_KEY environment variable is not set — requests will be rejected by Fal.ai.');
}

// Transparent proxy: the React front-end POSTs to /api/generate-image and
// this server forwards the request to Fal.ai, attaching the secret key.
app.post('/api/generate-image', async (req, res) => {
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
app.post('/api/remove-background', async (req, res) => {
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
app.post('/api/import', (req, res) => {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Card Forge Proxy running on port ${PORT}`);
});
