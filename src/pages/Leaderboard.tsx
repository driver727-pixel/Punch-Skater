import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useDecks } from "../hooks/useDecks";
import { formatStatLabel } from "../lib/battle";
import {
  ACTIVE_LEADERBOARD_SEASON,
  SEASONAL_FAIR_PLAY_RULES,
  SEASONAL_REWARD_TIERS,
} from "../lib/seasonalLeaderboard";
import { sfxSuccess, sfxClick } from "../lib/sfx";

export function Leaderboard() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { entries, uploadDeck, uploading, myEntry } = useLeaderboard();
  const { decks } = useDecks();
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState("");

  const eligibleDecks = decks.filter((d) => d.cards.length === 6);

  return (
    <div className="page">
      <h1 className="page-title">Leaderboard</h1>
      <p className="page-sub">Season {ACTIVE_LEADERBOARD_SEASON.label} — Neon Underground Rankings</p>

      <div className="leaderboard-header">
        <p className="market-desc">
          Submit a 6-card Crew for <strong>{ACTIVE_LEADERBOARD_SEASON.label}</strong>. Seasonal rank uses current Deck Power only,
          while lifetime progress still tracks Crew XP and Ozzies separately.
        </p>
        <div className="leaderboard-rules">
          <div>
            <strong>Fair rewards:</strong>{" "}
            {SEASONAL_REWARD_TIERS.map((tier) => tier.label).join(" · ")}
          </div>
          <div>
            <strong>Anti-abuse:</strong> {SEASONAL_FAIR_PLAY_RULES.join(" ")}
          </div>
        </div>
      </div>

      {uid && (
        <div className="leaderboard-upload-section">
          <h3 className="leaderboard-upload-title">Submit Your Seasonal Crew</h3>
          {eligibleDecks.length === 0 ? (
            <p className="trade-helper-text">Build a deck with exactly 6 unique cards to participate.</p>
          ) : (
            <>
              <div className="leaderboard-deck-picker">
                {eligibleDecks.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    className={`arena-deck-option ${selectedDeckId === deck.id ? "arena-deck-option--active" : ""}`}
                    onClick={() => { sfxClick(); setSelectedDeckId(deck.id); setUploadSuccess(false); }}
                  >
                    <span className="arena-deck-option-name">{deck.name}</span>
                    <span className="arena-deck-option-count">{deck.cards.length} cards</span>
                  </button>
                ))}
              </div>
              <button
                className="btn-primary leaderboard-upload-btn"
                disabled={uploading || !selectedDeckId}
                onClick={async () => {
                  const deck = decks.find((d) => d.id === selectedDeckId);
                  if (!deck) return;
                  setUploadSuccess(false);
                  setError("");
                  try {
                    await uploadDeck(deck);
                    sfxSuccess();
                    setUploadSuccess(true);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to upload deck.");
                  }
                }}
              >
                {uploading ? "⏳ Uploading…" : "🏆 Submit Seasonal Crew"}
              </button>
              {error && <p className="login-error">{error}</p>}
              {uploadSuccess && (
                <p className="leaderboard-success">Your server-verified seasonal entry has been submitted! 🎉</p>
              )}
            </>
          )}
        </div>
      )}

      {myEntry && (
        <div className="leaderboard-my-entry">
          <span className="leaderboard-my-entry-label">Your entry:</span>
          <strong>{myEntry.deckName}</strong> · Seasonal score {myEntry.seasonalRankScore ?? myEntry.deckPower} ·{" "}
          Lifetime score {myEntry.leaderboardScore ?? myEntry.deckPower} ·{" "}
          🎯 {formatStatLabel(myEntry.strongestStat)} {myEntry.strongestStatTotal} ·{" "}
          🤝 +{myEntry.synergyBonusPct}%
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏆</span>
          <p>No seasonal entries yet. Be the first to submit a verified 6-card Crew!</p>
        </div>
      ) : (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th className="leaderboard-th">#</th>
                <th className="leaderboard-th">Player</th>
                <th className="leaderboard-th">Deck</th>
                <th className="leaderboard-th">Cards</th>
                <th className="leaderboard-th">Season Score</th>
                <th className="leaderboard-th">Lifetime</th>
                <th className="leaderboard-th">Best Stat</th>
                <th className="leaderboard-th">Synergy</th>
                <th className="leaderboard-th">Reward Track</th>
                <th className="leaderboard-th">Archetype</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.uid}
                  className={`leaderboard-row ${entry.uid === uid ? "leaderboard-row--me" : ""}`}
                >
                  <td className="leaderboard-td leaderboard-rank">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                  </td>
                  <td className="leaderboard-td leaderboard-player">{entry.displayName}</td>
                  <td className="leaderboard-td">{entry.deckName}</td>
                  <td className="leaderboard-td leaderboard-center">{entry.cardCount}</td>
                  <td className="leaderboard-td leaderboard-power">{entry.seasonalRankScore ?? entry.deckPower}</td>
                  <td className="leaderboard-td leaderboard-ozzies">{entry.leaderboardScore ?? entry.deckPower}</td>
                  <td className="leaderboard-td">
                    {formatStatLabel(entry.strongestStat)} {entry.strongestStatTotal}
                  </td>
                  <td className="leaderboard-td leaderboard-center">+{entry.synergyBonusPct}%</td>
                  <td className="leaderboard-td leaderboard-center">
                    {(entry.projectedRewardTierIds ?? ["participation"]).length} tiers
                  </td>
                  <td className="leaderboard-td leaderboard-archetype">{entry.archetypeHint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
