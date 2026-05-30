/**
 * JousturResult.tsx — Post-match result screen.
 *
 * Shows winner, both players' scores, and offers navigation back to Joustur hub.
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getJousturMatch } from "../../services/joustur";
import type { JousturMatch } from "../../lib/jousturTypes";
import { JOUSTUR_FACTION_LABELS } from "../../lib/jousturTypes";
import { sfxJousturVictory, sfxJousturDefeat, sfxJousturApplause, sfxJousturBoo } from "../../lib/sfx";

export function JousturResult() {
  const { id: matchId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [match, setMatch] = useState<JousturMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    getJousturMatch(matchId)
      .then((m) => {
        setMatch(m);
        // If the match is still active, redirect to the board.
        if (m.status === "active") navigate(`/joustur/match/${matchId}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load match."))
      .finally(() => setLoading(false));
  }, [matchId, navigate]);

  if (loading) return <div className="page joustur-result"><p>Loading result…</p></div>;
  if (!match) return <div className="page joustur-result"><p>{error ?? "Match not found."}</p></div>;

  // P0-A: Guard against matches still initializing (null player states).
  if (!match.challengerState || !match.defenderState) {
    return (
      <div className="page joustur-result">
        <p>Match is still being set up — please try again in a moment.</p>
        <button type="button" className="btn-outline btn-sm" onClick={() => navigate("/joustur")}>
          Back
        </button>
      </div>
    );
  }

  const myUid = user?.uid ?? "";
  const didWin = match.winnerUid === myUid;
  const isChallenger = match.challengerUid === myUid;
  const myState  = isChallenger ? match.challengerState  : match.defenderState;
  const oppState = isChallenger ? match.defenderState    : match.challengerState;
  const opponentLabel = match.mode === "solo" ? "House Bot" : "Opponent";

  // Play result audio once when the page loads.
  const audioPlayedRef = useRef(false);
  useEffect(() => {
    if (audioPlayedRef.current) return;
    audioPlayedRef.current = true;
    if (didWin) {
      sfxJousturVictory();
      setTimeout(() => sfxJousturApplause(), 300);
    } else if (match.winnerUid) {
      sfxJousturDefeat();
      setTimeout(() => sfxJousturBoo(), 200);
    }
  }, [didWin, match.winnerUid]);

  return (
    <div className="page joustur-result">
      <p className="page-eyebrow">Joustur Skatur™</p>

      <div className={`joustur-result__banner ${didWin ? "joustur-result__banner--win" : "joustur-result__banner--loss"}`}>
        {didWin ? "⚡ Victory!" : match.winnerUid ? "💀 Defeated" : "— Draw —"}
      </div>

      <h1 className="joustur-result__title">
        {JOUSTUR_FACTION_LABELS[myState.faction] ?? myState.faction}
        {" vs "}
        {JOUSTUR_FACTION_LABELS[oppState.faction] ?? oppState.faction}
      </h1>

      <div className="joustur-result__scores">
        <div className={`joustur-result__score-card${didWin ? " joustur-result__score-card--winner" : ""}`}>
          <p className="joustur-result__score-label">You</p>
          <p className="joustur-result__score-value">{myState.scoredCount} / 6</p>
          <p className="joustur-result__score-faction">
            {JOUSTUR_FACTION_LABELS[myState.faction] ?? myState.faction}
          </p>
        </div>
        <div className="joustur-result__score-vs">vs</div>
        <div className={`joustur-result__score-card${!didWin && match.winnerUid ? " joustur-result__score-card--winner" : ""}`}>
          <p className="joustur-result__score-label">{opponentLabel}</p>
          <p className="joustur-result__score-value">{oppState.scoredCount} / 6</p>
          <p className="joustur-result__score-faction">
            {JOUSTUR_FACTION_LABELS[oppState.faction] ?? oppState.faction}
          </p>
        </div>
      </div>

      {match.rewardsGranted && (
        <p className="joustur-result__rewards-note">
          🎁 Rewards have been added to your profile.
        </p>
      )}

      <div className="joustur-result__actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate("/joustur")}
        >
          Play Again
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/forge")}
        >
          Back to Forge
        </button>
      </div>
    </div>
  );
}
