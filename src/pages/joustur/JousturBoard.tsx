/**
 * JousturBoard.tsx — Async game board for an active Joustur Skatur match.
 *
 * Turn flow:
 *   1. Active player clicks "Roll USB Shards" → rolls are fetched from server.
 *   2. Active player clicks a legal rider (or activates support).
 *   3. Server applies the move; board state refreshes.
 *
 * Non-active players see the board in read-only mode.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getJousturMatch,
  rollJousturShards,
  submitJousturMove,
} from "../../services/joustur";
import type {
  JousturMatch,
  JousturLegalMove,
  JousturPlayerState,
  JousturRiderSnapshot,
  JousturRiderRuntimeState,
} from "../../lib/jousturTypes";
import { JOUSTUR_FACTION_LABELS } from "../../lib/jousturTypes";

const JOUSTUR_BOARD_IMAGE_URL = "/assets/joustur/joustur-board.png";
const STEALTH_ALCOVES = new Set([4, 6, 8, 12, 14]);
const PRIVATE_ENTRY_MIN = 1;
const PRIVATE_ENTRY_MAX = 4;
const EXIT_POSITION = 15;
type BoardSide = "top" | "bottom";

interface BoardPoint {
  x: number;
  y: number;
}

const BOARD_COLUMNS = [18.5, 27.6, 36.7, 45.8, 54.9, 64, 73.1, 82.2] as const;
const BOARD_ROWS: Record<BoardSide | "shared", number> = {
  top: 28.5,
  shared: 50.4,
  bottom: 72.3,
};

function getBoardPoint(position: number, side: BoardSide): BoardPoint {
  if (position === 0) {
    return { x: 7.5, y: BOARD_ROWS[side] };
  }
  if (position === EXIT_POSITION) {
    return { x: 92.5, y: BOARD_ROWS[side] };
  }
  if (position >= 1 && position <= 4) {
    return { x: BOARD_COLUMNS[position - 1], y: BOARD_ROWS[side] };
  }
  if (position >= 5 && position <= 12) {
    return { x: BOARD_COLUMNS[position - 5], y: BOARD_ROWS.shared };
  }
  if (position >= 13 && position <= 14) {
    return { x: BOARD_COLUMNS[position - 7], y: BOARD_ROWS[side] };
  }
  return { x: 50, y: BOARD_ROWS[side] };
}

function getStackOffset(index: number, total: number): BoardPoint {
  if (total <= 1) return { x: 0, y: 0 };
  const spread = Math.min(2.4, 8 / total);
  return {
    x: (index - (total - 1) / 2) * spread,
    y: index % 2 === 0 ? -0.75 : 0.75,
  };
}

const POS_LABELS: Record<number, string> = {
  0: "Off board",
  15: "Scored",
};

function posLabel(pos: number): string {
  if (POS_LABELS[pos]) return POS_LABELS[pos];
  if (pos >= 1 && pos <= 4) return `Entry ${pos}`;
  if (pos >= 5 && pos <= 12) return `Shared ${pos}${STEALTH_ALCOVES.has(pos) ? " ⚡" : ""}`;
  if (pos >= 13 && pos <= 14) return `Exit ${pos}${STEALTH_ALCOVES.has(pos) ? " ⚡" : ""}`;
  return `${pos}`;
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
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="joustur-board-piece__owner">{ownerLabel}</span>
    </span>
  );
}

function VisualBoard({
  myState,
  oppState,
  myLegalMoves,
  isMyTurn,
  rollPending,
  moving,
  onSelectRider,
}: {
  myState: JousturPlayerState;
  oppState: JousturPlayerState;
  myLegalMoves: JousturLegalMove[];
  isMyTurn: boolean;
  rollPending: boolean;
  moving: boolean;
  onSelectRider: (cardId: string) => void;
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
      const key = `${player.side}:${rider.position}`;
      stackCounts.set(key, (stackCounts.get(key) ?? 0) + 1);
    }
  }

  return (
    <section className="joustur-visual-board" aria-label="Joustur gameplay board">
      <div className="joustur-visual-board__frame">
        <img
          src={JOUSTUR_BOARD_IMAGE_URL}
          alt="Joustur gameplay board with numbered movement tiles"
          className="joustur-visual-board__image"
          loading="eager"
          decoding="async"
        />

        {Array.from({ length: 14 }, (_, i) => i + 1).map((position) => {
          const point = getBoardPoint(position, "bottom");
          return (
            <span
              key={position}
              className={`joustur-visual-board__snap${STEALTH_ALCOVES.has(position) ? " joustur-visual-board__snap--alcove" : ""}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              aria-hidden="true"
            />
          );
        })}

        {isMyTurn && rollPending && myLegalMoves.map((move) => {
          const target = getBoardPoint(move.toPosition, "bottom");
          return (
            <button
              key={`${move.cardId}-${move.toPosition}`}
              type="button"
              className={`joustur-visual-board__move-target${move.wouldCapture ? " joustur-visual-board__move-target--capture" : ""}${move.isExitMove ? " joustur-visual-board__move-target--exit" : ""}`}
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              onClick={() => onSelectRider(move.cardId)}
              disabled={moving}
              aria-label={`Move ${move.cardId} to ${posLabel(move.toPosition)}`}
              title={`Move to ${posLabel(move.toPosition)}${move.wouldCapture ? " and capture" : ""}`}
            />
          );
        })}

        {players.flatMap((player) =>
          player.state.riders.map((rider) => {
            const key = `${player.side}:${rider.position}`;
            const stackIndex = stackIndexes.get(key) ?? 0;
            stackIndexes.set(key, stackIndex + 1);
            const stackTotal = stackCounts.get(key) ?? 1;
            const point = getBoardPoint(rider.position, player.side);
            const offset = getStackOffset(stackIndex, stackTotal);
            const legalMove = player.side === "bottom" ? legalMoveByCardId.get(rider.cardId) : undefined;
            const isLegal = Boolean(legalMove);
            const snapshot = snapshotByCardId.get(rider.cardId);
            return (
              <button
                key={`${player.side}-${rider.cardId}`}
                type="button"
                className={`joustur-board-piece joustur-board-piece--${player.side}${rider.isScored ? " joustur-board-piece--scored" : ""}${rider.isCaptured ? " joustur-board-piece--captured" : ""}${isLegal ? " joustur-board-piece--legal" : ""}`}
                style={{
                  left: `${point.x + offset.x}%`,
                  top: `${point.y + offset.y}%`,
                }}
                disabled={!isLegal || moving}
                onClick={() => isLegal && onSelectRider(rider.cardId)}
                aria-label={`${player.label} ${snapshot?.name ?? rider.cardId} at ${posLabel(rider.position)}${isLegal && legalMove ? `, legal move to ${posLabel(legalMove.toPosition)}` : ""}`}
                title={`${snapshot?.name ?? rider.cardId} · ${posLabel(rider.position)}`}
              >
                <RiderCardPiece snapshot={snapshot} ownerLabel={player.label === "You" ? "YOU" : "OPP"} />
              </button>
            );
          }),
        )}
      </div>
      <div className="joustur-visual-board__legend">
        <span><i className="joustur-visual-board__legend-dot" aria-hidden="true" /> Snap tile center</span>
        <span><i className="joustur-visual-board__legend-dot joustur-visual-board__legend-dot--alcove" aria-hidden="true" /> Stealth Alcove</span>
        <span><i className="joustur-visual-board__legend-dot joustur-visual-board__legend-dot--move" aria-hidden="true" /> Legal destination</span>
      </div>
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
                {posLabel(rider.position)}
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
                >
                  Activate SideRoute
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => onActivateSupport()}
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

  const [match, setMatch] = useState<JousturMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [moving, setMoving] = useState(false);
  const [legalMoves, setLegalMoves] = useState<JousturLegalMove[]>([]);
  const [canActivateSupport, setCanActivateSupport] = useState<{
    canActivate: boolean;
    reason: string | null;
  }>({ canActivate: false, reason: null });
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
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
      // P1-A: Hydrate legal moves from the match response when a roll is
      // already pending (e.g. after a page reload mid-turn).
      if (
        m.board.rollResult !== null &&
        m.board.activePlayerUid === myUid &&
        m.legalMoves !== undefined &&
        m.canActivateSupport !== undefined
      ) {
        setRollResult(m.board.rollResult);
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

  const isMyTurn = match?.board.activePlayerUid === myUid;
  // rollPending: a roll has been generated AND we have the context to act on it.
  // We use either the locally cached rollResult OR the server-stored one (for
  // reloads), but only if legal moves have been hydrated — otherwise the pass
  // button would appear incorrectly before hydration completes.
  const serverRoll = match?.board.rollResult ?? null;
  const rollPending =
    (rollResult !== null || serverRoll !== null) &&
    (rollResult !== null || legalMoves.length > 0 || canActivateSupport.canActivate);

  const handleRoll = async () => {
    if (!matchId || rolling) return;
    setRolling(true);
    setError(null);
    try {
      const result = await rollJousturShards(matchId);
      setRollResult(result.roll);
      setLegalMoves(result.legalMoves);
      setCanActivateSupport(result.canActivateSupport);
      setMatch((m) => m ? { ...m, board: { ...m.board, rollResult: result.roll } } : m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Roll failed.");
    } finally {
      setRolling(false);
    }
  };

  const handleMove = useCallback(
    async (cardId: string | null, activateSupport: boolean, supportTargetCardId?: string) => {
      if (!matchId || moving) return;
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
        setLegalMoves([]);
        setCanActivateSupport({ canActivate: false, reason: null });
        setSideRouteTarget("");
        if (result.winner) {
          navigate(`/joustur/result/${matchId}`);
          return;
        }
        // Summarise the most recent event for the player.
        const ev = result.events?.[result.events.length - 1] as Record<string, unknown> | undefined;
        if (ev?.type === "capture") setLastEvent("🎯 Captured an opponent rider!");
        else if (ev?.type === "exit") setLastEvent("⚡ Rider scored!");
        else if (ev?.type === "stealthAlcove") setLastEvent("🔒 Stealth Alcove — extra turn!");
        else setLastEvent(null);
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

  return (
    <div className="page joustur-board">
      <p className="page-eyebrow">Joustur Skatur</p>
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
        <div className="status-banner status-banner--ok" role="status">
          {lastEvent}
        </div>
      )}

      <div className="joustur-board__status">
        {isMyTurn
          ? rollPending
            ? `🎲 Roll: ${rollResult ?? match.board.rollResult} — pick a rider to move`
            : "🎲 Your turn — roll the USB Shards"
          : "⏳ Waiting for opponent…"}
      </div>

      {/* Roll button */}
      {isMyTurn && !rollPending && (
        <div className="joustur-board__roll-area">
          <button
            type="button"
            className="btn-primary"
            onClick={handleRoll}
            disabled={rolling}
          >
            {rolling ? "Rolling…" : "🎲 Roll USB Shards"}
          </button>
        </div>
      )}

      {/* Pass button — only when roll is pending AND there are truly no legal
          moves and support cannot be activated. */}
      {isMyTurn && rollPending && myLegalMoves.length === 0 && !canActivateSupport.canActivate && (
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
        myLegalMoves={myLegalMoves}
        isMyTurn={isMyTurn}
        rollPending={rollPending}
        moving={moving}
        onSelectRider={(cardId) => handleMove(cardId, false)}
      />

      <div className="joustur-board__panels">
        <PlayerPanel
          label="You"
          player={myState}
          isMe
          isActive={isMyTurn}
          legalMoves={myLegalMoves}
          canActivateSupport={isMyTurn && rollPending ? canActivateSupport : { canActivate: false, reason: null }}
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
          onClick={() => navigate("/joustur")}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
