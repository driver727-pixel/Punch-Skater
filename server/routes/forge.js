import { claimFreeForge, getFreeForgeState } from '../lib/freeForge.js';
import { loadAdminLoanerCards } from '../lib/adminLoaners.js';

const DEFAULT_COMPUTER_RIVALS_COUNT = 6;
const MAX_COMPUTER_RIVALS_COUNT = 12;

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function parseComputerRivalsCount(rawCount) {
  if (rawCount == null || rawCount === '') return DEFAULT_COMPUTER_RIVALS_COUNT;
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COMPUTER_RIVALS_COUNT) {
    throw badRequest(`count must be an integer from 1 to ${MAX_COMPUTER_RIVALS_COUNT}.`);
  }
  return count;
}

export function registerForgeRoutes(app, {
  adminDb,
  forgeRateLimit,
  authenticateFirebaseUser,
  FieldValue,
}) {
  async function authenticateComputerRivalsRequest(req, res, next) {
    try {
      await authenticateFirebaseUser(req);
      next();
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
    }
  }

  app.get('/api/forge/computer-rivals', forgeRateLimit, authenticateComputerRivalsRequest, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Computer rivals are not configured on this server.' });
      return;
    }

    try {
      const requestedCount = parseComputerRivalsCount(req.query?.count);
      const cards = await loadAdminLoanerCards(adminDb, {
        count: requestedCount,
        allowPartial: true,
      });
      res.json({ cards });
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load computer rivals.' });
    }
  });

  app.get('/api/forge/free-status', forgeRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const state = await getFreeForgeState(adminDb, caller.uid);
      res.json(state);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to load free forge status.' });
    }
  });

  app.post('/api/forge/free-claim', forgeRateLimit, async (req, res) => {
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const state = await claimFreeForge(adminDb, { uid: caller.uid, FieldValue });
      res.status(201).json(state);
    } catch (error) {
      const status = error.statusCode ?? 500;
      const payload = { error: error.message ?? 'Failed to claim free forge.' };
      if (status === 429 && typeof error.nextReadyAt === 'number') {
        payload.nextReadyAt = error.nextReadyAt;
      }
      res.status(status).json(payload);
    }
  });
}
