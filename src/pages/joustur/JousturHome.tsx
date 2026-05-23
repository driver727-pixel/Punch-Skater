/**
 * JousturHome.tsx — Hub page for Joustur Skatur™.
 *
 * Shows active matches, pending challenges, and quick-action buttons
 * (Challenge a Friend, Find Casual Match, View Rules, Build Lineup).
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  listJousturMatches,
  enqueueJoustur,
  dequeueJoustur,
  startSoloJousturMatch,
  listJousturChallenges,
  createJousturChallenge,
  acceptJousturChallenge,
  declineJousturChallenge,
} from "../../services/joustur";
import { useJousturLineup } from "../../hooks/useJousturLineup";
import type { JousturMatch, JousturChallenge } from "../../lib/jousturTypes";
import { JOUSTUR_FACTION_LABELS } from "../../lib/jousturTypes";

function matchStatusLabel(match: JousturMatch, myUid: string): string {
  if (match.status === "completed") {
    return match.winnerUid === myUid ? "⚡ You won!" : "💀 Defeated";
  }
  if (match.board.activePlayerUid === myUid) return "🎲 Your turn";
  return "⏳ Waiting";
}

function matchModeLabel(mode: JousturMatch["mode"]): string {
  if (mode === "friend") return "👥 Friend";
  if (mode === "solo") return "🤖 Solo";
  return "🎮 Casual";
}

export function JousturHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lineup } = useJousturLineup();
  const [matches, setMatches] = useState<JousturMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [startingSolo, setStartingSolo] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Challenge state
  const [challenges, setChallenges] = useState<{ sent: JousturChallenge[]; received: JousturChallenge[] }>({ sent: [], received: [] });
  const [challengeDefenderUid, setChallengeDefenderUid] = useState("");
  const [challengeLoading, setChallengeLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingMatches(true);
    Promise.all([
      listJousturMatches(),
      listJousturChallenges(),
    ])
      .then(([m, c]) => { setMatches(m); setChallenges(c); })
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

  const handleSoloStart = async () => {
    if (!lineup) { setError("Build and save a lineup first."); return; }
    setError(null);
    setStartingSolo(true);
    try {
      const match = await startSoloJousturMatch();
      navigate(`/joustur/match/${match.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start solo match.");
    } finally {
      setStartingSolo(false);
    }
  };

  const handleSendChallenge = async () => {
    const uid = challengeDefenderUid.trim();
    if (!uid) { setError("Enter a player UID to challenge."); return; }
    if (!lineup) { setError("Build and save a lineup first."); return; }
    setError(null);
    setChallengeLoading(true);
    try {
      await createJousturChallenge(uid);
      setChallengeDefenderUid("");
      const updated = await listJousturChallenges();
      setChallenges(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send challenge.");
    } finally {
      setChallengeLoading(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    setError(null);
    try {
      const match = await acceptJousturChallenge(challengeId);
      navigate(`/joustur/match/${match.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept challenge.");
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    setError(null);
    try {
      await declineJousturChallenge(challengeId);
      setChallenges((prev) => ({
        sent: prev.sent.filter((c) => c.id !== challengeId),
        received: prev.received.filter((c) => c.id !== challengeId),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decline challenge.");
    }
  };

  // P0-A: Only show matches with non-null player states (initializing docs are
  // filtered out server-side, but guard here as well for safety).
  const activeMatches = matches.filter(
    (m) => m.status === "active" && m.challengerState && m.defenderState,
  );
  const pastMatches = matches
    .filter((m) => m.status !== "active" && m.challengerState && m.defenderState)
    .slice(0, 5);

  return (
    <div className="page joustur-home">
      <p className="page-eyebrow">Game Mode</p>
      <h1 className="page-title">Joustur Skatur™</h1>
      <p className="page-sub">
        An async board game for couriers. Race your crew of 6 riders to the finish.
        Roll dice. Capture opponents. Hit a Stealth Alcove for an extra turn.
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
        <button
          type="button"
          className="btn-outline"
          onClick={handleSoloStart}
          disabled={startingSolo || !lineup}
          title={!lineup ? "Save a lineup first" : undefined}
        >
          {startingSolo ? "Booting…" : "🤖 Start Solo Match"}
        </button>
      </div>

      {/* Challenge a Friend */}
      <section className="joustur-home__section">
        <h2 className="joustur-home__section-title">Challenge a Friend</h2>
        <div className="joustur-home__challenge-form">
          <input
            type="text"
            className="input"
            placeholder="Player UID"
            value={challengeDefenderUid}
            onChange={(e) => setChallengeDefenderUid(e.target.value)}
            aria-label="Player UID to challenge"
          />
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={handleSendChallenge}
            disabled={challengeLoading || !lineup}
            title={!lineup ? "Save a lineup first" : undefined}
          >
            {challengeLoading ? "Sending…" : "Send Challenge"}
          </button>
        </div>

        {/* Received challenges */}
        {challenges.received.length > 0 && (
          <div className="joustur-home__challenges">
            <h3 className="joustur-home__challenges-subtitle">Received</h3>
            <ul className="joustur-home__challenge-list">
              {challenges.received.map((c) => (
                <li key={c.id} className="joustur-home__challenge-item">
                  <span>{c.challengerDisplayName || c.challengerUid} challenged you</span>
                  <div className="joustur-home__challenge-actions">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => handleAcceptChallenge(c.id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => handleDeclineChallenge(c.id)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sent challenges */}
        {challenges.sent.length > 0 && (
          <div className="joustur-home__challenges">
            <h3 className="joustur-home__challenges-subtitle">Sent</h3>
            <ul className="joustur-home__challenge-list">
              {challenges.sent.map((c) => (
                <li key={c.id} className="joustur-home__challenge-item">
                  <span>Waiting for {c.defenderDisplayName || c.defenderUid}…</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
                    {matchModeLabel(m.mode)}
                  </span>
                  <span className="joustur-home__match-status">
                    {matchStatusLabel(m, user?.uid ?? "")}
                  </span>
                </div>
                <div className="joustur-home__match-factions">
                  <span>
                    {JOUSTUR_FACTION_LABELS[m.challengerState!.faction] ?? m.challengerState!.faction}
                  </span>
                  <span className="joustur-home__match-vs">vs</span>
                  <span>
                    {JOUSTUR_FACTION_LABELS[m.defenderState!.faction] ?? m.defenderState!.faction}
                  </span>
                </div>
                <div className="joustur-home__match-score">
                  {m.challengerState!.scoredCount} / 6
                  <span className="joustur-home__match-vs">–</span>
                  {m.defenderState!.scoredCount} / 6
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
        <p className="joustur-home__empty">No active matches. Start a friend, casual, or solo game above!</p>
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
                  {JOUSTUR_FACTION_LABELS[m.challengerState!.faction] ?? m.challengerState!.faction}
                  {" vs "}
                  {JOUSTUR_FACTION_LABELS[m.defenderState!.faction] ?? m.defenderState!.faction}
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
