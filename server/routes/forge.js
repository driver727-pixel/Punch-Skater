import { claimFreeForge, getFreeForgeState } from '../lib/freeForge.js';
import { loadAdminLoanerCards } from '../lib/adminLoaners.js';
import {
  FORGE_CLASH_MAX_HEAT,
  FORGE_CLASH_MAX_HP,
  FORGE_CLASH_MAX_ROUNDS,
  FORGE_CLASH_RIVAL_ID,
  buildForgeClashRewards,
  createForgeClashMatch,
  getForgeClashTelegraph,
  resolveForgeClashRound,
} from '../lib/forgeClash.js';
import { createJoustCardSnapshot } from '../lib/joust.js';
import { applyMissionRivalRecord } from '../lib/missions.js';
import { getDistrictRival, getDistrictRivalProgressionAward } from '../lib/rivals.js';
import {
  computeCardCondition,
  createEmptyCombatHistory,
  evaluateEarnedTitles,
} from '../lib/cardTitles.js';
import { promoteCardClass } from '../lib/cardClassProgression.js';
import { creditWalletInTransaction } from '../lib/wallet.js';

const DEFAULT_COMPUTER_RIVALS_COUNT = 6;
const MAX_COMPUTER_RIVALS_COUNT = 12;
const FORGE_CLASH_MATCHES_COLLECTION = 'forgeClashMatches';
const PROFILE_COLLECTION = 'userProfiles';
const USERS_COLLECTION = 'users';

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

function parseClashRoster(rawRoster, callerUid) {
  if (!Array.isArray(rawRoster) || rawRoster.length !== 6) {
    throw badRequest('Choose exactly six Crew cards before starting Forge Clash.');
  }
  const roster = rawRoster.map((entry) => {
    const cardId = typeof entry?.cardId === 'string' ? entry.cardId.trim() : '';
    const ownerUid = typeof entry?.ownerUid === 'string' && entry.ownerUid.trim()
      ? entry.ownerUid.trim()
      : callerUid;
    if (!cardId || cardId.includes('/') || !ownerUid || ownerUid.includes('/')) {
      throw badRequest('Every Forge Clash Crew slot needs a valid card reference.');
    }
    return { cardId, ownerUid };
  });
  const dedupeKeys = new Set(roster.map((entry) => `${entry.ownerUid}:${entry.cardId}`));
  if (dedupeKeys.size !== roster.length) {
    throw badRequest('Forge Clash Crew cards must be unique.');
  }
  return roster;
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
}

function normalizeUnlockedFrames(value) {
  return Array.isArray(value)
    ? value.filter((entry) => (
      entry
      && typeof entry === 'object'
      && typeof entry.cardId === 'string'
      && typeof entry.frameId === 'string'
    ))
    : [];
}

function getForgeClashMvpSlot(match) {
  const totals = new Map();
  for (const round of match.rounds ?? []) {
    const current = totals.get(round.slotId) ?? 0;
    totals.set(round.slotId, current + round.rivalDamage + (round.correctRead ? 4 : 0));
  }
  return (match.roster ?? [])
    .filter((slot) => !slot.loaner)
    .sort((left, right) => (
      (totals.get(right.slotId) ?? 0) - (totals.get(left.slotId) ?? 0)
      || left.slotId.localeCompare(right.slotId)
    ))[0] ?? null;
}

function buildNextCombatHistory(card, result, rivalId) {
  const previous = {
    ...createEmptyCombatHistory(),
    ...(card?.combatHistory && typeof card.combatHistory === 'object' ? card.combatHistory : {}),
  };
  const isWin = result === 'win';
  const isLoss = result === 'loss';
  const currentStreak = isWin
    ? (previous.currentStreak > 0 ? previous.currentStreak : 0) + 1
    : isLoss
      ? (previous.currentStreak < 0 ? previous.currentStreak : 0) - 1
      : 0;
  return {
    ...previous,
    joustWins: previous.joustWins + (isWin ? 1 : 0),
    joustLosses: previous.joustLosses + (isLoss ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(previous.bestStreak, currentStreak),
    bossesDefeated: isWin
      ? [...new Set([...normalizeStringArray(previous.bossesDefeated), rivalId])]
      : normalizeStringArray(previous.bossesDefeated),
    totalBattles: previous.totalBattles + 1,
    ...(isLoss ? { lastDefeatedBy: rivalId } : {}),
  };
}

function toClientClash(match, latestRound = null) {
  const currentRivalTactic = match.status === 'playing'
    ? match.rivalPattern?.[match.turn - 1]
    : null;
  return {
    id: match.id,
    status: match.status,
    turn: match.turn,
    maxRounds: FORGE_CLASH_MAX_ROUNDS,
    maxHp: FORGE_CLASH_MAX_HP,
    maxHeat: FORGE_CLASH_MAX_HEAT,
    playerHp: match.playerHp,
    rivalHp: match.rivalHp,
    combo: match.combo,
    heat: match.heat,
    cooldowns: match.cooldowns ?? {},
    result: match.result ?? null,
    rival: match.rival,
    roster: match.roster,
    rounds: match.rounds ?? [],
    telegraph: currentRivalTactic ? getForgeClashTelegraph(currentRivalTactic) : null,
    latestRound,
    rewards: match.rewards ?? null,
    createdAt: match.createdAt,
    completedAt: match.completedAt ?? null,
    rematchOf: match.rematchOf ?? null,
  };
}

async function loadValidatedClashRoster(tx, adminDb, rosterRefs, callerUid) {
  const cardRefs = rosterRefs.map(({ ownerUid, cardId }) => (
    adminDb.collection(USERS_COLLECTION).doc(ownerUid).collection('cards').doc(cardId)
  ));
  const loanerOwnerUids = [...new Set(
    rosterRefs
      .filter(({ ownerUid }) => ownerUid !== callerUid)
      .map(({ ownerUid }) => ownerUid),
  )];
  const loanerProfileRefs = loanerOwnerUids.map((ownerUid) => (
    adminDb.collection(PROFILE_COLLECTION).doc(ownerUid)
  ));
  const [cardSnaps, loanerProfileSnaps] = await Promise.all([
    Promise.all(cardRefs.map((ref) => tx.get(ref))),
    Promise.all(loanerProfileRefs.map((ref) => tx.get(ref))),
  ]);
  const loanerProfiles = new Map(
    loanerOwnerUids.map((ownerUid, index) => [ownerUid, loanerProfileSnaps[index]]),
  );

  return rosterRefs.map(({ ownerUid, cardId }, index) => {
    const cardSnap = cardSnaps[index];
    if (!cardSnap.exists) {
      throw badRequest('One of those Crew cards is no longer available.');
    }
    const loaner = ownerUid !== callerUid;
    if (loaner && loanerProfiles.get(ownerUid)?.data()?.isAdmin !== true) {
      throw badRequest('Loaner cards must come from the official admin Crew.');
    }
    const card = cardSnap.data();
    const snapshot = createJoustCardSnapshot(card);
    return {
      slotId: loaner ? `loaner:${ownerUid}:${cardId}` : `owned:${cardId}`,
      cardId,
      ownerUid,
      loaner,
      name: snapshot.name,
      snapshot,
    };
  });
}

async function settleForgeClash(tx, adminDb, match, FieldValue) {
  const profileRef = adminDb.collection(PROFILE_COLLECTION).doc(match.uid);
  const mvpSlot = getForgeClashMvpSlot(match);
  const mvpCardRef = mvpSlot
    ? adminDb.collection(USERS_COLLECTION).doc(match.uid).collection('cards').doc(mvpSlot.cardId)
    : null;
  const [profileSnap, mvpCardSnap] = await Promise.all([
    tx.get(profileRef),
    mvpCardRef ? tx.get(mvpCardRef) : Promise.resolve(null),
  ]);
  const profile = profileSnap.exists ? profileSnap.data() : {};
  const defeatedRivalIds = normalizeStringArray(profile.defeatedRivalIds);
  const firstClear = match.result === 'win' && !defeatedRivalIds.includes(match.rivalId);
  const reward = buildForgeClashRewards(match.result, firstClear);
  const walletResult = await creditWalletInTransaction(tx, adminDb, {
    uid: match.uid,
    amount: reward.ozzies,
    sourceType: 'forge_clash',
    sourceId: match.id,
    description: `Forge Clash ${match.result} against ${match.rival.name}`,
    metadata: {
      rivalId: match.rivalId,
      result: match.result,
      rounds: match.rounds.length,
    },
    idempotencyKey: `forge-clash:${match.id}`,
    FieldValue,
  });
  const progressionAward = getDistrictRivalProgressionAward(match.rivalId, match.result);
  const currentCodexIds = normalizeStringArray(profile.codexUnlockIds);
  const nextCodexIds = progressionAward
    ? [...new Set([...currentCodexIds, ...progressionAward.codexEntryIds])]
    : currentCodexIds;
  const currentFrames = normalizeUnlockedFrames(profile.unlocked_frames);
  const frameAlreadyUnlocked = Boolean(
    reward.frameId
    && mvpSlot
    && currentFrames.some((entry) => entry.cardId === mvpSlot.cardId && entry.frameId === reward.frameId),
  );
  const nextFrames = reward.frameId && mvpSlot && !frameAlreadyUnlocked
    ? [
      ...currentFrames,
      {
        cardId: mvpSlot.cardId,
        frameId: reward.frameId,
        source: 'forge_clash_first_clear',
        matchId: match.id,
        unlockedAt: match.completedAt,
      },
    ]
    : currentFrames;
  const nextRivalRecords = applyMissionRivalRecord(
    match.rivalId,
    match.result,
    profile.rivalRecords,
    match.completedAt,
  );

  tx.set(profileRef, {
    missionXp: Math.max(0, Number(profile.missionXp) || 0) + reward.xp,
    missionOzzies: Math.max(0, Number(profile.missionOzzies) || 0) + reward.ozzies,
    battleParticipationCount: Math.max(0, Number(profile.battleParticipationCount) || 0) + 1,
    districtReputation: Math.max(0, Number(profile.districtReputation) || 0) + reward.districtReputation,
    defeatedRivalIds: progressionAward
      ? [...new Set([...defeatedRivalIds, match.rivalId])]
      : defeatedRivalIds,
    codexUnlockIds: nextCodexIds,
    rivalRecords: nextRivalRecords,
    unlocked_frames: nextFrames,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (mvpCardRef && mvpCardSnap?.exists) {
    const card = mvpCardSnap.data();
    const combatHistory = buildNextCombatHistory(card, match.result, match.rivalId);
    const earnedTitles = [...new Set([
      ...normalizeStringArray(card.earnedTitles),
      ...evaluateEarnedTitles(combatHistory),
    ])];
    const rewardedCard = promoteCardClass({
      ...card,
      xp: Math.min(100_000_000, Math.max(0, Number(card.xp) || 0) + reward.cardXp),
      ozzies: Math.max(0, Number(card.ozzies) || 0) + reward.cardOzzies,
      combatHistory,
      earnedTitles,
      cardCondition: computeCardCondition(combatHistory),
    });
    tx.set(mvpCardRef, rewardedCard);
  }

  return {
    ...reward,
    mvpCardId: mvpSlot?.cardId ?? null,
    mvpCardName: mvpSlot?.name ?? null,
    newCodexIds: progressionAward
      ? progressionAward.codexEntryIds.filter((id) => !currentCodexIds.includes(id))
      : [],
    frameId: reward.frameId && !frameAlreadyUnlocked ? reward.frameId : null,
    wallet: walletResult.wallet,
  };
}

export function registerForgeRoutes(app, {
  adminDb,
  forgeRateLimit,
  authenticateFirebaseUser,
  FieldValue,
  randomUUID,
}) {
  async function authenticateForgeRequest(req, res, next) {
    try {
      req.caller = await authenticateFirebaseUser(req);
      next();
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Authentication failed.' });
    }
  }

  app.get('/api/forge/computer-rivals', forgeRateLimit, authenticateForgeRequest, async (req, res) => {
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

  app.post('/api/forge/clash/start', forgeRateLimit, authenticateForgeRequest, async (req, res) => {
    if (!adminDb || typeof randomUUID !== 'function') {
      res.status(503).json({ error: 'Forge Clash is not configured on this server.' });
      return;
    }

    try {
      const caller = req.caller;
      const rosterRefs = parseClashRoster(req.body?.roster, caller.uid);
      const matchId = `forge-clash-${randomUUID()}`;
      const seed = randomUUID();
      const rematchOf = typeof req.body?.rematchOf === 'string'
        ? req.body.rematchOf.trim().slice(0, 160) || null
        : null;
      const matchRef = adminDb.collection(FORGE_CLASH_MATCHES_COLLECTION).doc(matchId);
      const rivalDefinition = getDistrictRival(FORGE_CLASH_RIVAL_ID);
      if (!rivalDefinition) {
        throw Object.assign(new Error('Jax Voltage is unavailable.'), { statusCode: 503 });
      }
      const now = new Date().toISOString();
      const match = await adminDb.runTransaction(async (tx) => {
        const roster = await loadValidatedClashRoster(tx, adminDb, rosterRefs, caller.uid);
        const rival = {
          ...rivalDefinition.signatureCard,
          id: rivalDefinition.id,
          tagline: rivalDefinition.tagline,
          signatureTrait: rivalDefinition.signatureTrait,
          dialogue: rivalDefinition.dialogue,
        };
        const createdMatch = createForgeClashMatch({
          id: matchId,
          uid: caller.uid,
          seed,
          roster,
          rival,
          now,
          rematchOf,
        });
        tx.set(matchRef, {
          ...createdMatch,
          _ts: FieldValue.serverTimestamp(),
        });
        return createdMatch;
      });

      res.status(201).json({ match: toClientClash(match) });
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to start Forge Clash.' });
    }
  });

  app.post('/api/forge/clash/play', forgeRateLimit, authenticateForgeRequest, async (req, res) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Forge Clash is not configured on this server.' });
      return;
    }

    const matchId = typeof req.body?.matchId === 'string' ? req.body.matchId.trim() : '';
    const slotId = typeof req.body?.slotId === 'string' ? req.body.slotId.trim() : '';
    const tactic = typeof req.body?.tactic === 'string' ? req.body.tactic.trim() : '';
    const clientTurn = Number(req.body?.turn);
    if (!matchId || matchId.includes('/') || !slotId || !tactic || !Number.isInteger(clientTurn)) {
      res.status(400).json({ error: 'matchId, slotId, tactic, and turn are required.' });
      return;
    }

    try {
      const caller = req.caller;
      const matchRef = adminDb.collection(FORGE_CLASH_MATCHES_COLLECTION).doc(matchId);
      const result = await adminDb.runTransaction(async (tx) => {
        const matchSnap = await tx.get(matchRef);
        if (!matchSnap.exists) {
          throw Object.assign(new Error('Forge Clash match not found.'), { statusCode: 404 });
        }
        const storedMatch = matchSnap.data();
        if (storedMatch.uid !== caller.uid) {
          throw Object.assign(new Error('That Forge Clash belongs to another Crew.'), { statusCode: 403 });
        }
        if (storedMatch.status === 'completed') {
          return {
            duplicate: true,
            match: storedMatch,
            round: storedMatch.rounds?.at(-1) ?? null,
          };
        }
        if (storedMatch.turn !== clientTurn) {
          throw Object.assign(new Error('That turn has already moved on. Refresh the clash state.'), { statusCode: 409 });
        }

        const resolved = resolveForgeClashRound(storedMatch, {
          slotId,
          tactic,
          finisher: req.body?.finisher === true,
        });
        let nextMatch = resolved.match;
        if (nextMatch.status === 'completed') {
          const rewards = await settleForgeClash(tx, adminDb, nextMatch, FieldValue);
          const startedAt = Date.parse(nextMatch.createdAt);
          const completedAt = Date.parse(nextMatch.completedAt);
          nextMatch = {
            ...nextMatch,
            rewards,
            durationMs: Number.isFinite(startedAt) && Number.isFinite(completedAt)
              ? Math.max(0, completedAt - startedAt)
              : null,
          };
        }
        tx.set(matchRef, {
          ...nextMatch,
          _ts: FieldValue.serverTimestamp(),
        });
        return {
          duplicate: false,
          match: nextMatch,
          round: resolved.round,
        };
      });

      res.status(result.duplicate ? 200 : 201).json({
        duplicate: result.duplicate,
        match: toClientClash(result.match, result.round),
      });
    } catch (error) {
      res.status(error.statusCode ?? 500).json({ error: error.message ?? 'Failed to resolve Forge Clash turn.' });
    }
  });
}
