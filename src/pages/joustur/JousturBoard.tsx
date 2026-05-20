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
  JousturRiderRuntimeState,
} from "../../lib/jousturTypes";
import { JOUSTUR_FACTION_LABELS } from "../../lib/jousturTypes";

const STEALTH_ALCOVES = new Set([4, 6, 8, 12, 14]);

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

function PlayerPanel({
  player,
  isMe,
  isActive,
  legalMoves,
  canActivateSupport,
  onSelectRider,
  onActivateSupport,
}: {
  player: JousturPlayerState;
  isMe: boolean;
  isActive: boolean;
  legalMoves: JousturLegalMove[];
  canActivateSupport: boolean;
  onSelectRider: (cardId: string) => void;
  onActivateSupport: (targetCardId?: string) => void;
}) {
  const legalSet = new Set(legalMoves.map((m) => m.cardId));

  return (
    <div
      className={`joustur-board__player${isMe ? " joustur-board__player--me" : ""}${isActive ? " joustur-board__player--active" : ""}`}
    >
      <h3 className="joustur-board__player-name">
        {isMe ? "You" : "Opponent"}
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
      {isMe && isActive && canActivateSupport && !player.supportRuntime.activated && (
        <div className="joustur-board__support">
          <p className="joustur-board__support-name">
            Support: {player.support.name}{" "}
            <span className="joustur-board__support-effect">
              ({player.support.supportEffect})
            </span>
          </p>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => onActivateSupport()}
          >
            Activate Support
          </button>
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
  const [canActivateSupport, setCanActivateSupport] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  const loadMatch = useCallback(async () => {
    if (!matchId) return;
    try {
      const m = await getJousturMatch(matchId);
      setMatch(m);
      if (m.status !== "active") navigate(`/joustur/result/${matchId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load match.");
    } finally {
      setLoading(false);
    }
  }, [matchId, navigate]);

  useEffect(() => {
    loadMatch();
    // Poll every 15 s, but only while the tab is visible to avoid wasting
    // network requests and Firebase quota when the player is elsewhere.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadMatch();
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadMatch]);

  const myUid = user?.uid ?? "";
  const isMyTurn = match?.board.activePlayerUid === myUid;
  const rollPending = match?.board.rollResult !== null || rollResult !== null;

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
        setCanActivateSupport(false);
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

      {/* Pass button (roll = 0 with no legal moves) */}
      {isMyTurn && rollPending && myLegalMoves.length === 0 && !canActivateSupport && (
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
      <div className="joustur-board__panels">
        <PlayerPanel
          player={myState}
          isMe
          isActive={isMyTurn}
          legalMoves={myLegalMoves}
          canActivateSupport={isMyTurn && rollPending ? canActivateSupport : false}
          onSelectRider={(cardId) => handleMove(cardId, false)}
          onActivateSupport={handleActivateSupport}
        />
        <PlayerPanel
          player={oppState}
          isMe={false}
          isActive={!isMyTurn}
          legalMoves={[]}
          canActivateSupport={false}
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
