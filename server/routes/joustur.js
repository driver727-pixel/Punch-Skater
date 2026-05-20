/**
 * Joustur Skatur — server routes.
 *
 * Endpoints:
 *   GET    /api/joustur/lineup              — load the caller's saved lineup.
 *   POST   /api/joustur/lineup              — save/overwrite the caller's lineup.
 *   POST   /api/joustur/challenge           — create a friend challenge.
 *   POST   /api/joustur/challenge/:id/accept  — accept a pending challenge (creates match).
 *   POST   /api/joustur/challenge/:id/decline — decline a pending challenge.
 *   POST   /api/joustur/queue              — enqueue for casual matchmaking.
 *   DELETE /api/joustur/queue              — leave the casual queue.
 *   GET    /api/joustur/matches             — list matches involving the caller.
 *   GET    /api/joustur/match/:id           — fetch a specific match.
 *   POST   /api/joustur/match/:id/roll      — (step 1) generate USB Shard roll.
 *   POST   /api/joustur/match/:id/move      — (step 2) submit rider move / support.
 */

import rateLimit from 'express-rate-limit';
import {
  validateLineup,
  resolveFactionForCrew,
  FACTION_PASSIVE,
  FACTION_SUPPORT_EFFECT,
  resolveRiderTrait,
  buildInitialPlayerState,
  buildInitialBoardState,
  getLegalMoves,
  applyMove,
  detectWinner,
  calcRewards,
  buildTurnLogEntry,
  generateRollSeed,
  rollUsbShards,
  createSeededRng,
  OFF_BOARD,
  PRIVATE_ENTRY_MIN,
  PRIVATE_ENTRY_MAX,
} from '../lib/jousturRules.js';

// ── Fallback rate limiter (production injector overrides this) ────────────────

const fallbackJousturRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many Joustur requests — please wait a moment.' },
});

// ── Firestore collection names ────────────────────────────────────────────────

const LINEUPS_COL     = 'jousturLineups';
const CHALLENGES_COL  = 'jousturChallenges';
const MATCHES_COL     = 'jousturMatches';
const TURNS_SUBCOL    = 'turns';
const QUEUE_COL       = 'jousturQueue';
const PROFILES_COL    = 'userProfiles';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function badRequest(message, status = 400) {
  return Object.assign(new Error(message), { statusCode: status });
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
      body,
      link,
      data: data ?? {},
      read: false,
      createdAt: nowIso(),
    },
  };
}

function notifRef(db, uid, id) {
  return db.collection('notifications').doc(uid).collection('items').doc(id);
}

/**
 * Build a JousturRiderSnapshot from a Firestore card document.
 */
function riderSnapshotFromCard(card) {
  const crew = card.identity?.crew ?? '';
  return {
    cardId: card.id,
    name: card.identity?.name ?? 'Unknown',
    rarity: card.class?.rarity ?? 'Apprentice',
    crew,
    jousturTrait: resolveRiderTrait(card.joust?.traits ?? []),
    jousturFaction: resolveFactionForCrew(crew),
    characterImageUrl: card.characterImageUrl ?? null,
    backgroundImageUrl: card.backgroundImageUrl ?? null,
    frameImageUrl: card.frameImageUrl ?? null,
  };
}

/**
 * Build a JousturSupportSnapshot from a Firestore card document.
 */
function supportSnapshotFromCard(card) {
  const crew = card.identity?.crew ?? '';
  const faction = resolveFactionForCrew(crew);
  return {
    cardId: card.id,
    name: card.identity?.name ?? 'Unknown',
    rarity: card.class?.rarity ?? 'Apprentice',
    crew,
    jousturFaction: faction,
    supportEffect: FACTION_SUPPORT_EFFECT[faction],
    characterImageUrl: card.characterImageUrl ?? null,
    backgroundImageUrl: card.backgroundImageUrl ?? null,
    frameImageUrl: card.frameImageUrl ?? null,
  };
}

/**
 * Fetch all cards in `cardIds` from a player's collection and verify they exist.
 * Throws a 404 if any card is missing.
 *
 * @param {object} db       Firestore Admin instance.
 * @param {string} uid      Player UID.
 * @param {string[]} cardIds
 * @returns {Promise<Record<string, object>>} id → card data
 */
async function fetchPlayerCards(db, uid, cardIds) {
  const refs = cardIds.map((id) =>
    db.collection('users').doc(uid).collection('cards').doc(id),
  );
  const snaps = await Promise.all(refs.map((r) => r.get()));
  const cards = {};
  snaps.forEach((snap, i) => {
    if (!snap.exists) {
      throw badRequest(
        `Card "${cardIds[i]}" was not found in your collection.`,
        404,
      );
    }
    cards[snap.id] = { id: snap.id, ...snap.data() };
  });
  return cards;
}

/**
 * Fetch both players' cards and build initial JousturPlayerState objects.
 */
async function buildMatchPlayerStates(db, challengerUid, defenderUid, challengerLineup, defenderLineup) {
  const challengerAllIds = [...challengerLineup.riderCardIds, challengerLineup.supportCardId];
  const defenderAllIds   = [...defenderLineup.riderCardIds, defenderLineup.supportCardId];

  const [challengerCards, defenderCards] = await Promise.all([
    fetchPlayerCards(db, challengerUid, challengerAllIds),
    fetchPlayerCards(db, defenderUid, defenderAllIds),
  ]);

  function buildState(uid, lineup, cards) {
    const riderSnapshots = lineup.riderCardIds.map((id) => riderSnapshotFromCard(cards[id]));
    const supportSnap    = supportSnapshotFromCard(cards[lineup.supportCardId]);
    const faction        = resolveFactionForCrew(cards[lineup.supportCardId].identity?.crew ?? '');
    return buildInitialPlayerState(uid, riderSnapshots, supportSnap, faction);
  }

  return {
    challengerState: buildState(challengerUid, challengerLineup, challengerCards),
    defenderState:   buildState(defenderUid,   defenderLineup,   defenderCards),
  };
}

/**
 * Try to dequeue an opponent from `jousturQueue` and create a casual match.
 * Returns the new JousturMatch on success, or null if no opponent was found.
 *
 * Uses a Firestore transaction to avoid double-matching.
 */
async function tryCreateCasualMatch(db, callerUid, callerLineup, randomUUID) {
  const queueRef = db.collection(QUEUE_COL);
  const callerRef = queueRef.doc(callerUid);

  return db.runTransaction(async (tx) => {
    // Find any queued player that isn't the caller.
    const snap = await queueRef.orderBy('enqueuedAt').limit(10).get();
    const opponent = snap.docs.find((d) => d.id !== callerUid);
    if (!opponent) {
      // No opponent available — just ensure the caller is queued.
      tx.set(callerRef, {
        uid: callerUid,
        enqueuedAt: nowIso(),
      });
      return null;
    }

    const defenderUid = opponent.id;
    const defenderLineupRef = db.collection(LINEUPS_COL).doc(defenderUid);
    const defenderLineupSnap = await tx.get(defenderLineupRef);
    if (!defenderLineupSnap.exists) {
      // Opponent has no lineup — remove from queue and try again next request.
      tx.delete(opponent.ref);
      tx.set(callerRef, { uid: callerUid, enqueuedAt: nowIso() });
      return null;
    }

    const defenderLineup = defenderLineupSnap.data();

    // Build states outside the transaction (card fetches can't be transactional).
    // We'll do it after the transaction commits if needed.
    // For now, remove both from queue and create the match doc.
    tx.delete(opponent.ref);
    tx.delete(callerRef);

    const matchId = `jm-${randomUUID()}`;
    const matchDoc = {
      id: matchId,
      status: 'active',
      mode: 'casual',
      challengerUid: callerUid,
      defenderUid,
      board: buildInitialBoardState(callerUid),
      // Player states will be patched in after the transaction.
      challengerState: null,
      defenderState: null,
      winnerUid: null,
      rewardsGranted: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    tx.set(db.collection(MATCHES_COL).doc(matchId), matchDoc);

    return { matchId, defenderUid, defenderLineup };
  }).then(async (result) => {
    if (!result) return null;
    const { matchId, defenderUid, defenderLineup } = result;

    // Now build player states and patch in (outside transaction).
    const { challengerState, defenderState } = await buildMatchPlayerStates(
      db, callerUid, defenderUid, callerLineup, defenderLineup,
    );
    const ref = db.collection(MATCHES_COL).doc(matchId);
    await ref.update({ challengerState, defenderState, updatedAt: nowIso() });
    const updated = await ref.get();
    return updated.data();
  });
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerJousturRoutes(app, {
  adminDb,
  jousturRateLimit,
  authenticateFirebaseUser,
  randomUUID,
  FieldValue,
}) {
  if (!app) throw new Error('registerJousturRoutes requires an Express app.');

  const limiter = jousturRateLimit ?? fallbackJousturRateLimit;

  // ── GET /api/joustur/lineup ─────────────────────────────────────────────────
  app.get('/api/joustur/lineup', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const snap = await adminDb.collection(LINEUPS_COL).doc(caller.uid).get();
    if (!snap.exists) { res.json(null); return; }
    res.json(snap.data());
  });

  // ── POST /api/joustur/lineup ────────────────────────────────────────────────
  app.post('/api/joustur/lineup', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const riderCardIds = Array.isArray(req.body?.riderCardIds) ? req.body.riderCardIds : [];
    const supportCardId = String(req.body?.supportCardId ?? '').trim();

    const { valid, reason } = validateLineup(riderCardIds, supportCardId);
    if (!valid) { res.status(400).json({ error: reason }); return; }

    try {
      // Verify ownership — throws 404 if any card is missing.
      await fetchPlayerCards(adminDb, caller.uid, [...riderCardIds, supportCardId]);

      const lineup = {
        uid: caller.uid,
        riderCardIds,
        supportCardId,
        updatedAt: nowIso(),
      };
      await adminDb.collection(LINEUPS_COL).doc(caller.uid).set(lineup);
      res.json(lineup);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/challenge ─────────────────────────────────────────────
  app.post('/api/joustur/challenge', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const defenderUid = String(req.body?.defenderUid ?? '').trim();
    if (!defenderUid) { res.status(400).json({ error: 'defenderUid is required.' }); return; }
    if (defenderUid === caller.uid) { res.status(400).json({ error: 'You cannot challenge yourself.' }); return; }

    try {
      // Both players need saved lineups.
      const [challengerSnap, defenderSnap] = await Promise.all([
        adminDb.collection(LINEUPS_COL).doc(caller.uid).get(),
        adminDb.collection(LINEUPS_COL).doc(defenderUid).get(),
      ]);
      if (!challengerSnap.exists) throw badRequest('Save a lineup before issuing a challenge.', 409);
      if (!defenderSnap.exists)   throw badRequest('Opponent has not saved a Joustur lineup yet.', 409);

      const id = `jc-${randomUUID()}`;
      const challenge = {
        id,
        status: 'pending',
        challengerUid: caller.uid,
        challengerDisplayName: caller.name ?? caller.email?.split('@')[0] ?? 'Skater',
        defenderUid,
        defenderDisplayName: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await adminDb.collection(CHALLENGES_COL).doc(id).set(challenge);

      // Notify defender.
      const notif = buildNotification({
        uid: defenderUid,
        type: 'joustur_challenge',
        title: `${challenge.challengerDisplayName} challenged you to Joustur Skatur!`,
        body: 'Accept or decline in Joustur.',
        link: '/joustur',
        data: { challengeId: id },
        randomUUID,
      });
      await adminDb.doc(`notifications/${defenderUid}/items/${notif.ref.id}`).set(notif.payload);

      res.status(201).json(challenge);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/challenge/:id/accept ──────────────────────────────────
  app.post('/api/joustur/challenge/:id/accept', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const challengeId = String(req.params?.id ?? '').trim();
    if (!challengeId) { res.status(400).json({ error: 'Challenge ID is required.' }); return; }

    try {
      const chalRef = adminDb.collection(CHALLENGES_COL).doc(challengeId);
      const chalSnap = await chalRef.get();
      if (!chalSnap.exists) throw badRequest('Challenge not found.', 404);

      const ch = chalSnap.data();
      if (ch.defenderUid !== caller.uid) throw badRequest('Only the defender can accept this challenge.', 403);
      if (ch.status !== 'pending') throw badRequest('This challenge is no longer pending.', 409);

      // Load lineups.
      const [cLineupSnap, dLineupSnap] = await Promise.all([
        adminDb.collection(LINEUPS_COL).doc(ch.challengerUid).get(),
        adminDb.collection(LINEUPS_COL).doc(ch.defenderUid).get(),
      ]);
      if (!cLineupSnap.exists) throw badRequest('Challenger has no saved lineup.', 409);
      if (!dLineupSnap.exists) throw badRequest('You need a saved lineup to accept.', 409);

      // Build full player states (verifies card ownership).
      const { challengerState, defenderState } = await buildMatchPlayerStates(
        adminDb,
        ch.challengerUid,
        ch.defenderUid,
        cLineupSnap.data(),
        dLineupSnap.data(),
      );

      const matchId = `jm-${randomUUID()}`;
      const match = {
        id: matchId,
        status: 'active',
        mode: 'friend',
        challengerUid: ch.challengerUid,
        defenderUid: ch.defenderUid,
        board: buildInitialBoardState(ch.challengerUid),
        challengerState,
        defenderState,
        winnerUid: null,
        rewardsGranted: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      const batch = adminDb.batch();
      batch.set(adminDb.collection(MATCHES_COL).doc(matchId), match);
      batch.update(chalRef, { status: 'accepted', matchId, updatedAt: nowIso() });
      await batch.commit();

      // Notify challenger.
      const notif = buildNotification({
        uid: ch.challengerUid,
        type: 'joustur_accepted',
        title: 'Your Joustur challenge was accepted!',
        body: 'Head to Joustur to take your first turn.',
        link: `/joustur/match/${matchId}`,
        data: { matchId },
        randomUUID,
      });
      await adminDb.doc(`notifications/${ch.challengerUid}/items/${notif.ref.id}`).set(notif.payload);

      res.status(201).json(match);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/challenge/:id/decline ─────────────────────────────────
  app.post('/api/joustur/challenge/:id/decline', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const challengeId = String(req.params?.id ?? '').trim();
    try {
      const chalRef = adminDb.collection(CHALLENGES_COL).doc(challengeId);
      const chalSnap = await chalRef.get();
      if (!chalSnap.exists) throw badRequest('Challenge not found.', 404);
      const ch = chalSnap.data();
      if (ch.defenderUid !== caller.uid) throw badRequest('Only the defender can decline.', 403);
      if (ch.status !== 'pending') throw badRequest('Challenge is no longer pending.', 409);

      await chalRef.update({ status: 'declined', updatedAt: nowIso() });
      res.json({ status: 'declined' });
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/queue ─────────────────────────────────────────────────
  app.post('/api/joustur/queue', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    try {
      const lineupSnap = await adminDb.collection(LINEUPS_COL).doc(caller.uid).get();
      if (!lineupSnap.exists) throw badRequest('Save a lineup before queuing.', 409);
      const callerLineup = lineupSnap.data();

      const match = await tryCreateCasualMatch(adminDb, caller.uid, callerLineup, randomUUID);
      if (match) {
        res.status(201).json({ queued: false, match });
      } else {
        res.json({ queued: true });
      }
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── DELETE /api/joustur/queue ───────────────────────────────────────────────
  app.delete('/api/joustur/queue', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    await adminDb.collection(QUEUE_COL).doc(caller.uid).delete();
    res.json({ dequeued: true });
  });

  // ── GET /api/joustur/matches ────────────────────────────────────────────────
  app.get('/api/joustur/matches', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    try {
      const [asChallenger, asDefender] = await Promise.all([
        adminDb.collection(MATCHES_COL).where('challengerUid', '==', caller.uid).orderBy('updatedAt', 'desc').limit(20).get(),
        adminDb.collection(MATCHES_COL).where('defenderUid',   '==', caller.uid).orderBy('updatedAt', 'desc').limit(20).get(),
      ]);
      const seen = new Set();
      const matches = [];
      [...asChallenger.docs, ...asDefender.docs].forEach((d) => {
        if (!seen.has(d.id)) { seen.add(d.id); matches.push(d.data()); }
      });
      matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json(matches);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── GET /api/joustur/match/:id ──────────────────────────────────────────────
  app.get('/api/joustur/match/:id', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const matchId = String(req.params?.id ?? '').trim();
    try {
      const snap = await adminDb.collection(MATCHES_COL).doc(matchId).get();
      if (!snap.exists) throw badRequest('Match not found.', 404);
      const match = snap.data();
      if (match.challengerUid !== caller.uid && match.defenderUid !== caller.uid) {
        throw badRequest('Access denied.', 403);
      }
      res.json(match);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/match/:id/roll ────────────────────────────────────────
  // Step 1 of the two-step turn flow: generate the USB Shard roll for the
  // active player.  The roll is stored in the match document before being
  // returned so both players can always read the canonical result.
  app.post('/api/joustur/match/:id/roll', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const matchId = String(req.params?.id ?? '').trim();
    try {
      const matchRef = adminDb.collection(MATCHES_COL).doc(matchId);
      const snap = await matchRef.get();
      if (!snap.exists) throw badRequest('Match not found.', 404);
      const match = snap.data();

      if (match.challengerUid !== caller.uid && match.defenderUid !== caller.uid) {
        throw badRequest('Access denied.', 403);
      }
      if (match.status !== 'active') throw badRequest('This match is not active.', 409);
      if (match.board.activePlayerUid !== caller.uid) {
        throw badRequest('It is not your turn.', 403);
      }
      if (match.board.rollResult !== null) {
        throw badRequest('A roll is already pending — submit your move first.', 409);
      }

      // Generate deterministic roll.
      const timestamp = Date.now();
      const seed = generateRollSeed(matchId, match.board.turn, timestamp);
      const rng  = createSeededRng(seed);
      const roll = rollUsbShards(rng);

      // Compute legal moves for the client.
      const isChallenger = match.challengerUid === caller.uid;
      const activeState   = isChallenger ? match.challengerState : match.defenderState;
      const opponentState = isChallenger ? match.defenderState   : match.challengerState;
      const boardWithRoll = { ...match.board, rollResult: roll };
      const legalMoves = getLegalMoves(boardWithRoll, activeState, opponentState);

      await matchRef.update({
        'board.rollResult': roll,
        updatedAt: nowIso(),
      });

      res.json({ roll, legalMoves, canActivateSupport: !activeState.supportRuntime.activated });
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/match/:id/move ────────────────────────────────────────
  // Step 2: submit the active player's chosen action.
  app.post('/api/joustur/match/:id/move', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const matchId = String(req.params?.id ?? '').trim();
    try {
      const matchRef = adminDb.collection(MATCHES_COL).doc(matchId);
      const snap = await matchRef.get();
      if (!snap.exists) throw badRequest('Match not found.', 404);
      const match = snap.data();

      if (match.challengerUid !== caller.uid && match.defenderUid !== caller.uid) {
        throw badRequest('Access denied.', 403);
      }
      if (match.status !== 'active') throw badRequest('This match is not active.', 409);
      if (match.board.activePlayerUid !== caller.uid) {
        throw badRequest('It is not your turn.', 403);
      }
      if (match.board.rollResult === null) {
        throw badRequest('Roll first before submitting a move.', 409);
      }

      const isChallenger = match.challengerUid === caller.uid;
      const activeState   = isChallenger ? match.challengerState : match.defenderState;
      const opponentState = isChallenger ? match.defenderState   : match.challengerState;

      // Parse and validate the move choice.
      const cardId              = req.body?.cardId ? String(req.body.cardId) : null;
      const activateSupport     = req.body?.activateSupport === true;
      const supportTargetCardId = req.body?.supportTargetCardId
        ? String(req.body.supportTargetCardId)
        : undefined;

      // Validate: if cardId is provided, it must be a legal move.
      if (cardId) {
        const legal = getLegalMoves(match.board, activeState, opponentState);
        if (!legal.some((m) => m.cardId === cardId)) {
          throw badRequest('That move is not legal for the current roll.', 422);
        }
      } else if (!activateSupport && match.board.rollResult !== 0) {
        // Player must either move a rider or activate support (unless roll is 0).
        const legal = getLegalMoves(match.board, activeState, opponentState);
        if (legal.length > 0) {
          throw badRequest('You must move a rider (or activate support) when legal moves exist.', 422);
        }
      }

      // Validate support activation.
      if (activateSupport && activeState.supportRuntime.activated) {
        throw badRequest('Support has already been used in this match.', 409);
      }

      const preTurn = match.board.turn;
      const preActiveFrom = cardId
        ? (activeState.riders.find((r) => r.cardId === cardId)?.position ?? 0)
        : 0;

      // Apply the move (pure).
      const { board: newBoard, active: newActive, opponent: newOpp, extraTurn, capturedCardId, events } =
        applyMove(
          match.board,
          activeState,
          opponentState,
          { cardId, activateSupport, supportTargetCardId },
        );

      // Build the updated match.
      const newMatch = {
        ...match,
        board: newBoard,
        updatedAt: nowIso(),
      };
      if (isChallenger) {
        newMatch.challengerState = newActive;
        newMatch.defenderState   = newOpp;
      } else {
        newMatch.defenderState   = newActive;
        newMatch.challengerState = newOpp;
      }

      // Win detection.
      let winner = null;
      if (detectWinner(newActive)) {
        winner = caller.uid;
        newMatch.status      = 'completed';
        newMatch.winnerUid   = winner;
        newMatch.completedAt = nowIso();
      }

      // Persist match.
      await matchRef.set(newMatch);

      // Persist turn log entry.
      const supportEffect = activateSupport ? activeState.support.supportEffect : undefined;
      const turnEntry = buildTurnLogEntry({
        id: `turn-${randomUUID()}`,
        matchId,
        turn: preTurn,
        playerUid: caller.uid,
        rollResult: match.board.rollResult,
        movedCardId: cardId,
        fromPosition: preActiveFrom,
        toPosition: cardId ? (newActive.riders.find((r) => r.cardId === cardId)?.position ?? 0) : 0,
        capturedCardId,
        extraTurn,
        supportActivated: activateSupport,
        supportEffect,
        timestamp: nowIso(),
      });
      await adminDb
        .collection(MATCHES_COL)
        .doc(matchId)
        .collection(TURNS_SUBCOL)
        .doc(turnEntry.id)
        .set(turnEntry);

      // Grant rewards idempotently after completion.
      if (winner && !match.rewardsGranted) {
        const rewards = calcRewards(newMatch);
        const batch = adminDb.batch();

        const cRef = adminDb.collection(PROFILES_COL).doc(newMatch.challengerUid);
        const dRef = adminDb.collection(PROFILES_COL).doc(newMatch.defenderUid);
        batch.set(cRef, {
          xp: FieldValue.increment(rewards.challenger.xp),
          ozzies: FieldValue.increment(rewards.challenger.ozzies),
          updatedAt: nowIso(),
        }, { merge: true });
        batch.set(dRef, {
          xp: FieldValue.increment(rewards.defender.xp),
          ozzies: FieldValue.increment(rewards.defender.ozzies),
          updatedAt: nowIso(),
        }, { merge: true });
        batch.update(matchRef, { rewardsGranted: true, updatedAt: nowIso() });
        await batch.commit();
        newMatch.rewardsGranted = true;
      }

      res.json({ match: newMatch, turnEntry, events, extraTurn, winner });
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });
}
