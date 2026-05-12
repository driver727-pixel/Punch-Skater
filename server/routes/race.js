/**
 * Courier Race Arena — server routes.
 *
 * Endpoints:
 *   POST   /api/race/solo        — start a solo race against a seeded bot opponent.
 *   POST   /api/race/challenge   — issue a new challenge (escrows challenger's wager).
 *   POST   /api/race/:id/respond — defender accepts or declines a pending challenge.
 *   POST   /api/race/:id/cancel  — challenger withdraws a pending challenge (refunds wager).
 *   GET    /api/race/:id         — fetch a resolved race (timeline + result) for replay.
 *
 * Concepts:
 *   - challenges/{id} — RaceChallenge doc (status pending|accepted|declined|cancelled|resolved).
 *   - races/{id}      — Race doc with the precomputed timeline + RaceResult.
 *   - notifications/{uid}/items/{id} — per-user inbox.
 *
 * Wagers are escrowed at challenge time by atomically decrementing the
 * challenger's `userProfiles/{uid}.ozzies` field (Firestore FieldValue.increment).
 * On accept the defender's Ozzies are decremented by the same amount and the
 * full pot is credited to the winning card's owner. On decline/cancel the
 * challenger is refunded.
 */
import {
  createRaceCardSnapshot,
  createRaceRng,
  resolveRace,
  RACE_TICK_MS,
  STANDARD_RACE_WINNER_OZZIES,
} from '../lib/race.js';
import { promoteCardClass } from '../lib/cardClassProgression.js';
import rateLimit from 'express-rate-limit';

// CodeQL-visible fallback rate limiter. The injected `raceRateLimit` is the
// production limiter (shared Redis store across the cluster); this fallback
// guarantees that every race route is wrapped with a real rate limiter even
// if the caller forgets to pass one in (e.g. unit-test harnesses) and gives
// CodeQL a definite middleware reference to recognise.
const fallbackRaceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many race requests — please wait a moment and try again.' },
});

const CHALLENGES_COLLECTION = 'challenges';
const RACES_COLLECTION = 'races';
const NOTIFICATIONS_COLLECTION = 'notifications';
const PROFILE_COLLECTION = 'userProfiles';

// ── Solo race bot config ─────────────────────────────────────────────────────

const BOT_NAMES = [
  'Ghost Runner', 'Circuit Breaker', 'Neon Shade', 'Iron Wheel', 'Static Charge',
  'Grid Phantom', 'Voltage Dash', 'Asphalt Prophet', 'Null Rider', 'Frequency Six',
];
const BOT_ARCHETYPES = ['The Team', 'Qu111s', 'The Asclepians', 'Iron Curtains', 'Ne0n Legion'];

/**
 * Generate a competitive bot snapshot seeded by the player card's stats and the
 * race seed. Bot total stat points are within ±10% of the player card's total so
 * the race stays challenging without being unfair.
 *
 * The distribution is proportional-with-noise and then clamped to [1, 10] per
 * stat; rounding means the sum of bot stats is only approximately equal to
 * `botTotal`, which is intentional — integer stats cannot always sum to an
 * exact target when each is bounded.
 */
function generateBotSnapshot(playerStats, seed) {
  // Use a distinct sub-seed so bot stat generation is independent of the race
  // simulation RNG (which uses the bare `raceSeed`).
  const rng = createRaceRng(`${seed}:bot-gen`);

  const playerTotal = (
    Number(playerStats.speed ?? 5) +
    Number(playerStats.range ?? 5) +
    Number(playerStats.stealth ?? 5) +
    Number(playerStats.grit ?? 5)
  );

  // Bot total within ±10% of player total.
  const botTotal = Math.round(playerTotal * (0.9 + rng() * 0.2));

  // Distribute botTotal across the four stats with seeded random weights.
  const weights = [0.5 + rng(), 0.5 + rng(), 0.5 + rng(), 0.5 + rng()];
  const sumW = weights.reduce((a, b) => a + b, 0);
  const rawStats = weights.map((w) => Math.max(1, Math.min(10, Math.round((w / sumW) * botTotal))));

  return {
    id: `bot-${seed}`,
    name: BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)],
    archetype: BOT_ARCHETYPES[Math.floor(rng() * BOT_ARCHETYPES.length)],
    rarity: 'Apprentice',
    stats: {
      speed: rawStats[0],
      range: rawStats[1],
      // rangeNm mirrors range — "Nm" = nautical miles, a presentational alias
      // for range used in card stat displays throughout the app.
      rangeNm: rawStats[1],
      stealth: rawStats[2],
      grit: rawStats[3],
    },
  };
}

const MAX_OPEN_CHALLENGES_PER_USER = 20;
const MAX_WAGER = 10_000;
const MIN_WAGER = 0;

function nowIso() {
  return new Date().toISOString();
}

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { statusCode: status });
}

function clampWager(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_WAGER) return 0;
  return Math.min(MAX_WAGER, Math.max(MIN_WAGER, n));
}

function readOzzies(profile) {
  const v = Number(profile?.ozzies);
  return Number.isFinite(v) ? v : 0;
}

function getCardFromDeck(deck, cardId) {
  if (!deck || !Array.isArray(deck.cards)) return null;
  return deck.cards.find((c) => c?.id === cardId) ?? null;
}

function findPrimaryDeck(decksSnap) {
  const docs = decksSnap.docs;
  // Prefer explicit isPrimary flag, then sortOrder=0, then first by createdAt.
  const primary = docs.find((d) => d.data()?.isPrimary === true);
  if (primary) return primary;
  const byOrder = docs.find((d) => d.data()?.sortOrder === 0);
  if (byOrder) return byOrder;
  return docs[0] ?? null;
}

function notificationDocRef(adminDb, uid, id) {
  return adminDb.collection(NOTIFICATIONS_COLLECTION).doc(uid).collection('items').doc(id);
}

function buildNotification({ uid, type, title, body, link, data, randomUUID }) {
  const id = `notif-${randomUUID()}`;
  return {
    ref: { uid, id },
    payload: {
      id,
      uid,
      type,
      title,
      body: body ?? '',
      link: link ?? '',
      data: data ?? {},
      read: false,
      createdAt: nowIso(),
    },
  };
}

function getWinnerProfilePrize(wager) {
  return (wager * 2) + STANDARD_RACE_WINNER_OZZIES;
}

/**
 * Apply the per-card delta (XP + Ozzies) inside a transaction using a
 * pre-fetched snapshot.  The caller must have already called tx.get() for
 * `cardRef` before issuing any writes in the same transaction — Firestore
 * requires all reads to precede all writes.
 */
function applyCardDelta(tx, cardRef, cardSnap, delta, statBoost) {
  if (!cardSnap.exists) return;
  const card = cardSnap.data();
  const nextCard = { ...card };
  nextCard.xp = Math.max(0, Math.min(100_000_000, Number(card.xp ?? 0) + Number(delta.xp ?? 0)));
  nextCard.ozzies = Math.max(0, Number(card.ozzies ?? 0) + Number(delta.ozzies ?? 0));
  if (statBoost && statBoost.stat && card.stats) {
    const cur = Number(card.stats[statBoost.stat] ?? 5);
    nextCard.stats = { ...card.stats, [statBoost.stat]: Math.min(10, cur + statBoost.amount) };
  }
  tx.set(cardRef, promoteCardClass(nextCard));
}

export function registerRaceRoutes(app, {
  adminDb,
  raceRateLimit,
  authenticateFirebaseUser,
  randomUUID,
  FieldValue,
}) {
  if (!app) throw new Error('registerRaceRoutes requires an Express app.');

  // Always have a real rate limiter wrapped around every route — defaults
  // to the locally-constructed fallback when no shared limiter is provided.
  const limiter = raceRateLimit ?? fallbackRaceRateLimit;

  // ── POST /api/race/challenge ─────────────────────────────────────────────
  app.post('/api/race/challenge', limiter, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Race arena is not configured on this server.' });
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
    const defenderUid = String(req.body?.defenderUid ?? '').trim();
    const defenderCardId = String(req.body?.defenderCardId ?? '').trim();
    const challengerCardId = String(req.body?.challengerCardId ?? '').trim();
    const wager = clampWager(req.body?.ozzyWager);
    const message = String(req.body?.message ?? '').slice(0, 280);

    if (!defenderUid || !defenderCardId || !challengerCardId) {
      res.status(400).json({ error: 'challengerCardId, defenderUid, and defenderCardId are required.' });
      return;
    }
    if (challengerUid === defenderUid) {
      res.status(400).json({ error: 'You cannot challenge yourself.' });
      return;
    }

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        // Look up both players' primary decks + the two cards.
        const [challengerDecksSnap, defenderDecksSnap] = await Promise.all([
          adminDb.collection('users').doc(challengerUid).collection('decks').get(),
          adminDb.collection('users').doc(defenderUid).collection('decks').get(),
        ]);
        const challengerDeckDoc = findPrimaryDeck(challengerDecksSnap);
        const defenderDeckDoc = findPrimaryDeck(defenderDecksSnap);
        if (!challengerDeckDoc || !defenderDeckDoc) {
          throw badRequest('Both players need a primary deck.', 409);
        }
        const challengerDeck = challengerDeckDoc.data();
        const defenderDeck = defenderDeckDoc.data();
        const challengerCard = getCardFromDeck(challengerDeck, challengerCardId);
        const defenderCard = getCardFromDeck(defenderDeck, defenderCardId);
        if (!challengerCard) {
          throw badRequest('Your selected Challenger card is not in your primary deck.', 409);
        }
        if (!defenderCard) {
          throw badRequest('Selected opponent card is not in their primary deck.', 409);
        }

        // Cap the number of open outgoing challenges from this player.
        const openOutgoingSnap = await adminDb
          .collection(CHALLENGES_COLLECTION)
          .where('challengerUid', '==', challengerUid)
          .where('status', '==', 'pending')
          .get();
        if (openOutgoingSnap.size >= MAX_OPEN_CHALLENGES_PER_USER) {
          throw badRequest('You have too many open challenges. Wait for some to resolve before issuing more.', 429);
        }

        // Escrow the wager from the challenger's profile.
        const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(challengerUid);
        if (wager > 0) {
          const profileSnap = await tx.get(profileRef);
          const balance = readOzzies(profileSnap.data());
          if (balance < wager) {
            throw badRequest(`You only have ${balance} Ozzies — not enough to wager ${wager}.`, 402);
          }
          tx.set(profileRef, { ozzies: FieldValue.increment(-wager), updatedAt: nowIso() }, { merge: true });
        }

        const id = `chal-${randomUUID()}`;
        const challengerSnapshot = createRaceCardSnapshot(challengerCard);
        const defenderSnapshot = createRaceCardSnapshot(defenderCard);
        const challenge = {
          id,
          status: 'pending',
          challengerUid,
          challengerDisplayName: caller.name ?? caller.email?.split('@')[0] ?? 'Skater',
          challengerCardId,
          challengerCardName: challengerSnapshot.name,
          defenderUid,
          defenderDisplayName: defenderDeck.ownerDisplayName ?? 'Skater',
          defenderCardId,
          defenderCardName: defenderSnapshot.name,
          defenderDeckId: defenderDeckDoc.id,
          ozzyWager: wager,
          message,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };

        tx.set(adminDb.collection(CHALLENGES_COLLECTION).doc(id), challenge);

        // Notify the defender.
        const notif = buildNotification({
          uid: defenderUid,
          type: 'race_challenge',
          title: `${challenge.challengerDisplayName} challenged ${defenderSnapshot.name} to a race!`,
          body: wager > 0
            ? `Wager: ${wager} Ozzies — accept or decline in the Race Arena.`
            : `Friendly race — accept or decline in the Race Arena.`,
          link: '/arena?tab=hub',
          data: { challengeId: id },
          randomUUID,
        });
        tx.set(notificationDocRef(adminDb, notif.ref.uid, notif.ref.id), notif.payload);

        return challenge;
      });
      res.status(201).json(result);
    } catch (error) {
      console.error('Race challenge error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to issue challenge.' });
    }
  });

  // ── POST /api/race/:id/cancel ────────────────────────────────────────────
  app.post('/api/race/:id/cancel', limiter, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Race arena is not configured on this server.' });
      return;
    }
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }
    const id = String(req.params?.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'Challenge id is required.' });
      return;
    }
    try {
      const updated = await adminDb.runTransaction(async (tx) => {
        const ref = adminDb.collection(CHALLENGES_COLLECTION).doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) throw badRequest('Challenge not found.', 404);
        const ch = snap.data();
        if (ch.challengerUid !== caller.uid) throw badRequest('Only the challenger can cancel this challenge.', 403);
        if (ch.status !== 'pending') throw badRequest('Only pending challenges can be cancelled.', 409);

        // Refund wager.
        if (ch.ozzyWager > 0) {
          tx.set(adminDb.collection(PROFILE_COLLECTION).doc(ch.challengerUid),
            { ozzies: FieldValue.increment(ch.ozzyWager), updatedAt: nowIso() }, { merge: true });
        }
        const next = { ...ch, status: 'cancelled', updatedAt: nowIso() };
        tx.set(ref, next);

        // Notify the defender (best-effort).
        const notif = buildNotification({
          uid: ch.defenderUid,
          type: 'race_cancelled',
          title: `${ch.challengerDisplayName} withdrew their race challenge.`,
          body: '',
          link: '/arena?tab=hub',
          data: { challengeId: id },
          randomUUID,
        });
        tx.set(notificationDocRef(adminDb, notif.ref.uid, notif.ref.id), notif.payload);
        return next;
      });
      res.status(200).json(updated);
    } catch (error) {
      console.error('Race cancel error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to cancel challenge.' });
    }
  });

  // ── POST /api/race/:id/respond ───────────────────────────────────────────
  app.post('/api/race/:id/respond', limiter, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Race arena is not configured on this server.' });
      return;
    }
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }
    const id = String(req.params?.id ?? '').trim();
    const accept = req.body?.accept === true;
    if (!id) {
      res.status(400).json({ error: 'Challenge id is required.' });
      return;
    }

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        const ref = adminDb.collection(CHALLENGES_COLLECTION).doc(id);
        const snap = await tx.get(ref);
        if (!snap.exists) throw badRequest('Challenge not found.', 404);
        const ch = snap.data();
        if (ch.defenderUid !== caller.uid) throw badRequest('Only the defender can respond to this challenge.', 403);
        if (ch.status !== 'pending') throw badRequest('Challenge has already been resolved.', 409);

        if (!accept) {
          // Refund challenger.
          if (ch.ozzyWager > 0) {
            tx.set(adminDb.collection(PROFILE_COLLECTION).doc(ch.challengerUid),
              { ozzies: FieldValue.increment(ch.ozzyWager), updatedAt: nowIso() }, { merge: true });
          }
          const next = { ...ch, status: 'declined', updatedAt: nowIso() };
          tx.set(ref, next);
          const notif = buildNotification({
            uid: ch.challengerUid,
            type: 'race_declined',
            title: `${ch.defenderDisplayName} declined your race challenge.`,
            body: ch.ozzyWager > 0 ? `Your ${ch.ozzyWager} Ozzy wager has been refunded.` : '',
            link: '/arena?tab=hub',
            data: { challengeId: id },
            randomUUID,
          });
          tx.set(notificationDocRef(adminDb, notif.ref.uid, notif.ref.id), notif.payload);
          return { challenge: next };
        }

        // Accept path: confirm both cards still exist, escrow defender wager,
        // simulate the race, persist race + result, transfer winnings.
        const [challengerDecksSnap, defenderDecksSnap] = await Promise.all([
          adminDb.collection('users').doc(ch.challengerUid).collection('decks').get(),
          adminDb.collection('users').doc(ch.defenderUid).collection('decks').get(),
        ]);
        const challengerDeckDoc = findPrimaryDeck(challengerDecksSnap);
        const defenderDeckDoc = findPrimaryDeck(defenderDecksSnap);
        const challengerCard = getCardFromDeck(challengerDeckDoc?.data(), ch.challengerCardId);
        const defenderCard = getCardFromDeck(defenderDeckDoc?.data(), ch.defenderCardId);
        if (!challengerCard || !defenderCard) {
          // Auto-cancel + refund — one of the cards has moved/been removed.
          if (ch.ozzyWager > 0) {
            tx.set(adminDb.collection(PROFILE_COLLECTION).doc(ch.challengerUid),
              { ozzies: FieldValue.increment(ch.ozzyWager), updatedAt: nowIso() }, { merge: true });
          }
          const next = { ...ch, status: 'cancelled', updatedAt: nowIso() };
          tx.set(ref, next);
          throw badRequest('One of the racing cards is no longer available — challenge cancelled.', 409);
        }

        // ── All tx reads must happen before any tx writes ──────────────────
        // Pre-fetch card docs for the post-race delta writes, and the
        // defender's profile if a wager needs to be validated.
        const challengerCardRef = adminDb.collection('users').doc(ch.challengerUid).collection('cards').doc(ch.challengerCardId);
        const defenderCardRef = adminDb.collection('users').doc(ch.defenderUid).collection('cards').doc(ch.defenderCardId);
        const defProfileRef = adminDb.collection(PROFILE_COLLECTION).doc(ch.defenderUid);

        const readsToFetch = [tx.get(challengerCardRef), tx.get(defenderCardRef)];
        if (ch.ozzyWager > 0) readsToFetch.push(tx.get(defProfileRef));
        const [challengerCardSnap, defenderCardSnap, defProfileSnap] = await Promise.all(readsToFetch);

        if (ch.ozzyWager > 0) {
          const balance = readOzzies(defProfileSnap.data());
          if (balance < ch.ozzyWager) {
            throw badRequest(`You only have ${balance} Ozzies — not enough to match the ${ch.ozzyWager} wager.`, 402);
          }
          tx.set(defProfileRef, { ozzies: FieldValue.increment(-ch.ozzyWager), updatedAt: nowIso() }, { merge: true });
        }

        // Run the simulation.
        const challengerSnapshot = createRaceCardSnapshot(challengerCard);
        const defenderSnapshot = createRaceCardSnapshot(defenderCard);
        const raceSeed = randomUUID();
        const { simulation, result: raw } = resolveRace(challengerSnapshot, defenderSnapshot, {
          wager: ch.ozzyWager,
          raceSeed,
        });

        const winnerUid = raw.winnerSide === 'challenger'
          ? ch.challengerUid
          : raw.winnerSide === 'defender'
            ? ch.defenderUid
            : null;

        const raceId = `race-${randomUUID()}`;
        const race = {
          id: raceId,
          challengeId: ch.id,
          challengerUid: ch.challengerUid,
          defenderUid: ch.defenderUid,
          challenger: challengerSnapshot,
          defender: defenderSnapshot,
          ozzyWager: ch.ozzyWager,
          laps: 1,
          tickMs: RACE_TICK_MS,
          timeline: simulation.timeline,
          result: {
            winnerUid,
            challengerFinishTick: raw.challengerFinishTick,
            defenderFinishTick: raw.defenderFinishTick,
            ozzyTransfer: raw.ozzyTransfer,
            cardDeltas: raw.cardDeltas,
            ...(raw.winnerStatBoost ? { winnerStatBoost: raw.winnerStatBoost } : {}),
            raceSeed,
          },
          createdAt: nowIso(),
        };
        tx.set(adminDb.collection(RACES_COLLECTION).doc(raceId), race);

        // Settle the pot. Wagers were already escrowed from both players.
        // Pay 2× wager plus the standard win prize to the winner; refund both on a draw.
        if (raw.winnerSide && ch.ozzyWager > 0) {
          tx.set(adminDb.collection(PROFILE_COLLECTION).doc(winnerUid),
            { ozzies: FieldValue.increment(getWinnerProfilePrize(ch.ozzyWager)), updatedAt: nowIso() }, { merge: true });
        } else if (raw.winnerSide) {
          tx.set(adminDb.collection(PROFILE_COLLECTION).doc(winnerUid),
            { ozzies: FieldValue.increment(STANDARD_RACE_WINNER_OZZIES), updatedAt: nowIso() }, { merge: true });
        } else if (!raw.winnerSide && ch.ozzyWager > 0) {
          // Refund both.
          tx.set(adminDb.collection(PROFILE_COLLECTION).doc(ch.challengerUid),
            { ozzies: FieldValue.increment(ch.ozzyWager), updatedAt: nowIso() }, { merge: true });
          tx.set(adminDb.collection(PROFILE_COLLECTION).doc(ch.defenderUid),
            { ozzies: FieldValue.increment(ch.ozzyWager), updatedAt: nowIso() }, { merge: true });
        }

        // Apply per-card deltas (XP/ozzies/stat boost) on the actual cards
        // using the snapshots already fetched above (reads before writes).
        applyCardDelta(tx, challengerCardRef, challengerCardSnap,
          raw.cardDeltas.challenger, raw.winnerSide === 'challenger' ? raw.winnerStatBoost : null);
        applyCardDelta(tx, defenderCardRef, defenderCardSnap,
          raw.cardDeltas.defender, raw.winnerSide === 'defender' ? raw.winnerStatBoost : null);

        // Mark the challenge resolved.
        const next = { ...ch, status: 'resolved', updatedAt: nowIso(), raceId };
        tx.set(ref, next);

        // Notify both players.
        for (const recipient of [ch.challengerUid, ch.defenderUid]) {
          const isWinner = recipient === winnerUid;
          const notif = buildNotification({
            uid: recipient,
            type: 'race_finished',
            title: raw.winnerSide
              ? (isWinner ? '🏁 You won the race!' : 'Race finished — opponent took the win.')
              : '🏁 Race finished in a draw.',
            body: raw.winnerSide
              ? (isWinner ? `+${ch.ozzyWager > 0 ? getWinnerProfilePrize(ch.ozzyWager) : STANDARD_RACE_WINNER_OZZIES} Ozzies awarded.` : '')
              : 'Wagers refunded.',
            link: `/race/${raceId}`,
            data: { raceId, challengeId: id },
            randomUUID,
          });
          tx.set(notificationDocRef(adminDb, notif.ref.uid, notif.ref.id), notif.payload);
        }

        return { challenge: next, race };
      });
      res.status(200).json(result);
    } catch (error) {
      console.error('Race respond error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to respond to challenge.' });
    }
  });

  // ── POST /api/race/solo ──────────────────────────────────────────────────
  // Race against a seeded bot opponent. Only the player's card receives XP /
  // Ozzy / stat-boost deltas — the bot has no persistent card to update.
  // Wager settlement: player wins → refund wager + STANDARD_RACE_WINNER_OZZIES;
  // bot wins → wager is lost; draw → wager refunded.
  // NOTE: must be registered before POST/GET /api/race/:id so Express does not
  // treat the literal path segment "solo" as a dynamic :id parameter.
  app.post('/api/race/solo', limiter, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Race arena is not configured on this server.' });
      return;
    }

    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    const playerUid = caller.uid;
    const cardId = String(req.body?.cardId ?? '').trim();
    const wager = clampWager(req.body?.ozzyWager);
    const district = String(req.body?.district ?? '').trim() || null;

    if (!cardId) {
      res.status(400).json({ error: 'cardId is required.' });
      return;
    }

    try {
      // Load the player's primary deck outside the transaction (no writes yet).
      const decksSnap = await adminDb.collection('users').doc(playerUid).collection('decks').get();
      const primaryDeckDoc = findPrimaryDeck(decksSnap);
      if (!primaryDeckDoc) {
        res.status(409).json({ error: 'You need a primary deck to run a solo sprint.' });
        return;
      }
      const playerDeck = primaryDeckDoc.data();
      const playerCard = getCardFromDeck(playerDeck, cardId);
      if (!playerCard) {
        res.status(409).json({ error: 'The selected card is not in your primary deck.' });
        return;
      }

      // Build snapshots and run the simulation before entering the transaction
      // (pure computation — no side effects).
      // raceSeed is used directly for the race simulation so it can be stored and
      // replayed. generateBotSnapshot uses `${raceSeed}:bot-gen` internally, so
      // the two RNGs are independent sequences with no shared state.
      const playerSnapshot = createRaceCardSnapshot(playerCard);
      const raceSeed = randomUUID();
      const botSnapshot = generateBotSnapshot(playerSnapshot.stats, raceSeed);
      const { simulation, result: raw } = resolveRace(playerSnapshot, botSnapshot, { wager, raceSeed });

      // Determine per-profile Ozzy adjustment for the player.
      // Bot has no profile to update; only the player's card+profile change.
      const playerWon = raw.winnerSide === 'challenger';
      const draw = raw.winnerSide === null;
      let profileOzzyAdjust = 0;
      if (playerWon) {
        profileOzzyAdjust = wager + STANDARD_RACE_WINNER_OZZIES;
      } else if (draw) {
        profileOzzyAdjust = wager; // refund
      }
      // Bot win: wager was already escrowed; no refund.

      const raceId = `race-${randomUUID()}`;
      const race = {
        id: raceId,
        challengeId: 'solo',
        challengerUid: playerUid,
        defenderUid: 'bot',
        ...(district ? { district } : {}),
        challenger: playerSnapshot,
        defender: botSnapshot,
        ozzyWager: wager,
        laps: 1,
        tickMs: RACE_TICK_MS,
        timeline: simulation.timeline,
        result: {
          winnerUid: playerWon ? playerUid : null,
          challengerFinishTick: raw.challengerFinishTick,
          defenderFinishTick: raw.defenderFinishTick,
          ozzyTransfer: raw.ozzyTransfer,
          cardDeltas: raw.cardDeltas,
          ...(raw.winnerStatBoost ? { winnerStatBoost: raw.winnerStatBoost } : {}),
          raceSeed,
        },
        createdAt: nowIso(),
      };

      await adminDb.runTransaction(async (tx) => {
        const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(playerUid);
        const cardRef = adminDb.collection('users').doc(playerUid).collection('cards').doc(cardId);

        // All reads before any writes (Firestore requirement).
        const [profileSnap, cardSnap] = await Promise.all([tx.get(profileRef), tx.get(cardRef)]);

        // Validate wager balance and escrow it.
        if (wager > 0) {
          const balance = readOzzies(profileSnap.data());
          if (balance < wager) {
            throw badRequest(`You only have ${balance} Ozzies — not enough to wager ${wager}.`, 402);
          }
          tx.set(profileRef, { ozzies: FieldValue.increment(-wager), updatedAt: nowIso() }, { merge: true });
        }

        // Persist the race doc.
        tx.set(adminDb.collection(RACES_COLLECTION).doc(raceId), race);

        // Apply XP + Ozzy delta to the player's card.
        applyCardDelta(
          tx, cardRef, cardSnap,
          raw.cardDeltas.challenger,
          playerWon ? raw.winnerStatBoost : null,
        );

        // Settle Ozzies: credit winnings / refund back to profile.
        if (profileOzzyAdjust > 0) {
          tx.set(profileRef, { ozzies: FieldValue.increment(profileOzzyAdjust), updatedAt: nowIso() }, { merge: true });
        }
      });

      res.status(201).json(race);
    } catch (error) {
      console.error('Solo race error:', error);
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to start solo race.' });
    }
  });

  // ── GET /api/race/arena ──────────────────────────────────────────────────
  // Returns a paginated list of other players' primary-deck cards so the
  // viewer can pick an opponent + opponent card. Public reads are intentionally
  // limited to the small set of fields needed to render a starting grid.
  // NOTE: must be registered before GET /api/race/:id so Express does not
  // treat the literal path segment "arena" as a dynamic :id parameter.
  app.get('/api/race/arena', limiter, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Race arena is not configured on this server.' });
      return;
    }
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }

    try {
      const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 24));
      const lookupSnap = await adminDb.collection('userLookup').limit(limit * 2).get();
      const entries = [];
      for (const lookupDoc of lookupSnap.docs) {
        const lookup = lookupDoc.data() ?? {};
        const ownerUid = String(lookup.uid ?? lookupDoc.id);
        if (!ownerUid || ownerUid === caller.uid) continue;
        const decksSnap = await adminDb.collection('users').doc(ownerUid).collection('decks').get();
        const primaryDoc = findPrimaryDeck(decksSnap);
        if (!primaryDoc) continue;
        const deck = primaryDoc.data();
        if (!Array.isArray(deck?.cards) || deck.cards.length === 0) continue;
        entries.push({
          uid: ownerUid,
          displayName: String(lookup.displayName ?? lookup.emailLower?.split('@')[0] ?? 'Skater'),
          deckId: primaryDoc.id,
          deckName: String(deck.name ?? 'Primary deck'),
          challengerCardId: deck.challengerCardId ?? null,
          cards: deck.cards.map((card) => createRaceCardSnapshot(card)),
        });
        if (entries.length >= limit) break;
      }
      res.status(200).json({ entries });
    } catch (error) {
      console.error('Race arena listing error:', error);
      res.status(500).json({ error: 'Failed to load Race Arena.' });
    }
  });

  // ── GET /api/race/:id ────────────────────────────────────────────────────
  app.get('/api/race/:id', limiter, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Race arena is not configured on this server.' });
      return;
    }
    let caller;
    try {
      caller = await authenticateFirebaseUser(req);
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
      return;
    }
    const id = String(req.params?.id ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'Race id is required.' });
      return;
    }
    try {
      const snap = await adminDb.collection(RACES_COLLECTION).doc(id).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Race not found.' });
        return;
      }
      const race = snap.data();
      if (caller.uid !== race.challengerUid && caller.uid !== race.defenderUid) {
        res.status(403).json({ error: 'You are not a participant in this race.' });
        return;
      }
      res.status(200).json(race);
    } catch (error) {
      console.error('Race fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch race.' });
    }
  });
}
