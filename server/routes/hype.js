const CREW_FACE_OFF_CACHE_TTL_MS = 5 * 60 * 1000;
const CREW_FACE_OFF_DECK_NAMES = {
  cassidy: "Cassidy's Crew",
  garibaldi: "Garibaldi's Crew",
};
const CREW_FACE_OFF_CARD_LIMIT = 6;

function normalizeDeckName(name) {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isTargetDeck(deckName, targetName) {
  return normalizeDeckName(deckName) === normalizeDeckName(targetName);
}

function sanitizeCrewCard(card) {
  if (!card || typeof card !== 'object') return null;
  return {
    ...card,
    unlockedFrameIds: undefined,
  };
}

export function createCrewFaceOffService({ adminDb }) {
  let cache = {
    payload: null,
    fetchedAt: 0,
  };
  let inFlightFetch = null;

  async function fetchCrewDecks() {
    if (!adminDb) {
      throw Object.assign(new Error('Firebase Admin is not configured on this server.'), { statusCode: 503 });
    }

    const adminProfilesSnap = await adminDb.collection('userProfiles').where('isAdmin', '==', true).get();
    const adminUids = adminProfilesSnap.docs.map((d) => d.id).filter(Boolean);
    const foundDecks = {
      cassidy: null,
      garibaldi: null,
    };

    const deckResults = await Promise.allSettled(
      adminUids.map(async (uid) => {
        const decksSnap = await adminDb.collection('users').doc(uid).collection('decks').get();
        for (const deckDoc of decksSnap.docs) {
          const deckData = deckDoc.data() ?? {};
          if (!foundDecks.cassidy && isTargetDeck(deckData.name, CREW_FACE_OFF_DECK_NAMES.cassidy)) {
            foundDecks.cassidy = deckData;
          }
          if (!foundDecks.garibaldi && isTargetDeck(deckData.name, CREW_FACE_OFF_DECK_NAMES.garibaldi)) {
            foundDecks.garibaldi = deckData;
          }
        }
      }),
    );
    const deckFetchErrors = deckResults.filter((r) => r.status === 'rejected');
    if (deckFetchErrors.length > 0) {
      console.warn(`Crew face-off: ${deckFetchErrors.length} uid(s) failed to fetch decks.`, deckFetchErrors.map((r) => r.reason?.message));
    }

    const cassidyCards = (Array.isArray(foundDecks.cassidy?.cards) ? foundDecks.cassidy.cards : [])
      .map(sanitizeCrewCard)
      .filter(Boolean)
      .slice(0, CREW_FACE_OFF_CARD_LIMIT);
    const garibaldiCards = (Array.isArray(foundDecks.garibaldi?.cards) ? foundDecks.garibaldi.cards : [])
      .map(sanitizeCrewCard)
      .filter(Boolean)
      .slice(0, CREW_FACE_OFF_CARD_LIMIT);

    return {
      generatedAt: new Date().toISOString(),
      cacheTtlMs: CREW_FACE_OFF_CACHE_TTL_MS,
      crews: {
        cassidy: {
          deckName: foundDecks.cassidy?.name ?? CREW_FACE_OFF_DECK_NAMES.cassidy,
          cards: cassidyCards,
        },
        garibaldi: {
          deckName: foundDecks.garibaldi?.name ?? CREW_FACE_OFF_DECK_NAMES.garibaldi,
          cards: garibaldiCards,
        },
      },
    };
  }

  async function getCrewFaceOffPayload() {
    const now = Date.now();
    if (cache.payload && now - cache.fetchedAt < CREW_FACE_OFF_CACHE_TTL_MS) {
      return { ...cache.payload, source: 'cache' };
    }

    if (inFlightFetch) return inFlightFetch;

    inFlightFetch = fetchCrewDecks()
      .then((payload) => {
        cache = { payload, fetchedAt: Date.now() };
        return { ...payload, source: 'live' };
      })
      .finally(() => {
        inFlightFetch = null;
      });

    return inFlightFetch;
  }

  return {
    getCrewFaceOffPayload,
  };
}

export function registerHypeRoutes(app, { adminDb, hypeRateLimit, crewFaceOffService = createCrewFaceOffService({ adminDb }) }) {
  const handlers = [];
  if (hypeRateLimit) handlers.push(hypeRateLimit);

  app.get('/api/hype/crew-faceoff', ...handlers, async (_req, res) => {
    try {
      const payload = await crewFaceOffService.getCrewFaceOffPayload();
      res.setHeader?.('Cache-Control', 'public, max-age=300, stale-while-revalidate=300');
      res.json(payload);
    } catch (error) {
      const statusCode = error?.statusCode ?? 500;
      res.status(statusCode).json({ error: error?.message ?? 'Failed to load crew face-off.' });
    }
  });
}
