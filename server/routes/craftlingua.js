import { createCraftlinguaService } from '../lib/craftlingua.js';

const MAX_TEXT_LENGTH = 300;
const SHARE_CODE_PATTERN = /^[A-Z0-9-]{6,64}$/i;

function sanitizeShareCode(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw Object.assign(new Error('shareCode is required.'), { statusCode: 400 });
  }
  if (!SHARE_CODE_PATTERN.test(trimmed)) {
    throw Object.assign(new Error('shareCode must be 6-64 letters, numbers, or hyphens.'), { statusCode: 400 });
  }
  return trimmed;
}

function sanitizeText(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw Object.assign(new Error('text is required.'), { statusCode: 400 });
  }
  return trimmed.slice(0, MAX_TEXT_LENGTH);
}

function sanitizeDistrict(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
}

function normalizeCraftlinguaError(error) {
  if (error?.statusCode) {
    return { statusCode: error.statusCode, error: error.message };
  }
  return { statusCode: 500, error: 'CraftLingua request failed.' };
}

export function registerCraftlinguaRoutes(app, {
  craftlinguaRateLimit,
  craftlinguaService = createCraftlinguaService(),
} = {}) {
  app.get('/api/craftlingua/districts', craftlinguaRateLimit, async (_req, res) => {
    try {
      res.json({ districts: craftlinguaService.getDistricts() });
    } catch (error) {
      const normalized = normalizeCraftlinguaError(error);
      res.status(normalized.statusCode).json({ error: normalized.error });
    }
  });

  app.get('/api/craftlingua/districts/:districtKey', craftlinguaRateLimit, async (req, res) => {
    try {
      const entry = craftlinguaService.getDistrict(req.params?.districtKey);
      if (!entry) {
        res.status(404).json({ error: 'CraftLingua district not found.' });
        return;
      }
      res.json({ district: entry });
    } catch (error) {
      const normalized = normalizeCraftlinguaError(error);
      res.status(normalized.statusCode).json({ error: normalized.error });
    }
  });

  app.post('/api/craftlingua/resolve-share-code', craftlinguaRateLimit, async (req, res) => {
    try {
      const shareCode = sanitizeShareCode(req.body?.shareCode);
      const entry = craftlinguaService.resolveShareCode(shareCode);
      if (!entry) {
        res.status(404).json({ error: 'CraftLingua share code not found.' });
        return;
      }
      res.json({ district: entry });
    } catch (error) {
      const normalized = normalizeCraftlinguaError(error);
      res.status(normalized.statusCode).json({ error: normalized.error });
    }
  });

  app.post('/api/craftlingua/translate', craftlinguaRateLimit, async (req, res) => {
    try {
      const shareCode = req.body?.shareCode ? sanitizeShareCode(req.body.shareCode) : undefined;
      const district = sanitizeDistrict(req.body?.district);
      const text = sanitizeText(req.body?.text);
      if (!shareCode && !district) {
        throw Object.assign(new Error('shareCode or district is required.'), { statusCode: 400 });
      }
      const translation = craftlinguaService.translate({ district, shareCode, text });
      if (!translation) {
        res.status(404).json({ error: 'CraftLingua language not found.' });
        return;
      }
      res.json(translation);
    } catch (error) {
      const normalized = normalizeCraftlinguaError(error);
      res.status(normalized.statusCode).json({ error: normalized.error });
    }
  });
}
