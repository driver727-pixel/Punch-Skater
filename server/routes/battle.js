export function registerBattleRoutes(app, {
  adminDb,
  battleRateLimit,
  authenticateFirebaseUser,
  createBattleCardSnapshot,
  resolveBattleWithEffects,
  randomUUID,
  FieldValue,
}) {
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
}
