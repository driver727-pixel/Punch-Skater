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
  FACTION_SUPPORT_EFFECT,
  resolveRiderTrait,
  buildInitialPlayerState,
  buildInitialBoardState,
  getLegalMoves,
  canActivateSupportEffect,
  applyMove,
  detectWinner,
  calcRewards,
  buildTurnLogEntry,
  generateRollSeed,
  rollUsbShards,
  createSeededRng,
  chooseAutomatedMove,
  buildSoloBotPlayerState,
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

async function buildPlayerStateFromLineup(db, uid, lineup) {
  const allIds = [...lineup.riderCardIds, lineup.supportCardId];
  const cards = await fetchPlayerCards(db, uid, allIds);
  const riderSnapshots = lineup.riderCardIds.map((id) => riderSnapshotFromCard(cards[id]));
  const supportSnap = supportSnapshotFromCard(cards[lineup.supportCardId]);
  const faction = resolveFactionForCrew(cards[lineup.supportCardId].identity?.crew ?? '');
  return buildInitialPlayerState(uid, riderSnapshots, supportSnap, faction);
}

function applyMatchRewards(tx, db, match, FieldValue) {
  const rewards = calcRewards(match);
  const challengerRef = db.collection(PROFILES_COL).doc(match.challengerUid);

  if (match.mode === 'solo') {
    tx.set(challengerRef, {
      xp: FieldValue.increment(rewards.challenger.xp),
      ozzies: FieldValue.increment(rewards.challenger.ozzies),
      updatedAt: nowIso(),
    }, { merge: true });
    return;
  }

  const defenderRef = db.collection(PROFILES_COL).doc(match.defenderUid);
  tx.set(challengerRef, {
    xp: FieldValue.increment(rewards.challenger.xp),
    ozzies: FieldValue.increment(rewards.challenger.ozzies),
    updatedAt: nowIso(),
  }, { merge: true });
  tx.set(defenderRef, {
    xp: FieldValue.increment(rewards.defender.xp),
    ozzies: FieldValue.increment(rewards.defender.ozzies),
    updatedAt: nowIso(),
  }, { merge: true });
}

function resolveSoloBotTurns(match, matchId, randomUUID) {
  const nextMatch = JSON.parse(JSON.stringify(match));
  const turnEntries = [];

  while (
    nextMatch.mode === 'solo' &&
    nextMatch.status === 'active' &&
    nextMatch.board.activePlayerUid === nextMatch.defenderUid
  ) {
    const activeState = nextMatch.defenderState;
    const opponentState = nextMatch.challengerState;
    const roll = rollUsbShards(
      createSeededRng(generateRollSeed(matchId, nextMatch.board.turn, 'solo-bot')),
    );
    const boardWithRoll = {
      ...nextMatch.board,
      rollResult: roll,
    };
    const choice = chooseAutomatedMove(boardWithRoll, activeState, opponentState);
    const fromPosition = choice.cardId
      ? (activeState.riders.find((r) => r.cardId === choice.cardId)?.position ?? 0)
      : 0;
    const supportEffect = choice.activateSupport
      ? activeState.support.supportEffect
      : undefined;
    const { board, active, opponent, extraTurn, capturedCardId, events } = applyMove(
      boardWithRoll,
      activeState,
      opponentState,
      choice,
    );

    nextMatch.board = board;
    nextMatch.defenderState = active;
    nextMatch.challengerState = opponent;
    nextMatch.updatedAt = nowIso();

    if (detectWinner(active)) {
      nextMatch.status = 'completed';
      nextMatch.winnerUid = active.uid;
      nextMatch.completedAt = nowIso();
    }

    const toPosition = choice.cardId
      ? (active.riders.find((r) => r.cardId === choice.cardId)?.position ?? 0)
      : 0;
    turnEntries.push({
      turnEntry: buildTurnLogEntry({
        id: `turn-${randomUUID()}`,
        matchId,
        turn: boardWithRoll.turn,
        playerUid: activeState.uid,
        rollResult: roll,
        movedCardId: choice.cardId,
        fromPosition,
        toPosition,
        capturedCardId,
        extraTurn,
        supportActivated: choice.activateSupport,
        supportEffect,
        timestamp: nowIso(),
      }),
      events,
    });
  }

  return { match: nextMatch, turnEntries };
}

/**
 * Try to dequeue an opponent from `jousturQueue` and create a casual match.
 * Returns the new JousturMatch on success, or null if no opponent was found.
 *
 * Uses a Firestore transaction to avoid double-matching.
 *
 * Strategy (P0-C fix): The initial queue scan is intentionally performed
 * OUTSIDE the transaction because Firestore transactions don't support queries.
 * Inside the transaction we use `tx.get(opponentRef)` to include the opponent
 * doc in the transaction's read-set, so Firestore's optimistic concurrency will
 * abort and retry any concurrent transaction that tries to match the same
 * opponent simultaneously.
 */
async function tryCreateCasualMatch(db, callerUid, callerLineup, randomUUID) {
  const queueRef = db.collection(QUEUE_COL);
  const callerRef = queueRef.doc(callerUid);

  // Scan the queue outside the transaction — Firestore transactions do not
  // support queries. We find candidate opponents here, then verify each one
  // still exists inside the transaction via a transactional document read.
  const snap = await queueRef.orderBy('enqueuedAt').limit(10).get();
  const opponentDoc = snap.docs.find((d) => d.id !== callerUid);

  if (!opponentDoc) {
    // No opponent in queue — enqueue the caller and return.
    await callerRef.set({ uid: callerUid, enqueuedAt: nowIso() });
    return null;
  }

  const opponentRef = opponentDoc.ref;

  return db.runTransaction(async (tx) => {
    // Re-read the opponent doc inside the transaction so Firestore includes it
    // in the read-set. If another concurrent transaction has already deleted
    // this doc (matched the opponent), Firestore will abort and retry.
    const opponentSnap = await tx.get(opponentRef);
    if (!opponentSnap.exists) {
      // Opponent was already matched by a concurrent transaction — enqueue caller.
      tx.set(callerRef, { uid: callerUid, enqueuedAt: nowIso() });
      return null;
    }

    const defenderUid = opponentSnap.id;
    if (defenderUid === callerUid) {
      // Defensive guard: the pre-scan filters the caller on line 202, but if
      // the caller somehow enqueued themselves between the scan and the tx.get
      // read (very unlikely), we must not create a match against ourselves.
      tx.set(callerRef, { uid: callerUid, enqueuedAt: nowIso() });
      return null;
    }

    const defenderLineupRef = db.collection(LINEUPS_COL).doc(defenderUid);
    const defenderLineupSnap = await tx.get(defenderLineupRef);
    if (!defenderLineupSnap.exists) {
      // Opponent has no lineup — remove from queue and enqueue caller.
      tx.delete(opponentRef);
      tx.set(callerRef, { uid: callerUid, enqueuedAt: nowIso() });
      return null;
    }

    const defenderLineup = defenderLineupSnap.data();

    // Remove both from queue and create the match doc atomically.
    tx.delete(opponentRef);
    tx.delete(callerRef);

    const matchId = `jm-${randomUUID()}`;
    const matchDoc = {
      id: matchId,
      status: 'initializing',
      mode: 'casual',
      challengerUid: callerUid,
      defenderUid,
      board: buildInitialBoardState(callerUid),
      // Player states will be patched in after the transaction; status will
      // flip to 'active' only once both player states are written.
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

    const ref = db.collection(MATCHES_COL).doc(matchId);
    try {
      // Build player states and patch them in atomically with the status flip.
      // If this fails the match is stuck as 'initializing' and can be cleaned
      // up safely — neither player is in 'active' state so no moves can be
      // submitted.
      const { challengerState, defenderState } = await buildMatchPlayerStates(
        db, callerUid, defenderUid, callerLineup, defenderLineup,
      );
      await ref.update({
        status: 'active',
        challengerState,
        defenderState,
        updatedAt: nowIso(),
      });
    } catch (err) {
      // Card fetch or patch failed — delete the match doc so the queue slot is
      // freed and neither player is stuck waiting for an unplayable match.
      await ref.delete().catch(() => {});
      throw err;
    }

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
      const [challengerSnap, defenderSnap, defenderLookupSnap] = await Promise.all([
        adminDb.collection(LINEUPS_COL).doc(caller.uid).get(),
        adminDb.collection(LINEUPS_COL).doc(defenderUid).get(),
        adminDb.collection('userLookup').doc(defenderUid).get(),
      ]);
      if (!challengerSnap.exists) throw badRequest('Save a lineup before issuing a challenge.', 409);
      if (!defenderSnap.exists)   throw badRequest('Opponent has not saved a Joustur lineup yet.', 409);

      const defenderDisplayName = defenderLookupSnap.exists
        ? (defenderLookupSnap.data()?.displayName ?? '')
        : '';

      const id = `jc-${randomUUID()}`;
      const challenge = {
        id,
        status: 'pending',
        challengerUid: caller.uid,
        challengerDisplayName: caller.name ?? caller.email?.split('@')[0] ?? 'Skater',
        defenderUid,
        defenderDisplayName,
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

      // P0-B: Wrap the entire accept flow in a transaction so that two
      // concurrent accept requests cannot both see status==='pending' and
      // each create a separate match.  The challenge read, status check,
      // challenge update, and match creation all happen atomically.
      let match;
      let challengerUid;

      await adminDb.runTransaction(async (tx) => {
        const chalSnap = await tx.get(chalRef);
        if (!chalSnap.exists) throw badRequest('Challenge not found.', 404);

        const ch = chalSnap.data();
        if (ch.defenderUid !== caller.uid) throw badRequest('Only the defender can accept this challenge.', 403);
        // Re-check inside the transaction — a concurrent accept may have
        // already changed the status before this transaction commits.
        if (ch.status !== 'pending') throw badRequest('This challenge is no longer pending.', 409);

        // Load lineups transactionally so they're part of the read-set.
        const cLineupRef = adminDb.collection(LINEUPS_COL).doc(ch.challengerUid);
        const dLineupRef = adminDb.collection(LINEUPS_COL).doc(ch.defenderUid);
        const [cLineupSnap, dLineupSnap] = await Promise.all([
          tx.get(cLineupRef),
          tx.get(dLineupRef),
        ]);
        if (!cLineupSnap.exists) throw badRequest('Challenger has no saved lineup.', 409);
        if (!dLineupSnap.exists) throw badRequest('You need a saved lineup to accept.', 409);

        // Build full player states by fetching card docs outside the transaction's
        // read-set.  This call is idempotent (read-only card fetches) so it is
        // safe to re-execute on transaction retry.  All Firestore writes are
        // buffered via tx.set() calls below and only committed after this
        // callback resolves — no writes occur here.
        const { challengerState, defenderState } = await buildMatchPlayerStates(
          adminDb,
          ch.challengerUid,
          ch.defenderUid,
          cLineupSnap.data(),
          dLineupSnap.data(),
        );

        const matchId = `jm-${randomUUID()}`;
        match = {
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
        challengerUid = ch.challengerUid;

        tx.set(adminDb.collection(MATCHES_COL).doc(matchId), match);
        tx.update(chalRef, { status: 'accepted', matchId, updatedAt: nowIso() });
      });

      // Notify challenger outside the transaction (notifications are not
      // transactional and a failure here must not roll back the match).
      const notif = buildNotification({
        uid: challengerUid,
        type: 'joustur_accepted',
        title: 'Your Joustur challenge was accepted!',
        body: 'Head to Joustur to take your first turn.',
        link: `/joustur/match/${match.id}`,
        data: { matchId: match.id },
        randomUUID,
      });
      await adminDb.doc(`notifications/${challengerUid}/items/${notif.ref.id}`).set(notif.payload);

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

  // ── GET /api/joustur/challenges ─────────────────────────────────────────────
  // Returns pending challenges where the caller is either the challenger or the
  // defender.  This is what the UI needs to show a challenge inbox / outbox.
  app.get('/api/joustur/challenges', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    try {
      const col = adminDb.collection(CHALLENGES_COL);
      const [asChallengerSnap, asDefenderSnap] = await Promise.all([
        col
          .where('challengerUid', '==', caller.uid)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get(),
        col
          .where('defenderUid', '==', caller.uid)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get(),
      ]);

      const sent     = asChallengerSnap.docs.map((d) => d.data());
      const received = asDefenderSnap.docs.map((d) => d.data());
      res.json({ sent, received });
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

  // ── POST /api/joustur/solo ──────────────────────────────────────────────────
  app.post('/api/joustur/solo', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    try {
      const lineupSnap = await adminDb.collection(LINEUPS_COL).doc(caller.uid).get();
      if (!lineupSnap.exists) throw badRequest('Save a lineup before starting a solo match.', 409);

      const challengerState = await buildPlayerStateFromLineup(adminDb, caller.uid, lineupSnap.data());
      const defenderUid = `joustur-solo-bot-${randomUUID()}`;
      const matchId = `jm-${randomUUID()}`;
      const match = {
        id: matchId,
        status: 'active',
        mode: 'solo',
        challengerUid: caller.uid,
        defenderUid,
        board: buildInitialBoardState(caller.uid),
        challengerState,
        defenderState: buildSoloBotPlayerState(challengerState, defenderUid),
        winnerUid: null,
        rewardsGranted: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      await adminDb.collection(MATCHES_COL).doc(matchId).set(match);
      res.status(201).json(match);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
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
        if (!seen.has(d.id)) {
          seen.add(d.id);
          const data = d.data();
          // Exclude matches that are still being initialised — player states
          // are not yet set and the UI cannot safely render them.
          if (data.status !== 'initializing') matches.push(data);
        }
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
      // A match still in 'initializing' has null player states. Returning it
      // would cause null-dereferences on the client; ask the caller to retry.
      if (match.status === 'initializing') {
        throw badRequest('Match is still being set up — please try again in a moment.', 409);
      }

      // P1-A: If a roll is already pending for this player, hydrate legalMoves
      // and canActivateSupport so a page reload doesn't lose that context.
      if (match.board.rollResult !== null && match.board.activePlayerUid === caller.uid) {
        const isChallenger = match.challengerUid === caller.uid;
        const activeState   = isChallenger ? match.challengerState : match.defenderState;
        const opponentState = isChallenger ? match.defenderState   : match.challengerState;
        match.legalMoves = getLegalMoves(match.board, activeState, opponentState);
        match.canActivateSupport = canActivateSupportEffect(
          activeState.support.supportEffect,
          activeState,
        );
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
  //
  // The entire read-validate-write cycle runs inside a Firestore transaction
  // to prevent duplicate rolls from concurrent requests (double-tap, two tabs).
  app.post('/api/joustur/match/:id/roll', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const matchId = String(req.params?.id ?? '').trim();
    try {
      const matchRef = adminDb.collection(MATCHES_COL).doc(matchId);
      // Pre-compute the roll-seed timestamp outside the transaction so the
      // deterministic seed is stable across any transaction retries.
      const timestamp = Date.now();

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(matchRef);
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
        const seed = generateRollSeed(matchId, match.board.turn, timestamp);
        const rng  = createSeededRng(seed);
        const roll = rollUsbShards(rng);

        // Compute legal moves for the client.
        const isChallenger = match.challengerUid === caller.uid;
        const activeState   = isChallenger ? match.challengerState : match.defenderState;
        const opponentState = isChallenger ? match.defenderState   : match.challengerState;
        const boardWithRoll = { ...match.board, rollResult: roll };
        const legalMoves = getLegalMoves(boardWithRoll, activeState, opponentState);

        tx.update(matchRef, {
          'board.rollResult': roll,
          updatedAt: nowIso(),
        });

        return { roll, legalMoves, canActivateSupport: canActivateSupportEffect(
          activeState.support.supportEffect,
          activeState,
        ) };
      });

      res.json(result);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });

  // ── POST /api/joustur/match/:id/move ────────────────────────────────────────
  // Step 2: submit the active player's chosen action.
  //
  // The entire read-validate-compute-write cycle runs inside a Firestore
  // transaction to prevent:
  //   • duplicate moves from concurrent requests (TOCTOU)
  //   • double reward grants if two concurrent winning moves both see
  //     rewardsGranted=false before either commits
  app.post('/api/joustur/match/:id/move', limiter, async (req, res) => {
    if (!adminDb) { res.status(503).json({ error: 'Joustur not configured.' }); return; }
    let caller;
    try { caller = await authenticateFirebaseUser(req); }
    catch (e) { res.status(e.statusCode ?? 500).json({ error: e.message }); return; }

    const matchId = String(req.params?.id ?? '').trim();
    try {
      const matchRef = adminDb.collection(MATCHES_COL).doc(matchId);

      // Parse the move choice from the request body before entering the transaction.
      const cardId              = req.body?.cardId ? String(req.body.cardId) : null;
      const activateSupport     = req.body?.activateSupport === true;
      const supportTargetCardId = req.body?.supportTargetCardId
        ? String(req.body.supportTargetCardId)
        : undefined;

      // High #4 — support activation must be the sole action for the turn.
      // Allowing both together would let overclock boost the roll and then
      // immediately move a rider with the inflated value.
      if (activateSupport && cardId) {
        throw badRequest('Support activation must be the sole action for the turn - do not combine with a rider move.', 422);
      }

      let responseData;

      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(matchRef);
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
        let newMatch = {
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
        const botTurnEntries = [];
        if (
          newMatch.mode === 'solo' &&
          newMatch.status === 'active' &&
          newMatch.board.activePlayerUid === newMatch.defenderUid
        ) {
          const soloResolution = resolveSoloBotTurns(newMatch, matchId, randomUUID);
          newMatch = soloResolution.match;
          botTurnEntries.push(...soloResolution.turnEntries);
          winner = newMatch.winnerUid;
        }

        // Persist turn log entry.
        const supportEffect = activateSupport ? activeState.support.supportEffect : undefined;
        const toPosition = cardId
          ? (newActive.riders.find((r) => r.cardId === cardId)?.position ?? 0)
          : 0;
        const turnEntry = buildTurnLogEntry({
          id: `turn-${randomUUID()}`,
          matchId,
          turn: preTurn,
          playerUid: caller.uid,
          rollResult: match.board.rollResult,
          movedCardId: cardId,
          fromPosition: preActiveFrom,
          toPosition,
          capturedCardId,
          extraTurn,
          supportActivated: activateSupport,
          supportEffect,
          timestamp: nowIso(),
        });
        tx.set(
          matchRef.collection(TURNS_SUBCOL).doc(turnEntry.id),
          turnEntry,
        );

        botTurnEntries.forEach(({ turnEntry: botTurnEntry }) => {
          tx.set(
            matchRef.collection(TURNS_SUBCOL).doc(botTurnEntry.id),
            botTurnEntry,
          );
        });

        // Grant rewards idempotently — check the in-transaction snapshot so
        // concurrent winning moves cannot both see rewardsGranted=false.
        if (newMatch.status === 'completed' && !match.rewardsGranted) {
          newMatch.rewardsGranted = true;
          applyMatchRewards(tx, adminDb, newMatch, FieldValue);
        }

        // Persist match (single write — includes rewardsGranted if applicable).
        tx.set(matchRef, newMatch);

        responseData = { match: newMatch, turnEntry, events, extraTurn, winner };
      });

      res.json(responseData);
    } catch (e) {
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  });
}
