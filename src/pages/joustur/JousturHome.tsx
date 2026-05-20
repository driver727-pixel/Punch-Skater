/**
 * JousturHome.tsx — Hub page for Joustur Skatur.
 *
 * Shows active matches, pending challenges, and quick-action buttons
 * (Challenge a Friend, Find Casual Match, View Rules, Build Lineup).
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listJousturMatches, enqueueJoustur, dequeueJoustur } from "../../services/joustur";
import { useJousturLineup } from "../../hooks/useJousturLineup";
import type { JousturMatch } from "../../lib/jousturTypes";
import { JOUSTUR_FACTION_LABELS } from "../../lib/jousturTypes";

function matchStatusLabel(match: JousturMatch, myUid: string): string {
  if (match.status === "completed") {
    return match.winnerUid === myUid ? "⚡ You won!" : "💀 Defeated";
  }
  if (match.board.activePlayerUid === myUid) return "🎲 Your turn";
  return "⏳ Waiting";
}

export function JousturHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lineup } = useJousturLineup();
  const [matches, setMatches] = useState<JousturMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingMatches(true);
    listJousturMatches()
      .then(setMatches)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMatches(false));
  }, [user]);

  const handleQueue = async () => {
    if (!lineup) { setError("Build and save a lineup first."); return; }
    setError(null);
    setQueueing(true);
    try {
      const result = await enqueueJoustur();
      if (!result.queued && "match" in result) {
        navigate(`/joustur/match/${result.match.id}`);
      } else {
        setInQueue(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue.");
    } finally {
      setQueueing(false);
    }
  };

  const handleLeaveQueue = async () => {
    setQueueing(true);
    try { await dequeueJoustur(); setInQueue(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to leave queue."); }
    finally { setQueueing(false); }
  };

  const activeMatches  = matches.filter((m) => m.status === "active");
  const pastMatches    = matches.filter((m) => m.status !== "active").slice(0, 5);

  return (
    <div className="page joustur-home">
      <p className="page-eyebrow">Game Mode</p>
      <h1 className="page-title">Joustur Skatur</h1>
      <p className="page-sub">
        An async board game for couriers. Race your crew of 6 riders to the finish.
        Roll USB Shards. Capture opponents. Hit a Stealth Alcove for an extra turn.
      </p>

      {error && (
        <div className="status-banner status-banner--error" role="alert">
          {error}
        </div>
      )}

      {/* Quick actions */}
      <div className="joustur-home__actions">
        {!lineup ? (
          <Link to="/joustur/lineup" className="btn-primary">
            Build Your Lineup
          </Link>
        ) : (
          <Link to="/joustur/lineup" className="btn-outline btn-sm">
            ✏ Edit Lineup
          </Link>
        )}

        {inQueue ? (
          <button
            type="button"
            className="btn-outline"
            onClick={handleLeaveQueue}
            disabled={queueing}
          >
            {queueing ? "Leaving…" : "⏳ In Queue — Cancel"}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleQueue}
            disabled={queueing || !lineup}
            title={!lineup ? "Save a lineup first" : undefined}
          >
            {queueing ? "Searching…" : "⚡ Find Casual Match"}
          </button>
        )}

        <Link to="/joustur/rules" className="btn-outline btn-sm">
          📖 Rules
        </Link>
      </div>

      {/* Active matches */}
      {loadingMatches ? (
        <p className="joustur-home__loading">Loading matches…</p>
      ) : activeMatches.length > 0 ? (
        <section className="joustur-home__section">
          <h2 className="joustur-home__section-title">Active Matches</h2>
          <ul className="joustur-home__match-list">
            {activeMatches.map((m) => (
              <li key={m.id} className="joustur-home__match-card">
                <div className="joustur-home__match-meta">
                  <span className="joustur-home__match-mode">
                    {m.mode === "friend" ? "👥 Friend" : "🎮 Casual"}
                  </span>
                  <span className="joustur-home__match-status">
                    {matchStatusLabel(m, user?.uid ?? "")}
                  </span>
                </div>
                <div className="joustur-home__match-factions">
                  <span>
                    {JOUSTUR_FACTION_LABELS[m.challengerState.faction] ?? m.challengerState.faction}
                  </span>
                  <span className="joustur-home__match-vs">vs</span>
                  <span>
                    {JOUSTUR_FACTION_LABELS[m.defenderState.faction] ?? m.defenderState.faction}
                  </span>
                </div>
                <div className="joustur-home__match-score">
                  {m.challengerState.scoredCount} / 6
                  <span className="joustur-home__match-vs">–</span>
                  {m.defenderState.scoredCount} / 6
                </div>
                <Link
                  to={`/joustur/match/${m.id}`}
                  className="btn-primary btn-sm joustur-home__match-cta"
                >
                  {m.board.activePlayerUid === user?.uid ? "Take Turn →" : "View Board →"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="joustur-home__empty">No active matches. Start one above!</p>
      )}

      {/* Past matches */}
      {pastMatches.length > 0 && (
        <section className="joustur-home__section">
          <h2 className="joustur-home__section-title">Recent Results</h2>
          <ul className="joustur-home__match-list joustur-home__match-list--past">
            {pastMatches.map((m) => (
              <li key={m.id} className="joustur-home__match-card joustur-home__match-card--past">
                <span className="joustur-home__match-status">
                  {matchStatusLabel(m, user?.uid ?? "")}
                </span>
                <span>
                  {JOUSTUR_FACTION_LABELS[m.challengerState.faction] ?? m.challengerState.faction}
                  {" vs "}
                  {JOUSTUR_FACTION_LABELS[m.defenderState.faction] ?? m.defenderState.faction}
                </span>
                <Link to={`/joustur/result/${m.id}`} className="btn-outline btn-sm">
                  View →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
