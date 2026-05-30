/**
 * JousturBoard.tsx — Async game board for an active Joustur Skatur™ match.
 *
 * Turn flow:
 *   1. Active player clicks "Roll Dice" → rolls are fetched from server.
 *   2. Active player clicks a legal rider (or activates support).
 *   3. Server applies the move; board state refreshes.
 *
 * Non-active players see the board in read-only mode.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getJousturMatch,
  rollJousturShards,
  submitJousturMove,
  submitJousturClashChoice,
} from "../../services/joustur";
import type {
  JousturClashMiniGame,
  JousturClashState,
  JousturMatch,
  JousturLegalMove,
  JousturPlayerState,
  JousturRiderSnapshot,
  JousturRiderRuntimeState,
} from "../../lib/jousturTypes";
import { JOUSTUR_FACTION_LABELS } from "../../lib/jousturTypes";
import { CyberpunkD4Dice } from "../../components/CyberpunkD4Dice";
import { useJousturSoundtrack } from "../../hooks/useJousturSoundtrack";
import {
  sfxJousturRoll,
  sfxJousturMove,
  sfxJousturStealthAlcove,
  sfxJousturRiderScored,
  sfxJousturClashStart,
  sfxJousturClashWin,
  sfxJousturClashLoss,
  sfxJousturApplause,
  sfxJousturBoo,
} from "../../lib/sfx";

const JOUSTUR_BOARD_IMAGE_URL = "/assets/joustur/joustur-board.png";
const STEALTH_ALCOVES = new Set([4, 6, 8, 12, 14]);
const PRIVATE_ENTRY_MIN = 1;
const PRIVATE_ENTRY_MAX = 4;
const EXIT_POSITION = 15;
const MOVE_HINT_DELAY_MS = 9000;
type BoardSide = "top" | "bottom";
type ClashCinematicStage = "charge" | "impact" | "resolve";

// ── Clash mini-game tuning (must mirror server/lib/jousturRules.js) ────────────
/** Number of Rock/Paper/Scissors rounds played in the best-of-3 mini-game. */
const CLASH_RPS_ROUNDS = 3;
/** Length of the button-mash window, in milliseconds. */
const CLASH_MASH_DURATION_MS = 4000;
/** Maximum mash score (presses are clamped to this; matches the server cap). */
const CLASH_MASH_MAX_SCORE = 20;

type RpsMove = "rock" | "paper" | "scissors";
const RPS_MOVES: Array<{ move: RpsMove; label: string; emoji: string }> = [
  { move: "rock", label: "Rock", emoji: "✊" },
  { move: "paper", label: "Paper", emoji: "✋" },
  { move: "scissors", label: "Scissors", emoji: "✌️" },
];

/** 1 = player wins, -1 = computer wins, 0 = tie. */
function compareRpsMoves(player: RpsMove, computer: RpsMove): number {
  if (player === computer) return 0;
  if (
    (player === "rock" && computer === "scissors") ||
    (player === "paper" && computer === "rock") ||
    (player === "scissors" && computer === "paper")
  ) {
    return 1;
  }
  return -1;
}

const CLASH_MINI_GAME_LABELS: Record<JousturClashMiniGame, string> = {
  rps: "Best-of-3 Rock/Paper/Scissors",
  mash: "Button-Mash Meter",
};

/** Player tile paths matching server/lib/jousturRules.js */
const PLAYER1_PATH = [4, 3, 2, 1, 7, 8, 9, 10, 11, 12, 13, 14, 6, 5] as const;
const PLAYER2_PATH = [18, 17, 16, 15, 7, 8, 9, 10, 11, 12, 13, 14, 20, 19] as const;

interface BoardPoint {
  x: number;
  y: number;
}

// Percent-based centers for the eight numbered columns on the visual board.
const BOARD_COLUMNS = [30.0, 35.7, 41.4, 47.1, 52.9, 58.6, 64.3, 70.0] as const;
// Percent-based row centers: P1 private lane (top), shared lane (middle), P2 private lane (bottom).
const BOARD_ROWS: Record<BoardSide | "shared", number> = {
  top: 37.0,
  shared: 47.0,
  bottom: 59.5,
};

/**
 * Map from board tile number to visual {x, y} position.
 * P1 private entry tiles (1,2,3,4) = top row, columns 0-3
 * P1 private exit tiles (5,6) = top row, columns 6-7
 * P2 private entry tiles (15,16,17,18) = bottom row, columns 0-3
 * P2 private exit tiles (19,20) = bottom row, columns 6-7
 * Shared tiles (7-14) = middle row, columns 0-7
 */
const TILE_POSITIONS: Record<number, BoardPoint> = {
  // P1 private entry (top row, left to right = tile 1,2,3,4)
  1:  { x: BOARD_COLUMNS[0], y: BOARD_ROWS.top },
  2:  { x: BOARD_COLUMNS[1], y: BOARD_ROWS.top },
  3:  { x: BOARD_COLUMNS[2], y: BOARD_ROWS.top },
  4:  { x: BOARD_COLUMNS[3], y: BOARD_ROWS.top },
  // P1 private exit (top row, right side = tile 5,6)
  5:  { x: BOARD_COLUMNS[6], y: BOARD_ROWS.top },
  6:  { x: BOARD_COLUMNS[7], y: BOARD_ROWS.top },
  // P2 private entry (bottom row, left to right = tile 15,16,17,18)
  15: { x: BOARD_COLUMNS[0], y: BOARD_ROWS.bottom },
  16: { x: BOARD_COLUMNS[1], y: BOARD_ROWS.bottom },
  17: { x: BOARD_COLUMNS[2], y: BOARD_ROWS.bottom },
  18: { x: BOARD_COLUMNS[3], y: BOARD_ROWS.bottom },
  // P2 private exit (bottom row, right side = tile 19,20)
  19: { x: BOARD_COLUMNS[6], y: BOARD_ROWS.bottom },
  20: { x: BOARD_COLUMNS[7], y: BOARD_ROWS.bottom },
  // Shared tiles (middle row, left to right = tiles 7-14)
  7:  { x: BOARD_COLUMNS[0], y: BOARD_ROWS.shared },
  8:  { x: BOARD_COLUMNS[1], y: BOARD_ROWS.shared },
  9:  { x: BOARD_COLUMNS[2], y: BOARD_ROWS.shared },
  10: { x: BOARD_COLUMNS[3], y: BOARD_ROWS.shared },
  11: { x: BOARD_COLUMNS[4], y: BOARD_ROWS.shared },
  12: { x: BOARD_COLUMNS[5], y: BOARD_ROWS.shared },
  13: { x: BOARD_COLUMNS[6], y: BOARD_ROWS.shared },
  14: { x: BOARD_COLUMNS[7], y: BOARD_ROWS.shared },
};

/**
 * Get the visual board point for a rider at a given path index.
 * Uses the player's tile path to look up the visual position.
 * Note: Player 1 (side="bottom" in UI) uses tiles 1-6 which are visually
 * on the TOP row of the board image. Player 2 (side="top" in UI) uses tiles
 * 15-20 which are on the BOTTOM row.
 */
function getBoardPoint(position: number, side: BoardSide): BoardPoint {
  // Player 1 private lane is visually at the top; Player 2 at the bottom.
  const laneY = side === "bottom" ? BOARD_ROWS.top : BOARD_ROWS.bottom;
  if (position === 0) {
    return { x: 7.5, y: laneY };
  }
  if (position === EXIT_POSITION) {
    return { x: 92.5, y: laneY };
  }
  const path = side === "bottom" ? PLAYER1_PATH : PLAYER2_PATH;
  if (position >= 1 && position <= 14) {
    const tile = path[position - 1];
    return TILE_POSITIONS[tile] ?? { x: 50, y: laneY };
  }
  return { x: 50, y: laneY };
}

function getBoardTile(position: number, side: BoardSide): number | null {
  if (position < 1 || position > 14) return null;
  const path = side === "bottom" ? PLAYER1_PATH : PLAYER2_PATH;
  return path[position - 1] ?? null;
}

function getBoardStackKey(position: number, side: BoardSide): string {
  const tile = getBoardTile(position, side);
  if (tile !== null) return `tile:${tile}`;
  return `${side}:${position}`;
}

function getStackOffset(index: number, total: number): BoardPoint {
  if (total <= 1) return { x: 0, y: 0 };
  // Keep stacked cards centered with at most ~8% total horizontal spread.
  const spread = Math.min(2.4, 8 / total);
  // Alternate a small vertical offset so same-tile cards remain distinguishable.
  return {
    x: (index - (total - 1) / 2) * spread,
    y: index % 2 === 0 ? -0.75 : 0.75,
  };
}

function getPieceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const chars = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0])
    : Array.from(words[0] ?? name).slice(0, 2);
  return chars.filter(Boolean).join("").toUpperCase() || "??";
}

function isClashResolvedEvent(
  event: unknown,
): event is {
  type: "clashResolved";
  tile: number;
  winnerUid?: string;
  loserUid?: string;
  winnerCardId?: string;
  loserCardId?: string;
} {
  return Boolean(event && typeof event === "object" && (event as { type?: string }).type === "clashResolved");
}

interface StatusMessage {
  message: string;
  tone: "ok" | "clash-win" | "clash-loss";
}

interface ClashCinematicState {
  id: number;
  stage: ClashCinematicStage;
  outcome: "win" | "loss";
  tile: number;
  attackerName: string;
  defenderName: string;
  attackerOwnerLabel: string;
  defenderOwnerLabel: string;
  winnerName: string;
  loserName: string;
  winnerCardId: string;
  loserCardId: string;
  attackerSnapshot?: JousturRiderSnapshot;
  defenderSnapshot?: JousturRiderSnapshot;
}

const POS_LABELS: Record<number, string> = {
  0: "Off board",
  15: "Scored",
};

function posLabel(pos: number, side: BoardSide = "bottom"): string {
  if (POS_LABELS[pos]) return POS_LABELS[pos];
  const path = side === "bottom" ? PLAYER1_PATH : PLAYER2_PATH;
  if (pos >= 1 && pos <= 14) {
    const tile = path[pos - 1];
    const zone = pos <= 4 ? "Entry" : pos <= 12 ? "Shared" : "Exit";
    return `${zone} (tile ${tile})${STEALTH_ALCOVES.has(pos) ? " ⚡" : ""}`;
  }
  return `${pos}`;
}

function compareMovePriority(a: JousturLegalMove, b: JousturLegalMove): number {
  const scoreA = [
    a.isExitMove ? 1 : 0,
    a.wouldCapture ? 1 : 0,
    STEALTH_ALCOVES.has(a.toPosition) ? 1 : 0,
    a.toPosition,
    a.fromPosition,
  ];
  const scoreB = [
    b.isExitMove ? 1 : 0,
    b.wouldCapture ? 1 : 0,
    STEALTH_ALCOVES.has(b.toPosition) ? 1 : 0,
    b.toPosition,
    b.fromPosition,
  ];
  for (let i = 0; i < scoreA.length; i += 1) {
    if (scoreA[i] !== scoreB[i]) return scoreB[i] - scoreA[i];
  }
  return String(a.cardId).localeCompare(String(b.cardId));
}

function describeMoveHint(move: JousturLegalMove, riderName: string, side: BoardSide = "bottom"): string {
  const destination = posLabel(move.toPosition, side);
  if (move.isExitMove) {
    return `${riderName} can score now by moving to ${destination}.`;
  }
  if (move.wouldCapture) {
    return `${riderName} can move to ${destination} and start a joust clash.`;
  }
  if (STEALTH_ALCOVES.has(move.toPosition)) {
    return `${riderName} can move to ${destination} for cover and an extra turn.`;
  }
  return `${riderName} can advance to ${destination}.`;
}

function describeSupportHint(effect: string): string {
  switch (effect) {
    case "recoveryPing":
      return "Activate Support to bring one captured rider back into your entry lane.";
    case "crowdRoar":
      return "Activate Support to take an extra turn after this one.";
    case "smokeScreen":
      return "Activate Support to keep your shared-lane riders safe for the opponent's next turn.";
    case "reroll":
      return "Activate Support to reroll your USB Shards and play the better result.";
    case "overclock":
      return "Activate Support to add +1 to the current roll and stretch the turn.";
    case "sideRoute":
      return "Activate Support to jump one entry-lane rider straight into the exit lane.";
    default:
      return "Activate Support for your once-per-match faction effect.";
  }
}

function RiderCardPiece({
  snapshot,
  ownerLabel,
}: {
  snapshot?: JousturRiderSnapshot;
  ownerLabel: string;
}) {
  const hasLayers = Boolean(
    snapshot?.backgroundImageUrl ||
    snapshot?.characterImageUrl ||
    snapshot?.boardImageUrl ||
    snapshot?.frameImageUrl,
  );
  const name = snapshot?.name ?? "Rider";

  return (
    <span className="joustur-board-piece__card" aria-hidden="true">
      {hasLayers ? (
        <>
          {snapshot?.backgroundImageUrl && (
            <img
              src={snapshot.backgroundImageUrl}
              alt=""
              className="joustur-board-piece__layer joustur-board-piece__layer--background"
              loading="lazy"
              decoding="async"
            />
          )}
          {snapshot?.boardImageUrl && (
            <img
              src={snapshot.boardImageUrl}
              alt=""
              className="joustur-board-piece__layer joustur-board-piece__layer--board"
              loading="lazy"
              decoding="async"
            />
          )}
          {snapshot?.characterImageUrl && (
            <img
              src={snapshot.characterImageUrl}
              alt=""
              className="joustur-board-piece__layer joustur-board-piece__layer--character"
              loading="lazy"
              decoding="async"
            />
          )}
          {snapshot?.frameImageUrl && (
            <img
              src={snapshot.frameImageUrl}
              alt=""
              className="joustur-board-piece__layer joustur-board-piece__layer--frame"
              loading="lazy"
              decoding="async"
            />
          )}
        </>
      ) : (
        <span className="joustur-board-piece__fallback">
          {getPieceInitials(name)}
        </span>
      )}
      <span className="joustur-board-piece__owner">{ownerLabel}</span>
    </span>
  );
}

function buildClashCinematicState(
  match: JousturMatch | null,
  clash: JousturClashState | null,
  resolvedEvent: {
    tile: number;
    winnerUid?: string;
    winnerCardId?: string;
    loserCardId?: string;
  },
  myUid: string,
): ClashCinematicState | null {
  if (!match || !clash || !match.challengerState || !match.defenderState || !resolvedEvent.winnerUid || !resolvedEvent.winnerCardId || !resolvedEvent.loserCardId) {
    return null;
  }

  const states = [match.challengerState, match.defenderState];
  const attackerState = states.find((state) => state.uid === clash.attackerUid);
  const defenderState = states.find((state) => state.uid === clash.defenderUid);
  if (!attackerState || !defenderState) return null;

  const attackerSnapshot = attackerState.lineup.find((snapshot) => snapshot.cardId === clash.attackerCardId);
  const defenderSnapshot = defenderState.lineup.find((snapshot) => snapshot.cardId === clash.defenderCardId);
  const attackerName = attackerSnapshot?.name ?? "Attacker";
  const defenderName = defenderSnapshot?.name ?? "Defender";
  const winnerName = resolvedEvent.winnerCardId === clash.attackerCardId ? attackerName : defenderName;
  const loserName = resolvedEvent.loserCardId === clash.attackerCardId ? attackerName : defenderName;

  return {
    id: Date.now(),
    stage: "charge",
    outcome: resolvedEvent.winnerUid === myUid ? "win" : "loss",
    tile: resolvedEvent.tile,
    attackerName,
    defenderName,
    attackerOwnerLabel: clash.attackerUid === myUid ? "YOU" : "OPP",
    defenderOwnerLabel: clash.defenderUid === myUid ? "YOU" : "OPP",
    winnerName,
    loserName,
    winnerCardId: resolvedEvent.winnerCardId,
    loserCardId: resolvedEvent.loserCardId,
    attackerSnapshot,
    defenderSnapshot,
  };
}

function ClashCinematicOverlay({
  cinematic,
  onDismiss,
}: {
  cinematic: ClashCinematicState;
  onDismiss: () => void;
}) {
  const winnerIsAttacker = cinematic.winnerCardId === cinematic.attackerSnapshot?.cardId;
  const winnerSnapshot = winnerIsAttacker ? cinematic.attackerSnapshot : cinematic.defenderSnapshot;
  const winnerOwnerLabel = winnerIsAttacker ? cinematic.attackerOwnerLabel : cinematic.defenderOwnerLabel;
  const attackerIsLoser = !winnerIsAttacker;
  const defenderIsLoser = winnerIsAttacker;

  return (
    <div
      className={`joustur-clash-cinematic joustur-clash-cinematic--${cinematic.outcome} joustur-clash-cinematic--${cinematic.stage}`}
      role="status"
      aria-live="assertive"
    >
      <div className="joustur-clash-cinematic__backdrop" />
      <div className="joustur-clash-cinematic__content">
        <p className="joustur-clash-cinematic__eyebrow">Tile {cinematic.tile} showdown</p>
        <div className="joustur-clash-cinematic__arena" aria-hidden="true">
          <div className="joustur-clash-cinematic__burst" />
          <div className="joustur-clash-cinematic__shockwave" />
          <figure className={`joustur-clash-cinematic__card joustur-clash-cinematic__card--attacker${attackerIsLoser ? " joustur-clash-cinematic__card--loser" : ""}`}>
            <div className="joustur-clash-cinematic__piece">
              <RiderCardPiece snapshot={cinematic.attackerSnapshot} ownerLabel={cinematic.attackerOwnerLabel} />
            </div>
            <figcaption>{cinematic.attackerName}</figcaption>
          </figure>
          <figure className={`joustur-clash-cinematic__card joustur-clash-cinematic__card--defender${defenderIsLoser ? " joustur-clash-cinematic__card--loser" : ""}`}>
            <div className="joustur-clash-cinematic__piece">
              <RiderCardPiece snapshot={cinematic.defenderSnapshot} ownerLabel={cinematic.defenderOwnerLabel} />
            </div>
            <figcaption>{cinematic.defenderName}</figcaption>
          </figure>
          <figure className="joustur-clash-cinematic__winner">
            <div className="joustur-clash-cinematic__piece joustur-clash-cinematic__piece--winner">
              <RiderCardPiece snapshot={winnerSnapshot} ownerLabel={winnerOwnerLabel} />
            </div>
            <figcaption>
              <strong>{cinematic.winnerName}</strong>
              <span>Seizes the tile</span>
            </figcaption>
          </figure>
        </div>
        <div className="joustur-clash-cinematic__result">
          <h2>
            {cinematic.outcome === "win"
              ? "⚔️ You won the joust clash!"
              : "💥 You lost the joust clash."}
          </h2>
          <p>
            {cinematic.outcome === "win"
              ? `${cinematic.winnerName} blasted past ${cinematic.loserName} and held the lane.`
              : `${cinematic.winnerName} smashed through ${cinematic.loserName} and claimed the lane.`}
          </p>
        </div>
        {cinematic.stage === "resolve" && (
          <button
            className="joustur-clash-cinematic__dismiss"
            onClick={onDismiss}
            aria-label="Exit clash result"
          >
            Exit
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Best-of-3 Rock/Paper/Scissors mini-game. The player duels a local computer
 * for three rounds; the score reported is the number of rounds the player won.
 */
function ClashRpsGame({
  disabled,
  onComplete,
}: {
  disabled: boolean;
  onComplete: (score: number) => void;
}) {
  const [round, setRound] = useState(1);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [finished, setFinished] = useState(false);
  const [lastRound, setLastRound] = useState<{
    player: RpsMove;
    computer: RpsMove;
    result: number;
  } | null>(null);

  const playRound = (move: RpsMove) => {
    if (disabled || finished) return;
    const computer = RPS_MOVES[Math.floor(Math.random() * RPS_MOVES.length)].move;
    const result = compareRpsMoves(move, computer);
    const nextWins = wins + (result === 1 ? 1 : 0);
    const nextLosses = losses + (result === -1 ? 1 : 0);
    setWins(nextWins);
    setLosses(nextLosses);
    setLastRound({ player: move, computer, result });
    if (round >= CLASH_RPS_ROUNDS) {
      setFinished(true);
      onComplete(nextWins);
    } else {
      setRound((r) => r + 1);
    }
  };

  const moveLabel = (move: RpsMove) =>
    RPS_MOVES.find((option) => option.move === move)?.emoji ?? "";

  return (
    <div className="joustur-clash-minigame joustur-clash-minigame--rps">
      <div className="joustur-clash-minigame__scoreboard">
        <span>
          Round <strong>{Math.min(round, CLASH_RPS_ROUNDS)}</strong> / {CLASH_RPS_ROUNDS}
        </span>
        <span>
          You <strong>{wins}</strong> · CPU <strong>{losses}</strong>
        </span>
      </div>
      {lastRound && (
        <p className="joustur-clash-minigame__last" aria-live="polite">
          {moveLabel(lastRound.player)} vs {moveLabel(lastRound.computer)} —{" "}
          {lastRound.result === 1 ? "round won!" : lastRound.result === -1 ? "round lost." : "tie."}
        </p>
      )}
      <div className="joustur-clash-minigame__actions">
        {RPS_MOVES.map((option) => (
          <button
            key={option.move}
            type="button"
            className="joustur-clash-minigame__throw"
            onClick={() => playRound(option.move)}
            disabled={disabled || finished}
          >
            <span aria-hidden="true">{option.emoji}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Button-mash meter mini-game. The player taps as fast as they can within a
 * fixed window; the score reported is the (clamped) number of taps.
 */
function ClashMashGame({
  disabled,
  onComplete,
}: {
  disabled: boolean;
  onComplete: (score: number) => void;
}) {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [timeLeft, setTimeLeft] = useState(CLASH_MASH_DURATION_MS);
  const countRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (phase !== "running") return;
    const start = Date.now();
    const interval = window.setInterval(() => {
      const remaining = CLASH_MASH_DURATION_MS - (Date.now() - start);
      if (remaining <= 0) {
        window.clearInterval(interval);
        setTimeLeft(0);
        setPhase("done");
        onCompleteRef.current(Math.min(countRef.current, CLASH_MASH_MAX_SCORE));
      } else {
        setTimeLeft(remaining);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [phase]);

  const handleMash = () => {
    if (disabled || phase === "done") return;
    if (phase === "idle") setPhase("running");
    countRef.current = Math.min(countRef.current + 1, CLASH_MASH_MAX_SCORE);
    setCount(countRef.current);
  };

  const fillPct = Math.round((count / CLASH_MASH_MAX_SCORE) * 100);
  const seconds = Math.ceil(timeLeft / 1000);

  return (
    <div className="joustur-clash-minigame joustur-clash-minigame--mash">
      <div className="joustur-clash-minigame__scoreboard">
        <span>
          Taps <strong>{count}</strong> / {CLASH_MASH_MAX_SCORE}
        </span>
        <span>
          {phase === "idle"
            ? "Tap to start!"
            : phase === "running"
              ? `${seconds}s left`
              : "Time!"}
        </span>
      </div>
      <div className="joustur-clash-minigame__meter" aria-hidden="true">
        <div className="joustur-clash-minigame__meter-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <button
        type="button"
        className="joustur-clash-minigame__mash"
        onClick={handleMash}
        disabled={disabled || phase === "done"}
      >
        {phase === "done" ? "Locking in…" : "MASH!"}
      </button>
    </div>
  );
}

function ClashMiniGame({
  miniGame,
  disabled,
  onComplete,
}: {
  miniGame: JousturClashMiniGame;
  disabled: boolean;
  onComplete: (score: number) => void;
}) {
  if (miniGame === "mash") {
    return <ClashMashGame disabled={disabled} onComplete={onComplete} />;
  }
  return <ClashRpsGame disabled={disabled} onComplete={onComplete} />;
}

interface DragState {
  cardId: string;
  /** Board-percent coords where the drag started (to distinguish tap from drag). */
  startX: number;
  startY: number;
  /** Current board-percent coords of the pointer (card follows this). */
  x: number;
  y: number;
}

/** Distance in board-percent below which a drop snaps to the destination tile. */
const SNAP_THRESHOLD_PCT = 18;
/** Distance in board-percent below which a release is treated as a tap, not a drag. */
const TAP_THRESHOLD_PCT = 2;

function VisualBoard({
  myState,
  oppState,
  clash,
  myLegalMoves,
  moving,
  showMoveHints,
  suggestedCardId,
  helperText,
  onSelectRider,
  onUserIntent,
}: {
  myState: JousturPlayerState;
  oppState: JousturPlayerState;
  clash: JousturClashState | null;
  myLegalMoves: JousturLegalMove[];
  moving: boolean;
  showMoveHints: boolean;
  suggestedCardId: string | null;
  helperText: string | null;
  onSelectRider: (cardId: string) => void;
  onUserIntent: () => void;
}) {
  const legalMoveByCardId = new Map(myLegalMoves.map((move) => [move.cardId, move]));
  const stackCounts = new Map<string, number>();
  const stackIndexes = new Map<string, number>();
  const players = [
    { state: oppState, side: "top" as const, label: "Opponent" },
    { state: myState, side: "bottom" as const, label: "You" },
  ];
  const snapshotByCardId = new Map(
    players.flatMap((player) =>
      player.state.lineup.map((snapshot) => [snapshot.cardId, snapshot] as const),
    ),
  );

  for (const player of players) {
    for (const rider of player.state.riders) {
      const key = getBoardStackKey(rider.position, player.side);
      stackCounts.set(key, (stackCounts.get(key) ?? 0) + 1);
    }
  }

  // ── Drag-and-drop state ──────────────────────────────────────────────────────
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  /** Convert page/client coordinates to board-percentage coordinates. */
  const toPercent = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = boardFrameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 50, y: 50 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleFramePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || moving) return;
    onUserIntent();
    const pos = toPercent(e.clientX, e.clientY);
    setDragState((prev) => (prev ? { ...prev, ...pos } : null));
  };

  const handleFramePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;
    const pos = toPercent(e.clientX, e.clientY);
    if (!moving) {
      const move = legalMoveByCardId.get(dragState.cardId);
      if (move) {
        const travelDist = Math.hypot(pos.x - dragState.startX, pos.y - dragState.startY);
        if (travelDist < TAP_THRESHOLD_PCT) {
          // Treat as a tap — confirm move immediately.
          onUserIntent();
          onSelectRider(dragState.cardId);
        } else {
          // Treat as a drag — allow a forgiving release once the card clearly
          // moves toward its only legal destination.
          const origin = getBoardPoint(move.fromPosition, "bottom");
          const dest = getBoardPoint(move.toPosition, "bottom");
          const originDist = Math.hypot(origin.x - dest.x, origin.y - dest.y);
          const snapDist = Math.hypot(pos.x - dest.x, pos.y - dest.y);
          const progressTowardTarget = originDist - snapDist;
          const releaseLooksIntentional =
            snapDist < SNAP_THRESHOLD_PCT ||
            (
              progressTowardTarget >= Math.max(4, originDist * 0.35) &&
              snapDist <= Math.max(SNAP_THRESHOLD_PCT, originDist * 0.62)
            );
          if (releaseLooksIntentional) {
            onUserIntent();
            onSelectRider(dragState.cardId);
          }
        }
      }
    }
    setDragState(null);
  };

  return (
    <section className="joustur-visual-board" aria-label="Joustur gameplay board">
      <div
        ref={boardFrameRef}
        className="joustur-visual-board__frame"
        onPointerMove={handleFramePointerMove}
        onPointerUp={handleFramePointerUp}
        onPointerCancel={() => setDragState(null)}
      >
        <img
          src={JOUSTUR_BOARD_IMAGE_URL}
          alt="Joustur gameplay board with numbered movement tiles"
          className="joustur-visual-board__image"
          loading="eager"
          decoding="async"
        />

        {clash && TILE_POSITIONS[clash.tile] && (
          <span
            className="joustur-visual-board__clash"
            style={{
              left: `${TILE_POSITIONS[clash.tile].x}%`,
              top: `${TILE_POSITIONS[clash.tile].y}%`,
            }}
            aria-label={`Active joust clash on tile ${clash.tile}`}
            title={`Joust clash on tile ${clash.tile}`}
          />
        )}

        {players.flatMap((player) =>
          player.state.riders.map((rider) => {
            const key = getBoardStackKey(rider.position, player.side);
            const stackIndex = stackIndexes.get(key) ?? 0;
            stackIndexes.set(key, stackIndex + 1);
            const stackTotal = stackCounts.get(key) ?? 1;
            const naturalPoint = getBoardPoint(rider.position, player.side);
            const offset = getStackOffset(stackIndex, stackTotal);
            const legalMove = player.side === "bottom" ? legalMoveByCardId.get(rider.cardId) : undefined;
            const isLegal = Boolean(legalMove);
            const snapshot = snapshotByCardId.get(rider.cardId);
            const isClashing = Boolean(
              clash &&
              (clash.attackerCardId === rider.cardId || clash.defenderCardId === rider.cardId),
            );
            const isDragging = dragState?.cardId === rider.cardId;
            const displayX = isDragging ? dragState!.x : naturalPoint.x + offset.x;
            const displayY = isDragging ? dragState!.y : naturalPoint.y + offset.y;
            const moveHint = legalMove && showMoveHints
              ? describeMoveHint(legalMove, snapshot?.name ?? "This rider")
              : null;
            return (
              <button
                key={`${player.side}-${rider.cardId}`}
                type="button"
                className={`joustur-board-piece joustur-board-piece--${player.side}${rider.isScored ? " joustur-board-piece--scored" : ""}${rider.isCaptured ? " joustur-board-piece--captured" : ""}${isLegal ? " joustur-board-piece--legal" : ""}${isClashing ? " joustur-board-piece--clashing" : ""}${isDragging ? " joustur-board-piece--dragging" : ""}${showMoveHints && suggestedCardId === rider.cardId ? " joustur-board-piece--hinting" : ""}`}
                style={{
                  left: `${displayX}%`,
                  top: `${displayY}%`,
                }}
                disabled={!isLegal || moving}
                onPointerDown={isLegal && !moving ? (e) => {
                  e.preventDefault();
                  onUserIntent();
                  // Capture pointer on the frame so pointermove/up fire there even
                  // when the cursor leaves the button area during a fast drag.
                  boardFrameRef.current?.setPointerCapture(e.pointerId);
                  const pos = toPercent(e.clientX, e.clientY);
                  setDragState({ cardId: rider.cardId, startX: pos.x, startY: pos.y, ...pos });
                } : undefined}
                onClick={(e) => {
                  // Handle keyboard-initiated clicks (Enter/Space).
                  // Pointer-originated interactions are handled via onPointerDown/Up.
                  if (e.detail === 0 && isLegal && !moving) {
                    onUserIntent();
                    onSelectRider(rider.cardId);
                  }
                }}
                aria-label={`${player.label} ${snapshot?.name ?? rider.cardId} at ${posLabel(rider.position)}${isLegal && legalMove ? `, legal move to ${posLabel(legalMove.toPosition)}` : ""}`}
                title={moveHint ?? `${snapshot?.name ?? rider.cardId} · ${posLabel(rider.position)}`}
                data-move-hint={moveHint ?? undefined}
              >
                <RiderCardPiece snapshot={snapshot} ownerLabel={player.label === "You" ? "YOU" : "OPP"} />
              </button>
            );
          }),
        )}
      </div>
      {helperText && <p className="joustur-visual-board__helper">{helperText}</p>}
    </section>
  );
}

function PlayerPanel({
  label,
  player,
  isMe,
  isActive,
  legalMoves,
  canActivateSupport,
  showMoveHints,
  sideRouteTarget,
  onSideRouteTargetChange,
  onSelectRider,
  onActivateSupport,
}: {
  label: string;
  player: JousturPlayerState;
  isMe: boolean;
  isActive: boolean;
  legalMoves: JousturLegalMove[];
  canActivateSupport: { canActivate: boolean; reason: string | null };
  showMoveHints: boolean;
  sideRouteTarget: string;
  onSideRouteTargetChange: (cardId: string) => void;
  onSelectRider: (cardId: string) => void;
  onActivateSupport: (targetCardId?: string) => void;
}) {
  const legalSet = new Set(legalMoves.map((m) => m.cardId));
  const isSideRoute = player.support.supportEffect === "sideRoute";

  const entryRiders = player.riders.filter(
    (r) => r.position >= PRIVATE_ENTRY_MIN && r.position <= PRIVATE_ENTRY_MAX,
  );
  // Build a cardId-to-snapshot index for O(1) name lookup.
  const riderIndexByCardId = new Map(
    player.riders.map((r, i) => [r.cardId, i]),
  );

  return (
    <div
      className={`joustur-board__player${isMe ? " joustur-board__player--me" : ""}${isActive ? " joustur-board__player--active" : ""}`}
    >
      <h3 className="joustur-board__player-name">
        {label}
        {isActive && <span className="joustur-board__turn-badge"> — Active</span>}
        <span className="joustur-board__faction-badge">
          {JOUSTUR_FACTION_LABELS[player.faction] ?? player.faction}
        </span>
      </h3>

      <p className="joustur-board__score">
        Scored: {player.scoredCount} / 6
      </p>

      <ul className="joustur-board__riders">
        {player.riders.map((rider: JousturRiderRuntimeState, i: number) => {
          const snapshot = player.lineup[i];
          const isLegal = legalSet.has(rider.cardId);
          return (
            <li
              key={rider.cardId}
              className={`joustur-board__rider${rider.isScored ? " joustur-board__rider--scored" : ""}${isLegal ? " joustur-board__rider--legal" : ""}`}
            >
              <span className="joustur-board__rider-name">
                {snapshot?.name ?? rider.cardId}
              </span>
              <span className="joustur-board__rider-pos">
                {posLabel(rider.position, isMe ? "bottom" : "top")}
              </span>
              {isLegal && isMe && isActive && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => onSelectRider(rider.cardId)}
                >
                  Move
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Support card */}
      {isMe && isActive && !player.supportRuntime.activated && (
        <div className="joustur-board__support">
          <p className="joustur-board__support-name">
            Support: {player.support.name}{" "}
            <span className="joustur-board__support-effect">
              ({player.support.supportEffect})
            </span>
          </p>
          {canActivateSupport.canActivate ? (
            isSideRoute && entryRiders.length > 0 ? (
              /* SideRoute target picker */
              <div className="joustur-board__sideRoute-picker">
                <select
                  value={sideRouteTarget}
                  onChange={(e) => onSideRouteTargetChange(e.target.value)}
                  className="joustur-board__sideRoute-select"
                  aria-label="Select rider to teleport"
                >
                  <option value="">Pick a rider…</option>
                  {entryRiders.map((r, i) => {
                    const snapshotIdx = riderIndexByCardId.get(r.cardId);
                    const name = snapshotIdx !== undefined
                      ? (player.lineup[snapshotIdx]?.name ?? `Rider ${i + 1}`)
                      : `Rider ${i + 1}`;
                    return (
                      <option key={r.cardId} value={r.cardId}>
                        {name} (Entry {r.position})
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={!sideRouteTarget}
                  onClick={() => onActivateSupport(sideRouteTarget)}
                  title={showMoveHints ? describeSupportHint(player.support.supportEffect) : undefined}
                >
                  Activate SideRoute
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => onActivateSupport()}
                title={showMoveHints ? describeSupportHint(player.support.supportEffect) : undefined}
              >
                Activate Support
              </button>
            )
          ) : (
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled
              title={canActivateSupport.reason ?? undefined}
            >
              Activate Support
            </button>
          )}
        </div>
      )}
      {player.supportRuntime.activated && (
        <p className="joustur-board__support-used">Support used</p>
      )}
    </div>
  );
}

export function JousturBoard() {
  const { id: matchId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [soundtrackPlaying, toggleSoundtrack] = useJousturSoundtrack();

  const [match, setMatch] = useState<JousturMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [clashing, setClashing] = useState(false);
  const [clashAttempt, setClashAttempt] = useState(0);
  const [legalMoves, setLegalMoves] = useState<JousturLegalMove[]>([]);
  const [canActivateSupport, setCanActivateSupport] = useState<{
    canActivate: boolean;
    reason: string | null;
  }>({ canActivate: false, reason: null });
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [diceResults, setDiceResults] = useState<number[] | null>(null);
  const [lastEvent, setLastEvent] = useState<StatusMessage | null>(null);
  const [clashCinematic, setClashCinematic] = useState<ClashCinematicState | null>(null);
  const [pendingResultRoute, setPendingResultRoute] = useState<string | null>(null);
  const [showMoveHints, setShowMoveHints] = useState(false);
  const [hintCycle, setHintCycle] = useState(0);
  // sideRoute target selection — kept in JousturBoard so it survives re-renders
  // of PlayerPanel during polling.
  const [sideRouteTarget, setSideRouteTarget] = useState<string>("");

  const myUid = user?.uid ?? "";

  const loadMatch = useCallback(async () => {
    if (!matchId) return;
    try {
      const m = await getJousturMatch(matchId);
      setMatch(m);
      if (m.status !== "active") navigate(`/joustur/result/${matchId}`);
      if (m.board.clash) {
        setRollResult(null);
        setDiceResults(null);
        setLegalMoves([]);
        setCanActivateSupport({ canActivate: false, reason: null });
      }
      // P1-A: Hydrate legal moves from the match response when a roll is
      // already pending (e.g. after a page reload mid-turn).
      if (
        m.board.clash === null &&
        m.board.rollResult !== null &&
        m.board.activePlayerUid === myUid &&
        m.legalMoves !== undefined &&
        m.canActivateSupport !== undefined
      ) {
        setRollResult(m.board.rollResult);
        setDiceResults(m.board.diceResults ?? null);
        setLegalMoves(m.legalMoves);
        setCanActivateSupport(m.canActivateSupport);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load match.");
    } finally {
      setLoading(false);
    }
  }, [matchId, navigate, myUid]);

  useEffect(() => {
    loadMatch();
    // Poll every 15 s, but only while the tab is visible to avoid wasting
    // network requests and Firebase quota when the player is elsewhere.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadMatch();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadMatch]);

  useEffect(() => {
    if (!clashCinematic || clashCinematic.stage !== "charge") return;

    const cinematicId = clashCinematic.id;
    const impactTimer = window.setTimeout(() => {
      setClashCinematic((current) =>
        current?.id === cinematicId ? { ...current, stage: "impact" } : current,
      );
    }, 420);
    const resolveTimer = window.setTimeout(() => {
      setClashCinematic((current) =>
        current?.id === cinematicId ? { ...current, stage: "resolve" } : current,
      );
    }, 980);

    return () => {
      window.clearTimeout(impactTimer);
      window.clearTimeout(resolveTimer);
    };
  }, [clashCinematic]);

  useEffect(() => {
    if (!pendingResultRoute || clashCinematic) return;
    navigate(pendingResultRoute);
    setPendingResultRoute(null);
  }, [clashCinematic, navigate, pendingResultRoute]);

  const isMyTurn = match?.board.activePlayerUid === myUid;
  const activeClash = match?.board.clash ?? null;
  const myClashRole = activeClash
    ? activeClash.attackerUid === myUid
      ? "attacker"
      : activeClash.defenderUid === myUid
        ? "defender"
        : null
    : null;
  const myClashSubmitted = activeClash
    ? myClashRole === "attacker"
      ? activeClash.attackerChoiceLocked
      : myClashRole === "defender"
        ? activeClash.defenderChoiceLocked
        : false
    : false;
  const opponentClashChoiceLocked = activeClash
    ? myClashRole === "attacker"
      ? activeClash.defenderChoiceLocked
      : myClashRole === "defender"
        ? activeClash.attackerChoiceLocked
        : false
    : false;
  // rollPending: a roll has been generated AND we have the context to act on it.
  // We use either the locally cached rollResult OR the server-stored one (for
  // reloads), but only if legal moves have been hydrated — otherwise the pass
  // button would appear incorrectly before hydration completes.
  const serverRoll = match?.board.rollResult ?? null;
  const rollPending =
    activeClash === null &&
    (rollResult !== null || serverRoll !== null) &&
    (rollResult !== null || legalMoves.length > 0 || canActivateSupport.canActivate);

  const handleRoll = async () => {
    if (!matchId || rolling) return;
    setShowMoveHints(false);
    setRolling(true);
    setError(null);
    sfxJousturRoll();
    try {
      const result = await rollJousturShards(matchId);
      setRollResult(result.roll);
      setDiceResults(result.dice ?? null);
      setLegalMoves(result.legalMoves);
      setCanActivateSupport(result.canActivateSupport);
      setMatch((m) => m ? { ...m, board: { ...m.board, rollResult: result.roll, diceResults: result.dice ?? null } } : m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Roll failed.");
    } finally {
      setRolling(false);
    }
  };

  const handleMove = useCallback(
    async (cardId: string | null, activateSupport: boolean, supportTargetCardId?: string) => {
      if (!matchId || moving) return;
      setShowMoveHints(false);
      setMoving(true);
      setError(null);
      try {
        const result = await submitJousturMove(matchId, {
          cardId,
          activateSupport,
          supportTargetCardId,
        });
        setMatch(result.match);
        setRollResult(null);
        setDiceResults(null);
        setLegalMoves([]);
        setCanActivateSupport({ canActivate: false, reason: null });
        setSideRouteTarget("");
        if (result.winner) {
          navigate(`/joustur/result/${matchId}`);
          return;
        }
        // Summarise the most recent event for the player.
        const ev = result.events?.[result.events.length - 1] as Record<string, unknown> | undefined;
        if (ev?.type === "capture") { setLastEvent({ message: "🎯 Captured an opponent rider!", tone: "ok" }); sfxJousturClashStart(); sfxJousturApplause(); }
        else if (ev?.type === "clashStarted") { setLastEvent({ message: "⚔️ Joust clash started!", tone: "ok" }); sfxJousturClashStart(); }
        else if (ev?.type === "exit") { setLastEvent({ message: "⚡ Rider scored!", tone: "ok" }); sfxJousturRiderScored(); sfxJousturApplause(); }
        else if (ev?.type === "stealthAlcove") { setLastEvent({ message: "🔒 Stealth Alcove — extra turn!", tone: "ok" }); sfxJousturStealthAlcove(); sfxJousturApplause(); }
        else { setLastEvent(null); sfxJousturMove(); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Move failed.");
      } finally {
        setMoving(false);
      }
    },
    [matchId, moving, navigate],
  );

  const handlePass = () => handleMove(null, false);
  const handleActivateSupport = (targetCardId?: string) =>
    handleMove(null, true, targetCardId);
  const handleClashSubmit = useCallback(
    async (score: number) => {
      if (!matchId || clashing) return;
      setShowMoveHints(false);
      setClashing(true);
      setError(null);
      try {
        const result = await submitJousturClashChoice(matchId, { score });
        const resolvedEvent = result.events?.find(isClashResolvedEvent);
        if (resolvedEvent?.winnerUid) {
          const cinematic = buildClashCinematicState(match, activeClash, resolvedEvent, myUid);
          if (cinematic) setClashCinematic(cinematic);
          if (resolvedEvent.winnerUid === myUid) {
            sfxJousturClashWin();
            sfxJousturApplause();
          } else {
            sfxJousturClashLoss();
            sfxJousturBoo();
          }
          setLastEvent({
            message: resolvedEvent.winnerUid === myUid ? "⚔️ You won the joust clash!" : "💥 You lost the joust clash.",
            tone: resolvedEvent.winnerUid === myUid ? "clash-win" : "clash-loss",
          });
        } else {
          setLastEvent({ message: "⚔️ Score locked — waiting for your rival.", tone: "ok" });
        }
        setMatch(result.match);
        if (result.winner) {
          if (resolvedEvent?.winnerUid) {
            setPendingResultRoute(`/joustur/result/${matchId}`);
          } else {
            navigate(`/joustur/result/${matchId}`);
          }
        }
      } catch (e) {
        // Allow the player to replay the mini-game on a failed submission.
        setClashAttempt((attempt) => attempt + 1);
        setError(e instanceof Error ? e.message : "Clash mini-game failed.");
      } finally {
        setClashing(false);
      }
    },
    [activeClash, clashing, match, matchId, myUid, navigate],
  );

  const registerMoveIntent = useCallback(() => {
    setShowMoveHints(false);
    setHintCycle((value) => value + 1);
  }, []);
  const hasHintableAction =
    isMyTurn &&
    rollPending &&
    (legalMoves.length > 0 || canActivateSupport.canActivate);

  useEffect(() => {
    if (!hasHintableAction || activeClash !== null || moving || rolling) {
      setShowMoveHints(false);
      return;
    }
    setShowMoveHints(false);
    const timer = window.setTimeout(() => setShowMoveHints(true), MOVE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [
    activeClash,
    hasHintableAction,
    hintCycle,
    moving,
    rolling,
    match?.board.turn,
  ]);

  if (loading) return <div className="page joustur-board"><p>Loading match…</p></div>;
  if (!match) return <div className="page joustur-board"><p>{error ?? "Match not found."}</p></div>;

  // P0-A: Guard against matches still in 'initializing' state (null player states).
  if (!match.challengerState || !match.defenderState) {
    return (
      <div className="page joustur-board">
        <p>Match is being set up — please wait a moment and refresh.</p>
        <button type="button" className="btn-outline btn-sm" onClick={loadMatch}>
          Refresh
        </button>
      </div>
    );
  }

  const isChallenger = match.challengerUid === myUid;
  const myState       = isChallenger ? match.challengerState : match.defenderState;
  const oppState      = isChallenger ? match.defenderState   : match.challengerState;

  const myLegalMoves = isMyTurn && rollPending ? legalMoves : [];
  const prioritizedMoves = [...myLegalMoves].sort(compareMovePriority);
  const suggestedMove = prioritizedMoves[0] ?? null;
  const suggestedCardId = showMoveHints ? suggestedMove?.cardId ?? null : null;
  const suggestedSnapshot = suggestedMove
    ? myState.lineup.find((snapshot) => snapshot.cardId === suggestedMove.cardId)
    : null;
  const hintBanner = showMoveHints
    ? suggestedMove
      ? `Need a nudge? ${describeMoveHint(suggestedMove, suggestedSnapshot?.name ?? "This rider")}`
      : canActivateSupport.canActivate
        ? `Need a nudge? ${describeSupportHint(myState.support.supportEffect)}`
        : null
    : null;
  const boardHelperText = showMoveHints
    ? suggestedMove
      ? "Hover or focus a glowing rider for a move tooltip."
      : canActivateSupport.canActivate
        ? "Support is your best play right now."
        : null
    : rollPending && isMyTurn
      ? "Click a glowing rider to move instantly, or drag it forward and release once it clearly reaches the lane."
      : null;
  const clashMiniGameLabel = activeClash?.miniGame
    ? CLASH_MINI_GAME_LABELS[activeClash.miniGame]
    : "mini-game";
  const turnInstruction = activeClash
    ? `Win the ${clashMiniGameLabel} to take the tile. Highest score wins; the defender holds on a tie.`
    : isMyTurn
      ? rollPending
        ? "Your support card can replace a move once per match if it helps more than pushing a rider."
        : "Roll 3 USB Shards. A roll of 0 becomes a 4-tile burst, and you need an exact result to score."
      : "Joustur Skatur™ is async, so your opponent can take their turn whenever they next log in.";

  const clashAttacker = activeClash
    ? (activeClash.attackerUid === myState.uid ? myState : oppState)
    : null;
  const clashDefender = activeClash
    ? (activeClash.defenderUid === myState.uid ? myState : oppState)
    : null;
  const clashAttackerName = activeClash
    ? clashAttacker?.lineup.find((snapshot) => snapshot.cardId === activeClash.attackerCardId)?.name ?? "Attacker"
    : "";
  const clashDefenderName = activeClash
    ? clashDefender?.lineup.find((snapshot) => snapshot.cardId === activeClash.defenderCardId)?.name ?? "Defender"
    : "";
  const clashStatus = activeClash
    ? myClashSubmitted
      ? opponentClashChoiceLocked
        ? "Reveal incoming…"
        : "Your score is locked. Waiting for the other rider."
      : myClashRole
        ? `Play the ${clashMiniGameLabel}!`
        : "A joust clash is underway."
    : null;

  return (
    <div className="page joustur-board">
      {clashCinematic && <ClashCinematicOverlay cinematic={clashCinematic} onDismiss={() => setClashCinematic(null)} />}
      <button
        type="button"
        className="btn-outline btn-sm page-back-btn"
        onClick={() => navigate("/joustur")}
      >
        ← Back
      </button>
      <p className="page-eyebrow">Joustur Skatur™</p>
      <h1 className="page-title">
        {JOUSTUR_FACTION_LABELS[myState.faction] ?? myState.faction}
        {" vs "}
        {JOUSTUR_FACTION_LABELS[oppState.faction] ?? oppState.faction}
      </h1>

      {error && (
        <div className="status-banner status-banner--error" role="alert">
          {error}
        </div>
      )}
      {lastEvent && (
        <div className={`status-banner status-banner--${lastEvent.tone}`} role="status" aria-live="polite">
          {lastEvent.message}
        </div>
      )}

      <div className="joustur-board__status">
        {activeClash
          ? "⚔️ Joust clash active"
          : isMyTurn
          ? rollPending
            ? "🎯 Pick a rider to move"
            : "🎲 Your turn — roll dice"
          : "⏳ Waiting for opponent…"}
      </div>
      <p className="joustur-board__status-note">{turnInstruction}</p>
      {hintBanner && (
        <div className="joustur-board__hint-banner" role="status" aria-live="polite">
          {hintBanner}
        </div>
      )}

      {activeClash && (
        <section className="joustur-board__clash-panel" aria-label="Active joust clash">
          <div className="joustur-board__clash-header">
            <h2>⚔️ Joust Clash — tile {activeClash.tile}</h2>
            <p>
              {clashAttackerName} challenges {clashDefenderName}.
            </p>
          </div>
          <div className="joustur-board__clash-meta">
            <span>
              Mini-game: <strong>{clashMiniGameLabel}</strong>
            </span>
            <span>
              You: <strong>{myClashSubmitted ? "Locked in" : "Playing…"}</strong>
            </span>
            <span>
              Opponent: <strong>{opponentClashChoiceLocked ? "Locked in" : "Playing…"}</strong>
            </span>
          </div>
          {clashStatus && <p className="joustur-board__clash-status">{clashStatus}</p>}
          {myClashRole && !myClashSubmitted && activeClash.miniGame && (
            <ClashMiniGame
              key={`${activeClash.miniGame}-${clashAttempt}`}
              miniGame={activeClash.miniGame}
              disabled={clashing}
              onComplete={handleClashSubmit}
            />
          )}
        </section>
      )}

      {/* Opponent's last dice roll — visible when waiting for opponent */}
      {!activeClash && !isMyTurn && match.board.lastDiceResults && match.board.lastRollPlayerUid && (
        <div className="joustur-board__roll-area joustur-board__roll-area--opponent">
          <p className="joustur-board__opponent-roll-label">
            Opponent rolled: {match.board.lastRollResult === 0 ? "0 → Move 4!" : match.board.lastRollResult}
          </p>
          <CyberpunkD4Dice
            rolling={false}
            result={match.board.lastRollResult}
            dice={match.board.lastDiceResults}
            onRoll={() => {}}
            disabled
            displayOnly
          />
        </div>
      )}

      {/* Animated d4 dice — shown whenever it is the active player's turn */}
      {!activeClash && isMyTurn && (
        <div className="joustur-board__roll-area">
          <CyberpunkD4Dice
            rolling={rolling}
            result={rollPending && !rolling ? (rollResult ?? match.board.rollResult) : null}
            dice={rollPending && !rolling ? (diceResults ?? match.board.diceResults ?? null) : null}
            onRoll={handleRoll}
            disabled={rolling}
          />
        </div>
      )}

      {/* Pass button — only when roll is pending AND there are truly no legal
          moves and support cannot be activated. */}
      {!activeClash && isMyTurn && rollPending && myLegalMoves.length === 0 && !canActivateSupport.canActivate && (
        <div className="joustur-board__roll-area">
          <p className="joustur-board__no-moves">No legal moves — you must pass.</p>
          <button
            type="button"
            className="btn-outline"
            onClick={handlePass}
            disabled={moving}
          >
            {moving ? "Passing…" : "Pass Turn"}
          </button>
        </div>
      )}

      {/* Board panels */}
      <VisualBoard
        myState={myState}
        oppState={oppState}
        clash={activeClash}
        myLegalMoves={myLegalMoves}
        moving={moving || clashing}
        showMoveHints={showMoveHints}
        suggestedCardId={suggestedCardId}
        helperText={boardHelperText}
        onSelectRider={(cardId) => handleMove(cardId, false)}
        onUserIntent={registerMoveIntent}
      />

      <div className="joustur-board__panels">
        <PlayerPanel
          label="You"
          player={myState}
          isMe
          isActive={isMyTurn}
          legalMoves={myLegalMoves}
          canActivateSupport={isMyTurn && rollPending && !activeClash ? canActivateSupport : { canActivate: false, reason: null }}
          showMoveHints={showMoveHints}
          sideRouteTarget={sideRouteTarget}
          onSideRouteTargetChange={setSideRouteTarget}
          onSelectRider={(cardId) => handleMove(cardId, false)}
          onActivateSupport={handleActivateSupport}
        />
        <PlayerPanel
          label={match.mode === "solo" ? "House Bot" : "Opponent"}
          player={oppState}
          isMe={false}
          isActive={!isMyTurn}
          legalMoves={[]}
          canActivateSupport={{ canActivate: false, reason: null }}
          showMoveHints={false}
          sideRouteTarget=""
          onSideRouteTargetChange={() => {}}
          onSelectRider={() => {}}
          onActivateSupport={() => {}}
        />
      </div>

      <div className="joustur-board__footer">
        <p className="joustur-board__turn-info">
          Turn {match.board.turn} ·{" "}
          {match.mode === "friend" ? "👥 Friend match" : "🎮 Casual match"}
        </p>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={toggleSoundtrack}
          aria-label={soundtrackPlaying ? "Mute soundtrack" : "Play soundtrack"}
        >
          {soundtrackPlaying ? "🔊 Music On" : "🔇 Music Off"}
        </button>
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={() => navigate("/joustur")}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
