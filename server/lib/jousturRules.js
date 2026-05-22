/**
 * jousturRules.js — Pure, deterministic rules engine for Joustur Skatur.
 *
 * This module has NO I/O or side-effects.  Every function is a pure
 * transformation of data, making it trivially testable.
 *
 * Board layout (tile-path based):
 *   Each player traverses their own ordered path of 14 tiles.
 *   A rider's "position" is their 1-based index along the path (1–14).
 *   0 = off-board (not yet entered / captured), 15 = exited / scored.
 *
 *   Player 1 (challenger) path tiles: 4, 3, 2, 1, 7, 8, 9, 10, 11, 12, 13, 14, 6, 5
 *   Player 2 (defender) path tiles:   18, 17, 16, 15, 7, 8, 9, 10, 11, 12, 13, 14, 20, 19
 *
 *   Shared tiles: 7–14 (path indices 5–12 for both players)
 *   Private tiles: indices 1–4 (entry) and 13–14 (exit)
 *
 * Stealth Alcoves (by path index): 4, 6, 8, 12, 14
 *   – Shared-zone alcoves (6, 8, 12): safe from capture + extra turn
 *   – Private alcoves (4, 14): extra turn only (already uncapturable)
 */

// ── Board constants ───────────────────────────────────────────────────────────

export const OFF_BOARD = 0;
export const EXIT_POSITION = 15;
export const PRIVATE_ENTRY_MIN = 1;
export const PRIVATE_ENTRY_MAX = 4;
export const SHARED_MIN = 5;
export const SHARED_MAX = 12;
export const PRIVATE_EXIT_MIN = 13;
export const PRIVATE_EXIT_MAX = 14;
export const STEALTH_ALCOVES = Object.freeze(new Set([4, 6, 8, 12, 14]));
export const RIDER_COUNT = 6;
export const SHARD_COUNT = 3; // tetrahedral binary dice per roll
const RIDER_NUMBER_OFFSET = 1;
export const JOUST_CLASH_STANCES = Object.freeze(['charge', 'guard', 'feint']);

/**
 * Ordered tile paths for each player side.
 * Index 0 = path position 1, Index 13 = path position 14.
 * Player 1 starts at tile 4 (path index 1), exits after tile 5 (path index 14).
 * Player 2 starts at tile 18 (path index 1), exits after tile 19 (path index 14).
 */
export const PLAYER1_PATH = Object.freeze([4, 3, 2, 1, 7, 8, 9, 10, 11, 12, 13, 14, 6, 5]);
export const PLAYER2_PATH = Object.freeze([18, 17, 16, 15, 7, 8, 9, 10, 11, 12, 13, 14, 20, 19]);

/** Set of shared tile numbers — captures only possible on these tiles. */
export const SHARED_TILES = Object.freeze(new Set([7, 8, 9, 10, 11, 12, 13, 14]));

/**
 * Get the tile number for a given path index and player path.
 * @param {number} pathIndex  1-based path index (1–14).
 * @param {number[]} path     PLAYER1_PATH or PLAYER2_PATH.
 * @returns {number|null}     Tile number, or null if out of range.
 */
export function getTileAtIndex(pathIndex, path) {
  if (pathIndex < 1 || pathIndex > 14) return null;
  return path[pathIndex - 1];
}

// ── Board utilities ───────────────────────────────────────────────────────────

export function isOnBoard(position) {
  return position >= PRIVATE_ENTRY_MIN && position <= PRIVATE_EXIT_MAX;
}

/** Check if a path index is in the shared zone (indices 5–12). */
export function isSharedPosition(position) {
  return position >= SHARED_MIN && position <= SHARED_MAX;
}

export function isPrivatePosition(position) {
  return isOnBoard(position) && !isSharedPosition(position);
}

/** Check if a path index is a Stealth Alcove (indices 4, 6, 8, 12, 14). */
export function isStealthAlcove(position) {
  return STEALTH_ALCOVES.has(position);
}

export function getPreferredClashStance(trait) {
  switch (trait) {
    case 'guard':
    case 'anchor':
      return 'guard';
    case 'feint':
    case 'slip':
    case 'echo':
      return 'feint';
    case 'boost':
    case 'strike':
    case 'surge':
    default:
      return 'charge';
  }
}

export function getTraitClashBonus(trait, stance) {
  return getPreferredClashStance(trait) === stance ? 1 : 0;
}

function compareStances(attackerStance, defenderStance) {
  if (attackerStance === defenderStance) return 0;
  if (
    (attackerStance === 'charge' && defenderStance === 'feint') ||
    (attackerStance === 'feint' && defenderStance === 'guard') ||
    (attackerStance === 'guard' && defenderStance === 'charge')
  ) {
    return 1;
  }
  return -1;
}

export function resolveClashOutcome({
  attackerTrait,
  defenderTrait,
  attackerStance,
  defenderStance,
}) {
  const attackerTraitBonus = getTraitClashBonus(attackerTrait, attackerStance);
  const defenderTraitBonus = getTraitClashBonus(defenderTrait, defenderStance);
  const stanceResult = compareStances(attackerStance, defenderStance);
  const attackerScore = (stanceResult === 1 ? 1 : 0) + attackerTraitBonus;
  const defenderScore = (stanceResult === -1 ? 1 : 0) + defenderTraitBonus;
  const winner = attackerScore > defenderScore ? 'attacker' : 'defender';

  return {
    winner,
    attackerScore,
    defenderScore,
    attackerTraitBonus,
    defenderTraitBonus,
    attackerPreferredStance: getPreferredClashStance(attackerTrait),
    defenderPreferredStance: getPreferredClashStance(defenderTrait),
  };
}

// ── Faction / trait / support mappings ───────────────────────────────────────

/**
 * Maps existing Punch Skater crew strings to Joustur factions.
 * All crews not listed here fall back to 'rustKids'.
 */
const CREW_TO_FACTION = Object.freeze({
  'Punch Skaters':   'rustKids',
  'Ne0n Legion':     'neonSaints',
  'Qu111s (Quills)': 'signalGhosts',
  'The Team':        'chromeSyndicate',
  'Iron Curtains':   'voltageVultures',
  'The Asclepians':  'alleyWraiths',
});

export function resolveFactionForCrew(crew) {
  return CREW_TO_FACTION[crew] ?? 'rustKids';
}

export const FACTION_PASSIVE = Object.freeze({
  rustKids:        'patchworkRush',
  neonSaints:      'crowdHalo',
  signalGhosts:    'ghostRoute',
  chromeSyndicate: 'precisionCast',
  voltageVultures: 'surgeTrigger',
  alleyWraiths:    'cutline',
});

export const FACTION_SUPPORT_EFFECT = Object.freeze({
  rustKids:        'recoveryPing',
  neonSaints:      'crowdRoar',
  signalGhosts:    'smokeScreen',
  chromeSyndicate: 'reroll',
  voltageVultures: 'overclock',
  alleyWraiths:    'sideRoute',
});

// ── Rider trait lookup ────────────────────────────────────────────────────────

const TRAIT_EXACT_MAP = Object.freeze({
  // boost
  'Boost Charge': 'boost', 'Turbo Kick': 'boost', 'Velocity Burst': 'boost',
  'Quickstart': 'boost', 'Street Sprint': 'boost', 'Rail Runner': 'boost',
  'Neon Dash': 'boost', 'Accelerant': 'boost', 'Fast Line': 'boost',
  'Voltage Step': 'boost',
  // guard
  'Street Parry': 'guard', 'Riot Shield': 'guard', 'Magnetic Guard': 'guard',
  'Deflect Plating': 'guard', 'Shock Guard': 'guard', 'Mirror Shield': 'guard',
  'Brace': 'guard', 'Guard Stance': 'guard', 'Street Armor': 'guard',
  'Shell Frame': 'guard',
  // feint
  'Trick Strike': 'feint', 'Phantom Step': 'feint', 'Ghost Pivot': 'feint',
  'Fakeout': 'feint', 'Sidecut': 'feint', 'Juke Line': 'feint',
  'Flicker Move': 'feint', 'Heel Feint': 'feint', 'Drift Fake': 'feint',
  'Switchback': 'feint',
  // anchor
  'Lock Axle': 'anchor', 'Stand Firm': 'anchor', 'Dead Stop': 'anchor',
  'Pin Lock': 'anchor', 'Grip Plate': 'anchor', 'Holdfast': 'anchor',
  'Static Grip': 'anchor', 'Deep Set': 'anchor', 'Iron Stance': 'anchor',
  // strike
  'Heavy Lance': 'strike', 'Lance Drive': 'strike', 'Road Spear': 'strike',
  'Impact Rig': 'strike', 'Shock Ram': 'strike', 'Collision King': 'strike',
  'Bash Circuit': 'strike', 'Breakpoint': 'strike', 'Ram Plate': 'strike',
  'Piercing Run': 'strike',
  // slip
  'Silent Run': 'slip', 'Backdoor Route': 'slip', 'Ghostline': 'slip',
  'Signal Veil': 'slip', 'Static Blur': 'slip', 'Alley Fade': 'slip',
  'Vanish Tag': 'slip', 'Smokeslip': 'slip', 'Veil Circuit': 'slip',
  'Night Ride': 'slip',
  // surge
  'Overcharge': 'surge', 'Overvolt': 'surge', 'Battery Spike': 'surge',
  'High Amp': 'surge', 'Full Send': 'surge', 'Redline': 'surge',
  'Storm Coil': 'surge', 'Amp Burst': 'surge', 'Power Flood': 'surge',
  'Max Charge': 'surge',
  // echo
  'Neon Flourish': 'echo', 'Crowd Spark': 'echo', 'Halo Trail': 'echo',
  'Victory Noise': 'echo', 'Show Glow': 'echo', 'Hype Signal': 'echo',
  'Flash Mark': 'echo', 'Street Aura': 'echo', 'Glory Burn': 'echo',
  'Style Pulse': 'echo',
});

/** Ordered keyword rules — first match wins. */
const KEYWORD_RULES = Object.freeze([
  { keywords: ['guard', 'shield', 'parry', 'armor'], trait: 'guard'  },
  { keywords: ['lance', 'ram', 'impact', 'pierce'],  trait: 'strike' },
  { keywords: ['charge', 'volt', 'amp', 'redline'],  trait: 'surge'  },
  { keywords: ['feint', 'fake', 'pivot', 'juke'],    trait: 'feint'  },
  { keywords: ['boost', 'dash', 'quick', 'sprint'],  trait: 'boost'  },
  { keywords: ['ghost', 'veil', 'fade', 'silent'],   trait: 'slip'   },
  { keywords: ['anchor', 'firm', 'grip', 'lock'],    trait: 'anchor' },
  { keywords: ['style', 'crowd', 'glory', 'flourish'], trait: 'echo' },
]);

/**
 * Resolve a Joustur trait from a rider's joust.traits array.
 * Strategy: exact-name lookup → keyword fallback → default 'boost'.
 *
 * @param {string[]} traitNames  Card's joust.traits array.
 * @returns {string}
 */
export function resolveRiderTrait(traitNames) {
  if (!Array.isArray(traitNames)) return 'boost';
  for (const name of traitNames) {
    if (typeof name !== 'string' || !name) continue;
    const exact = TRAIT_EXACT_MAP[name];
    if (exact) return exact;
    const lower = name.toLowerCase();
    for (const { keywords, trait } of KEYWORD_RULES) {
      if (keywords.some((kw) => lower.includes(kw))) return trait;
    }
  }
  return 'boost';
}

// ── Seeded PRNG & Tetrahedral Dice roll ───────────────────────────────────────

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 1;
}

function mulberry32(seed) {
  let s = seed | 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a deterministic seeded RNG.
 * @param {string|number} seed
 */
export function createSeededRng(seed) {
  const rng = mulberry32(fnv1a32(String(seed ?? 'joustur-default')));
  return {
    next() { return rng(); },
    range(min, max) { return Math.floor(rng() * (max - min + 1)) + min; },
  };
}

/**
 * Canonical seed string for a given turn's roll.
 */
export function generateRollSeed(matchId, turn, timestamp) {
  return `${matchId}::turn:${turn}::ts:${timestamp}`;
}

/**
 * Roll SHARD_COUNT tetrahedral binary dice.
 * Each die has 2 marked corners and 2 unmarked corners — 50% chance of 1.
 * Returns an object: { total, dice } where dice is an array of individual results (0 or 1).
 * @param {{ range: (min: number, max: number) => number }} rng
 */
export function rollUsbShards(rng) {
  const dice = [];
  let total = 0;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const d = rng.range(0, 1);
    dice.push(d);
    total += d;
  }
  return { total, dice };
}

// ── Lineup validation ─────────────────────────────────────────────────────────

/**
 * Validate a proposed lineup.
 * @param {string[]} riderCardIds  Must be exactly RIDER_COUNT unique strings.
 * @param {string}   supportCardId Must not appear in riderCardIds.
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function validateLineup(riderCardIds, supportCardId) {
  if (!Array.isArray(riderCardIds) || riderCardIds.length !== RIDER_COUNT) {
    return { valid: false, reason: `Lineup requires exactly ${RIDER_COUNT} rider cards.` };
  }
  if (typeof supportCardId !== 'string' || !supportCardId.trim()) {
    return { valid: false, reason: 'Lineup requires exactly 1 support card.' };
  }
  if (riderCardIds.some((id) => typeof id !== 'string' || !id.trim())) {
    return { valid: false, reason: 'All rider card IDs must be non-empty strings.' };
  }
  const all = [...riderCardIds, supportCardId];
  if (new Set(all).size < all.length) {
    return { valid: false, reason: 'Lineup cannot contain duplicate card IDs (support cannot duplicate a rider).' };
  }
  return { valid: true, reason: null };
}

// ── State builders ────────────────────────────────────────────────────────────

function buildRiderRuntime(snapshot) {
  return { cardId: snapshot.cardId, position: OFF_BOARD, isScored: false, isCaptured: false };
}

/**
 * Build the initial player state for a match participant.
 * @param {string} uid
 * @param {object[]} lineup  Array of JousturRiderSnapshot objects.
 * @param {object}  support  JousturSupportSnapshot.
 * @param {string}  faction  Resolved JousturFaction key.
 * @param {number[]} playerPath  PLAYER1_PATH or PLAYER2_PATH.
 *   Defaults to PLAYER1_PATH — callers MUST pass PLAYER2_PATH for the defender.
 */
export function buildInitialPlayerState(uid, lineup, support, faction, playerPath = PLAYER1_PATH) {
  return {
    uid,
    faction,
    factionPassive: FACTION_PASSIVE[faction] ?? FACTION_PASSIVE.rustKids,
    lineup,
    support,
    riders: lineup.map(buildRiderRuntime),
    supportRuntime: { activated: false },
    scoredCount: 0,
    playerPath,
  };
}

/**
 * Build the initial board state.  Challenger always goes first.
 * @param {string} challengerUid
 */
export function buildInitialBoardState(challengerUid) {
  return {
    turn: 1,
    activePlayerUid: challengerUid,
    rollResult: null,
    diceResults: null,
    lastRollResult: null,
    lastDiceResults: null,
    lastRollPlayerUid: null,
    smokeScreenUid: null,
    smokeScreenExpiresAfterTurn: null,
    clash: null,
  };
}

// ── Legal move generation ─────────────────────────────────────────────────────

/**
 * Compute all legal moves for the active player given the current roll.
 *
 * Returns an empty array when roll is 0 (player must pass) or when no
 * rider can legally move.
 *
 * Captures are determined by tile occupancy: two riders from opposing paths
 * can only collide when they occupy the same shared tile (tiles 7–14).
 *
 * @param {object} boardState
 * @param {object} activePlayer   JousturPlayerState
 * @param {object} opponentPlayer JousturPlayerState
 * @returns {Array<{cardId,fromPosition,toPosition,isExitMove,wouldCapture,capturedCardId}>}
 */
export function getLegalMoves(boardState, activePlayer, opponentPlayer) {
  const { rollResult } = boardState;
  if (typeof rollResult !== 'number') return [];

  // A roll of 0 means the player moves 4 tiles (tetrahedral dice special rule).
  const effectiveRoll = rollResult === 0 ? 4 : rollResult;

  const opponentProtected = boardState.smokeScreenUid === opponentPlayer.uid;
  const activePath = activePlayer.playerPath || PLAYER1_PATH;
  const opponentPath = opponentPlayer.playerPath || PLAYER2_PATH;
  const moves = [];

  for (const rider of activePlayer.riders) {
    if (rider.isScored) continue;

    const fromPos = rider.position;
    const toPos = fromPos + effectiveRoll;

    // Overshooting the exit is not allowed (exact exit required).
    if (toPos > EXIT_POSITION) continue;

    const isExitMove = toPos === EXIT_POSITION;

    if (isExitMove) {
      moves.push({
        cardId: rider.cardId,
        fromPosition: fromPos,
        toPosition: toPos,
        isExitMove: true,
        wouldCapture: false,
        capturedCardId: null,
      });
      continue;
    }

    // Friendly blockade — cannot land on a space occupied by own rider.
    const blockedByOwn = activePlayer.riders.some(
      (r) => !r.isScored && r.cardId !== rider.cardId && r.position === toPos,
    );
    if (blockedByOwn) continue;

    // Captures — only valid in the shared lane (path indices 5–12).
    // Captures are based on matching TILE numbers, not path indices.
    let capturedCardId = null;
    let wouldCapture = false;

    if (isSharedPosition(toPos)) {
      const activeTile = getTileAtIndex(toPos, activePath);
      const target = opponentPlayer.riders.find((r) => {
        if (r.isScored || !isSharedPosition(r.position)) return false;
        const oppTile = getTileAtIndex(r.position, opponentPath);
        return oppTile === activeTile;
      });
      if (target) {
        // Cannot capture on a Stealth Alcove or when opponent has smoke screen.
        if (isStealthAlcove(toPos) || opponentProtected) continue;
        capturedCardId = target.cardId;
        wouldCapture = true;
      }
    }

    moves.push({
      cardId: rider.cardId,
      fromPosition: fromPos,
      toPosition: toPos,
      isExitMove: false,
      wouldCapture,
      capturedCardId,
    });
  }

  return moves;
}

// ── Support activation legality ───────────────────────────────────────────────

/**
 * Check whether a support effect can currently be activated by the active
 * player.  This is a pure, side-effect-free helper.
 *
 * @param {string} effect        JousturSupportEffect key.
 * @param {object} activePlayer  JousturPlayerState (with runtime riders).
 * @returns {{ canActivate: boolean, reason: string|null }}
 */
export function canActivateSupportEffect(effect, activePlayer) {
  // Already used — covers every effect type.
  if (activePlayer.supportRuntime.activated) {
    return { canActivate: false, reason: 'Support has already been used in this match.' };
  }

  switch (effect) {
    case 'recoveryPing': {
      const hasCaptured = activePlayer.riders.some(
        (r) => r.position === OFF_BOARD && r.isCaptured && !r.isScored,
      );
      if (!hasCaptured) {
        return { canActivate: false, reason: 'recoveryPing requires at least one captured rider.' };
      }
      break;
    }
    case 'sideRoute': {
      const hasEntryRider = activePlayer.riders.some(
        (r) => r.position >= PRIVATE_ENTRY_MIN && r.position <= PRIVATE_ENTRY_MAX,
      );
      if (!hasEntryRider) {
        return { canActivate: false, reason: 'sideRoute requires at least one rider in the entry zone (positions 1–4).' };
      }
      break;
    }
    default:
      break;
  }

  return { canActivate: true, reason: null };
}

function compareMovePriority(a, b) {
  const scoreA = [
    a.isExitMove ? 1 : 0,
    a.wouldCapture ? 1 : 0,
    isStealthAlcove(a.toPosition) ? 1 : 0,
    a.toPosition,
    a.fromPosition,
  ];
  const scoreB = [
    b.isExitMove ? 1 : 0,
    b.wouldCapture ? 1 : 0,
    isStealthAlcove(b.toPosition) ? 1 : 0,
    b.toPosition,
    b.fromPosition,
  ];
  for (let i = 0; i < scoreA.length; i++) {
    if (scoreA[i] !== scoreB[i]) return scoreB[i] - scoreA[i];
  }
  return String(a.cardId).localeCompare(String(b.cardId));
}

function chooseSideRouteTarget(activePlayer) {
  const entryRiders = activePlayer.riders
    .filter(
      (r) =>
        !r.isScored &&
        r.position >= PRIVATE_ENTRY_MIN &&
        r.position <= PRIVATE_ENTRY_MAX,
    )
    .sort((a, b) => {
      if (a.position !== b.position) return b.position - a.position;
      return String(a.cardId).localeCompare(String(b.cardId));
    });
  return entryRiders[0] ?? null;
}

/**
 * Deterministically choose an automated move for a solo bot turn.
 *
 * Strategy:
 *   1. Prefer exits, then captures, then stealth alcoves, then forward progress.
 *   2. Use support when there are no legal moves / a zero roll.
 *   3. For sideRoute, spend support early when no high-impact move exists.
 *
 * @param {object} boardState
 * @param {object} activePlayer
 * @param {object} opponentPlayer
 * @returns {{ cardId: string|null, activateSupport: boolean, supportTargetCardId?: string }}
 */
export function chooseAutomatedMove(boardState, activePlayer, opponentPlayer) {
  const legalMoves = getLegalMoves(boardState, activePlayer, opponentPlayer)
    .sort(compareMovePriority);
  const bestMove = legalMoves[0] ?? null;
  const supportStatus = canActivateSupportEffect(
    activePlayer.support.supportEffect,
    activePlayer,
  );
  const sideRouteTarget = chooseSideRouteTarget(activePlayer);
  const hasHighImpactMove = Boolean(
    bestMove &&
      (bestMove.isExitMove ||
        bestMove.wouldCapture ||
        isStealthAlcove(bestMove.toPosition)),
  );

  if (supportStatus.canActivate) {
    if (
      activePlayer.support.supportEffect === 'sideRoute' &&
      sideRouteTarget &&
      !hasHighImpactMove
    ) {
      return {
        cardId: null,
        activateSupport: true,
        supportTargetCardId: sideRouteTarget.cardId,
      };
    }
    if (legalMoves.length === 0) {
      return {
        cardId: null,
        activateSupport: true,
        ...(sideRouteTarget ? { supportTargetCardId: sideRouteTarget.cardId } : {}),
      };
    }
  }

  if (bestMove) {
    return { cardId: bestMove.cardId, activateSupport: false };
  }

  return { cardId: null, activateSupport: false };
}

function getLineupSnapshot(playerState, cardId) {
  return playerState.lineup.find((snapshot) => snapshot.cardId === cardId) ?? null;
}

export function chooseAutomatedClashStance(clash, playerState, opponentPlayer) {
  const isAttacker = clash.attackerUid === playerState.uid;
  const myCardId = isAttacker ? clash.attackerCardId : clash.defenderCardId;
  const opponentCardId = isAttacker ? clash.defenderCardId : clash.attackerCardId;
  const myTrait = getLineupSnapshot(playerState, myCardId)?.jousturTrait ?? 'boost';
  const opponentTrait = getLineupSnapshot(opponentPlayer, opponentCardId)?.jousturTrait ?? 'boost';
  const preferred = getPreferredClashStance(myTrait);
  const opponentPreferred = getPreferredClashStance(opponentTrait);
  const orderedStances = [preferred, ...JOUST_CLASH_STANCES.filter((stance) => stance !== preferred)];
  const scored = orderedStances.map((stance) => {
    const outcome = isAttacker
      ? resolveClashOutcome({
          attackerTrait: myTrait,
          defenderTrait: opponentTrait,
          attackerStance: stance,
          defenderStance: opponentPreferred,
        })
      : resolveClashOutcome({
          attackerTrait: opponentTrait,
          defenderTrait: myTrait,
          attackerStance: opponentPreferred,
          defenderStance: stance,
        });
    const myScore = isAttacker ? outcome.attackerScore : outcome.defenderScore;
    const oppScore = isAttacker ? outcome.defenderScore : outcome.attackerScore;
    return { stance, myScore, oppScore };
  });

  scored.sort((a, b) => {
    if (a.myScore !== b.myScore) return b.myScore - a.myScore;
    if (a.oppScore !== b.oppScore) return a.oppScore - b.oppScore;
    if (a.stance === preferred) return -1;
    if (b.stance === preferred) return 1;
    return JOUST_CLASH_STANCES.indexOf(a.stance) - JOUST_CLASH_STANCES.indexOf(b.stance);
  });

  return scored[0]?.stance ?? preferred;
}

/**
 * Clone a player state into a solo-bot mirror with unique card IDs.
 *
 * @param {object} playerState
 * @param {string} botUid
 * @returns {object}
 */
export function buildSoloBotPlayerState(playerState, botUid) {
  const clone = JSON.parse(JSON.stringify(playerState));
  const cardIdMap = new Map();
  const uidPrefix = String(botUid ?? 'joustur-solo-bot');

  clone.uid = uidPrefix;
  // Bot always takes the Player 2 (defender) path.
  clone.playerPath = PLAYER2_PATH;
  clone.lineup = clone.lineup.map((snapshot, index) => {
    const riderNumber = index + RIDER_NUMBER_OFFSET;
    const nextCardId = `${uidPrefix}-rider-${riderNumber}-${snapshot.cardId}`;
    cardIdMap.set(snapshot.cardId, nextCardId);
    return {
      ...snapshot,
      cardId: nextCardId,
      name: snapshot.name ? `Echo ${snapshot.name}` : `Echo Rider ${riderNumber}`,
    };
  });
  clone.riders = clone.riders.map((rider) => ({
    ...rider,
    cardId: cardIdMap.get(rider.cardId) ?? `${uidPrefix}-${rider.cardId}`,
  }));
  clone.support = {
    ...clone.support,
    cardId: `${uidPrefix}-support-${clone.support.cardId}`,
    name: clone.support.name ? `Echo ${clone.support.name}` : 'Echo Support',
  };

  return clone;
}

// ── Move application ──────────────────────────────────────────────────────────

/**
 * Apply a player's chosen action and return the resulting state.
 *
 * This function is pure — it deep-clones its inputs and never mutates them.
 *
 * @param {object} boardState
 * @param {object} activePlayer   JousturPlayerState
 * @param {object} opponentPlayer JousturPlayerState
 * @param {{ cardId: string|null, activateSupport: boolean, supportTargetCardId?: string }} moveChoice
 * @returns {{ board, active, opponent, extraTurn: boolean, capturedCardId: string|null, events: object[] }}
 */
export function applyMove(boardState, activePlayer, opponentPlayer, moveChoice) {
  const newBoard = JSON.parse(JSON.stringify(boardState));
  const newActive = JSON.parse(JSON.stringify(activePlayer));
  const newOpp = JSON.parse(JSON.stringify(opponentPlayer));
  const events = [];
  let extraTurn = false;
  let capturedCardId = null;
  const finishRiderMove = (rider, toPos) => {
    rider.position = toPos;
    if (toPos === EXIT_POSITION) {
      rider.isScored = true;
      newActive.scoredCount = newActive.riders.filter((r) => r.isScored).length;
      events.push({ type: 'exit', cardId: rider.cardId });
    } else if (isStealthAlcove(toPos)) {
      extraTurn = true;
      events.push({ type: 'stealthAlcove', cardId: rider.cardId, position: toPos });
    }
  };

  // ── Support activation ────────────────────────────────────────────────────
  if (moveChoice.activateSupport && !newActive.supportRuntime.activated) {
    const effect = newActive.support.supportEffect;
    const { canActivate, reason } = canActivateSupportEffect(effect, newActive);

    if (!canActivate) {
      // Precondition not met — emit a no-op event and do not mark as activated.
      events.push({ type: 'supportBlocked', effect, reason });
    } else {
      newActive.supportRuntime = { activated: true, activatedOnTurn: newBoard.turn };

      switch (effect) {
        case 'recoveryPing': {
          // Move the first captured (isCaptured=true, position=0) rider back
          // to entry.  Riders that simply haven't entered yet are not eligible.
          const captured = newActive.riders.find(
            (r) => r.position === OFF_BOARD && r.isCaptured && !r.isScored,
          );
          if (captured) {
            captured.position = PRIVATE_ENTRY_MIN;
            captured.isCaptured = false;
            events.push({ type: 'recoveryPing', cardId: captured.cardId });
          }
          break;
        }
        case 'crowdRoar':
          extraTurn = true;
          events.push({ type: 'crowdRoar' });
          break;

        case 'smokeScreen':
          newBoard.smokeScreenUid = newActive.uid;
          newBoard.smokeScreenExpiresAfterTurn = newBoard.turn + 1;
          events.push({ type: 'smokeScreen', uid: newActive.uid });
          break;

        case 'reroll':
          // Regenerate roll on the next step; grant an extra turn so the same
          // player rolls and moves again.
          extraTurn = true;
          newBoard.rollResult = null; // forces a fresh /roll call
          newBoard.diceResults = null;
          events.push({ type: 'reroll' });
          break;

        case 'overclock': {
          // +1 to current roll (can exceed 4); extra turn to use it.
          const boosted = (newBoard.rollResult ?? 0) + 1;
          newBoard.rollResult = boosted;
          extraTurn = true;
          events.push({ type: 'overclock', newRoll: boosted });
          break;
        }

        case 'sideRoute': {
          // Teleport a rider from private entry to the start of private exit.
          const targetRider = moveChoice.supportTargetCardId
            ? newActive.riders.find((r) => r.cardId === moveChoice.supportTargetCardId)
            : newActive.riders.find(
                (r) =>
                  r.position >= PRIVATE_ENTRY_MIN &&
                  r.position <= PRIVATE_ENTRY_MAX,
              );
          if (targetRider) {
            targetRider.position = PRIVATE_EXIT_MIN;
            events.push({ type: 'sideRoute', cardId: targetRider.cardId });
          }
          break;
        }

        default:
          break;
      }
    }
  }

  // ── Rider move ────────────────────────────────────────────────────────────
  if (moveChoice.cardId) {
    const rider = newActive.riders.find((r) => r.cardId === moveChoice.cardId);
    if (rider && !rider.isScored) {
      const fromPos = rider.position;
      const rawRoll = newBoard.rollResult ?? 0;
      const effectiveRoll = rawRoll === 0 ? 4 : rawRoll;
      const toPos = fromPos + effectiveRoll;

      // Friendly blockade — mirrors the getLegalMoves check so applyMove
      // is safe when called directly (e.g., replay engine, future modes).
      const blockedByOwn = newActive.riders.some(
        (r) => !r.isScored && r.cardId !== rider.cardId && r.position === toPos,
      );

      if (!blockedByOwn) {
        // Capture check (shared lane only).
        // Guards match getLegalMoves: stealth-alcove riders and smoke-screened
        // opponents are immune to capture even if applyMove is called without
        // prior getLegalMoves validation.
        // Captures are based on matching TILE numbers across paths.
        if (isSharedPosition(toPos)) {
          const activePath = newActive.playerPath || PLAYER1_PATH;
          const opponentPath = newOpp.playerPath || PLAYER2_PATH;
          const activeTile = getTileAtIndex(toPos, activePath);
          const oppRider = newOpp.riders.find((r) => {
            if (r.isScored || !isSharedPosition(r.position)) return false;
            const oppTile = getTileAtIndex(r.position, opponentPath);
            return oppTile === activeTile;
          });
          const opponentProtected = newBoard.smokeScreenUid === newOpp.uid;
          const blockedByOpponent = oppRider && (isStealthAlcove(toPos) || opponentProtected);
          if (oppRider && !blockedByOpponent) {
            finishRiderMove(rider, toPos);
            newBoard.clash = {
              attackerUid: newActive.uid,
              defenderUid: newOpp.uid,
              attackerCardId: rider.cardId,
              defenderCardId: oppRider.cardId,
              tile: activeTile,
              attackerChoice: null,
              defenderChoice: null,
              attackerChoiceLocked: false,
              defenderChoiceLocked: false,
              startedOnTurn: newBoard.turn,
            };
            events.push({
              type: 'clashStarted',
              attackerUid: newActive.uid,
              defenderUid: newOpp.uid,
              attackerCardId: rider.cardId,
              defenderCardId: oppRider.cardId,
              tile: activeTile,
            });
          } else if (!blockedByOpponent) {
            finishRiderMove(rider, toPos);
          }
        } else {
          finishRiderMove(rider, toPos);
        }
      }
    }
  }

  // ── Expire smoke screen ───────────────────────────────────────────────────
  if (
    newBoard.smokeScreenExpiresAfterTurn !== null &&
    newBoard.turn >= newBoard.smokeScreenExpiresAfterTurn
  ) {
    newBoard.smokeScreenUid = null;
    newBoard.smokeScreenExpiresAfterTurn = null;
  }

  // ── Advance turn ──────────────────────────────────────────────────────────
  // Store the current roll as the last roll so the opponent can see it.
  newBoard.lastRollResult = newBoard.rollResult;
  newBoard.lastDiceResults = newBoard.diceResults;
  newBoard.lastRollPlayerUid = activePlayer.uid;
  newBoard.turn += 1;

  // For overclock, the boosted roll is preserved so the player can use it on
  // their extra turn without rolling again.  All other effects clear the roll.
  const supportEffectUsed = moveChoice.activateSupport
    ? newActive.support?.supportEffect
    : null;
  if (supportEffectUsed !== 'overclock') {
    newBoard.rollResult = null;
    newBoard.diceResults = null;
  }

  if (!extraTurn) {
    // Hand off to the opponent.
    newBoard.activePlayerUid = opponentPlayer.uid;
  }
  // When extraTurn is true, activePlayerUid stays the same so the same player
  // gets a fresh /roll + /move cycle.

  return {
    board: newBoard,
    active: newActive,
    opponent: newOpp,
    extraTurn,
    capturedCardId,
    events,
  };
}

// ── Win detection ─────────────────────────────────────────────────────────────

/**
 * Returns true when all RIDER_COUNT riders for a player have been scored.
 * @param {object} playerState JousturPlayerState
 */
export function detectWinner(playerState) {
  return playerState.scoredCount >= RIDER_COUNT;
}

// ── Reward calculation ────────────────────────────────────────────────────────

const BASE_XP = 50;
const BASE_OZZIES = 10;
const WIN_XP = 100;
const WIN_OZZIES = 25;
const STRIKE_XP = 15;
const ECHO_XP = 10;
const CROWD_HALO_XP = 10;
const CROWD_ROAR_XP = 10;

/**
 * Calculate final rewards for both players after a completed match.
 * Rewards are additive bonuses only — no penalties.
 *
 * @param {object} match JousturMatch
 * @returns {{ challenger: { xp, ozzies }, defender: { xp, ozzies } }}
 */
export function calcRewards(match) {
  function forPlayer(playerState) {
    let xp = BASE_XP;
    let ozzies = BASE_OZZIES;

    if (match.winnerUid === playerState.uid) {
      xp += WIN_XP;
      ozzies += WIN_OZZIES;
    }

    const traits = playerState.lineup.map((r) => r.jousturTrait);
    if (traits.includes('strike')) xp += STRIKE_XP;
    if (traits.includes('echo'))   xp += ECHO_XP;
    if (playerState.factionPassive === 'crowdHalo') xp += CROWD_HALO_XP;
    if (
      playerState.supportRuntime.activated &&
      playerState.support.supportEffect === 'crowdRoar'
    ) {
      xp += CROWD_ROAR_XP;
    }

    return { xp, ozzies };
  }

  return {
    challenger: forPlayer(match.challengerState),
    defender:   forPlayer(match.defenderState),
  };
}

// ── Turn log builder ──────────────────────────────────────────────────────────

/**
 * Build a JousturTurnLogEntry from the outcome of applyMove.
 *
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.matchId
 * @param {number} opts.turn     Turn number BEFORE advancing.
 * @param {string} opts.playerUid
 * @param {number} opts.rollResult
 * @param {string|null} opts.movedCardId
 * @param {number} opts.fromPosition
 * @param {number} opts.toPosition
 * @param {string|null} opts.capturedCardId
 * @param {boolean} opts.extraTurn
 * @param {boolean} opts.supportActivated
 * @param {string|undefined} opts.supportEffect
 * @param {string} opts.timestamp
 */
export function buildTurnLogEntry(opts) {
  const parts = [];
  if (opts.movedCardId) {
    parts.push(`Rider moved from pos ${opts.fromPosition} → ${opts.toPosition}`);
  }
  if (opts.capturedCardId) {
    parts.push('captured an opponent rider');
  }
  if (opts.toPosition === EXIT_POSITION) {
    parts.push('scored a rider');
  }
  if (opts.extraTurn) {
    parts.push('extra turn granted');
  }
  if (opts.supportActivated) {
    parts.push(`support activated (${opts.supportEffect ?? ''})`);
  }
  if (opts.rollResult === 0) {
    parts.push('rolled zero — moved 4 tiles');
  }
  const eventList = Array.isArray(opts.events) ? opts.events : [];
  const clashStartEvent = eventList.find((event) => event?.type === 'clashStarted');
  if (clashStartEvent) {
    parts.push(`joust clash started on tile ${clashStartEvent.tile}`);
  }
  const clashResolveEvent = eventList.find((event) => event?.type === 'clashResolved');
  if (clashResolveEvent) {
    parts.push(`joust clash resolved — ${clashResolveEvent.winnerLabel}`);
  }
  const summary = opts.summaryOverride ?? (parts.length ? parts.join(', ') : 'turn taken');

  return {
    id: opts.id,
    matchId: opts.matchId,
    turn: opts.turn,
    playerUid: opts.playerUid,
    rollResult: opts.rollResult,
    movedCardId: opts.movedCardId ?? null,
    fromPosition: opts.fromPosition ?? 0,
    toPosition: opts.toPosition ?? 0,
    capturedCardId: opts.capturedCardId ?? null,
    extraTurn: opts.extraTurn ?? false,
    supportActivated: opts.supportActivated ?? false,
    supportEffect: opts.supportEffect ?? null,
    events: eventList,
    summary,
    timestamp: opts.timestamp,
  };
}
