import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useBattle, MIN_BATTLE_CARDS } from "../hooks/useBattle";
import { useDecks } from "../hooks/useDecks";
import { useAuth } from "../context/AuthContext";
import type { ArenaDeckSummary, ArenaEntry, DeckPayload, BattleResult } from "../lib/types";
import {
  WAGER_POINTS,
  WINNER_BONUS,
  buildArenaDeckSummary,
  computeDeckScore,
  formatStatLabel,
} from "../lib/battle";
import { CardThumbnail } from "../components/CardThumbnail";
import { sfxBattleClash, sfxBattleWin, sfxBattleLose, sfxBattleReady } from "../lib/sfx";

// ── Confetti burst (simple CSS-based) ───────────────────────────────────────

function spawnConfetti(container: HTMLElement) {
  const colors = ["#00ff88", "#00ccff", "#cc44ff", "#ffdd00", "#ff6644", "#ff44aa"];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement("span");
    dot.className = "confetti-particle";
    dot.style.setProperty("--x", `${(Math.random() - 0.5) * 320}px`);
    dot.style.setProperty("--y", `${-Math.random() * 260 - 40}px`);
    dot.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    dot.style.setProperty("--d", `${0.6 + Math.random() * 0.6}s`);
    dot.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(dot);
    setTimeout(() => dot.remove(), 1400);
  }
}

// ── Battle animation overlay ────────────────────────────────────────────────

interface BattleAnimationProps {
  challengerName: string;
  defenderName: string;
  onComplete: () => void;
}

function BattleAnimation({ challengerName, defenderName, onComplete }: BattleAnimationProps) {
  const [phase, setPhase] = useState<"enter" | "clash" | "done">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase("clash");
      sfxBattleClash();
    }, 900);
    const t2 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <div className="battle-anim-overlay">
      <div className={`battle-anim-deck battle-anim-deck--left ${phase !== "enter" ? "battle-anim-deck--clash" : ""}`}>
        <span className="battle-anim-name">{challengerName}</span>
        <span className="battle-anim-icon">⚔️</span>
      </div>
      <div className={`battle-anim-vs ${phase === "clash" ? "battle-anim-vs--flash" : ""}`}>
        VS
      </div>
      <div className={`battle-anim-deck battle-anim-deck--right ${phase !== "enter" ? "battle-anim-deck--clash" : ""}`}>
        <span className="battle-anim-name">{defenderName}</span>
        <span className="battle-anim-icon">🛡️</span>
      </div>
      {phase === "clash" && <div className="battle-anim-shockwave" />}
    </div>
  );
}

// ── Outcome popup ───────────────────────────────────────────────────────────

interface OutcomePopupProps {
  result: BattleResult;
  myUid: string;
  onDismiss: () => void;
}

function OutcomePopup({ result, myUid, onDismiss }: OutcomePopupProps) {
  const isWinner = result.winnerUid === myUid;
  const isDraw = result.challengerScore === result.defenderScore;
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isWinner) {
      sfxBattleWin();
      if (popupRef.current) spawnConfetti(popupRef.current);
    } else if (!isDraw) {
      sfxBattleLose();
    }
  }, [isWinner, isDraw]);

  const iAmChallenger = result.challengerUid === myUid;
  const myScore = iAmChallenger ? result.challengerScore : result.defenderScore;
  const theirScore = iAmChallenger ? result.defenderScore : result.challengerScore;

  return (
    <div className="battle-outcome-overlay" onClick={onDismiss}>
      <div className="battle-outcome-popup" ref={popupRef} onClick={(e) => e.stopPropagation()}>
        {isWinner && !isDraw && (
          <div className="battle-outcome-congrats">
            <span className="battle-outcome-trophy">🏆</span>
            <h2 className="battle-outcome-title battle-outcome-title--win">Victory!</h2>
            <p className="battle-outcome-subtitle">Congratulations, champion!</p>
          </div>
        )}
        {isDraw && (
          <div className="battle-outcome-congrats">
            <span className="battle-outcome-trophy">🤝</span>
            <h2 className="battle-outcome-title">Draw!</h2>
            <p className="battle-outcome-subtitle">An evenly matched battle.</p>
          </div>
        )}
        {!isWinner && !isDraw && (
          <div className="battle-outcome-congrats">
            <span className="battle-outcome-trophy">💀</span>
            <h2 className="battle-outcome-title battle-outcome-title--lose">Defeat</h2>
            <p className="battle-outcome-subtitle">Better luck next time, skater.</p>
          </div>
        )}

        <div className="battle-outcome-scores">
          <div className="battle-outcome-score">
            <span className="battle-outcome-score-label">Your Score</span>
            <span className="battle-outcome-score-value">{myScore}</span>
          </div>
          <span className="battle-outcome-score-vs">vs</span>
          <div className="battle-outcome-score">
            <span className="battle-outcome-score-label">Opponent</span>
            <span className="battle-outcome-score-value">{theirScore}</span>
          </div>
        </div>

        {isWinner && !isDraw && (
          <p className="battle-outcome-bonus">
            +{result.wagerPoints} attribute points earned for your battle deck cards!
          </p>
        )}
        {!isWinner && !isDraw && (
          <p className="battle-outcome-penalty">
            −{WAGER_POINTS} attribute points lost from your deck.
          </p>
        )}

        <button className="btn-primary" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}

// ── Deck Selector for readying ──────────────────────────────────────────────

interface DeckSelectorProps {
  decks: DeckPayload[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function DeckSelector({ decks, selectedId, onSelect }: DeckSelectorProps) {
  const eligible = decks.filter((d) => d.cards.length >= MIN_BATTLE_CARDS);

  if (eligible.length === 0) {
    return (
      <div className="arena-empty-state">
        <p>You need at least {MIN_BATTLE_CARDS} {MIN_BATTLE_CARDS === 1 ? "card" : "cards"} in a deck to enter the arena.</p>
        <p className="page-sub">Head to <strong>My Decks</strong> to build one.</p>
      </div>
    );
  }

  return (
    <div className="arena-deck-selector">
      <h3>Select a Deck to Ready</h3>
      <div className="arena-deck-list">
        {eligible.map((deck) => (
          <button
            key={deck.id}
            className={`arena-deck-option ${selectedId === deck.id ? "arena-deck-option--active" : ""}`}
            onClick={() => onSelect(deck.id)}
          >
            <span className="arena-deck-option-name">{deck.name}</span>
            <span className="arena-deck-option-count">{deck.cards.length} cards</span>
            <span className="arena-deck-option-power">⚡ {computeDeckScore(deck.cards)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ArenaBattleSummaryProps {
  summary?: ArenaDeckSummary | null;
  label?: string;
}

function ArenaBattleSummary({ summary, label }: ArenaBattleSummaryProps) {
  if (!summary) {
    return <span className="arena-opponent-stats-hidden">Scout data syncing...</span>;
  }

  return (
    <div className="arena-battle-summary">
      {label && <span className="arena-battle-summary-label">{label}</span>}
      <span className="arena-battle-summary-line">
        ⚡ Power {summary.deckPower} · 🎯 Best {formatStatLabel(summary.strongestStat)} {summary.strongestStatTotal}
      </span>
      <span className="arena-battle-summary-line">
        🤝 Synergy +{summary.synergyBonusPct}% · {summary.archetypeHint}
      </span>
    </div>
  );
}

// ── Main Arena page ─────────────────────────────────────────────────────────

export function BattleArena() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { decks } = useDecks();
  const {
    arenaEntries,
    readyDeck,
    unreadyDeck,
    challenge,
    battleResult,
    dismissResult,
    battling,
    refresh,
    myArenaEntry,
  } = useBattle();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [pendingResult, setPendingResult] = useState<BattleResult | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  // Auto-select first eligible deck
  useEffect(() => {
    if (!selectedDeckId && decks.length > 0) {
      const first = decks.find((d) => d.cards.length >= MIN_BATTLE_CARDS);
      if (first) setSelectedDeckId(first.id);
    }
  }, [decks, selectedDeckId]);

  // When battle result arrives, show outcome
  useEffect(() => {
    if (battleResult && !showAnimation) {
      setShowOutcome(true);
    }
  }, [battleResult, showAnimation]);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) ?? null;
  const selectedDeckSummary = useMemo(
    () => (selectedDeck ? buildArenaDeckSummary(selectedDeck.cards) : null),
    [selectedDeck],
  );

  const handleReady = async () => {
    if (!selectedDeck) return;
    sfxBattleReady();
    await readyDeck(selectedDeck);
  };

  const handleUnready = async () => {
    await unreadyDeck();
  };

  const handleAnimComplete = useCallback(() => {
    setShowAnimation(false);
    if (pendingResult) {
      setShowOutcome(true);
    }
  }, [pendingResult]);

  const handleChallenge = async (entry: ArenaEntry) => {
    if (!selectedDeck || !uid) return;
    if (!entry.battleDeck || entry.battleDeck.length < MIN_BATTLE_CARDS) return;

    // Start the animation
    setShowAnimation(true);
    setPendingResult(null);

    await challenge(entry, selectedDeck);
  };

  const handleDismissOutcome = () => {
    setShowOutcome(false);
    setPendingResult(null);
    dismissResult();
  };

  const opponents = arenaEntries.filter((e) => e.uid !== uid);

  if (!uid) {
    return (
      <div className="page">
        <h1 className="page-title">⚔️ Battle Arena</h1>
        <div className="empty-state">
          <span className="empty-icon">🛡️</span>
          <p>Sign in to enter the Battle Arena.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚔️ Battle Arena</h1>
          <p className="page-sub">
            Ready your deck for battle. Each battle wagers {WAGER_POINTS} random attribute points — the winner takes {WINNER_BONUS}!
          </p>
        </div>
        <button className="btn-outline" onClick={refresh} aria-label="Refresh arena entries">
          ↻ Refresh
        </button>
      </div>

      <div className="arena-layout">
        {/* Left: my deck / ready status */}
        <div className="arena-my-deck">
          <h2 className="arena-section-title">Your Battle Station</h2>

          {myArenaEntry ? (
            <div className="arena-ready-banner">
              <span className="arena-ready-pulse" />
              <div className="arena-ready-info">
                <strong>{myArenaEntry.deckName}</strong> is ready for battle!
                <br />
                <span className="arena-ready-hint">Waiting for a challenger…</span>
                <ArenaBattleSummary summary={myArenaEntry.battleSummary} label="Public arena summary" />
              </div>
              <button className="btn-outline btn-sm" onClick={handleUnready}>
                Stand Down
              </button>
            </div>
          ) : (
            <>
              <DeckSelector decks={decks} selectedId={selectedDeckId} onSelect={setSelectedDeckId} />
              {selectedDeck && (
                <>
                  <div className="arena-deck-preview">
                    <h4>{selectedDeck.name}</h4>
                    <ArenaBattleSummary summary={selectedDeckSummary} label="Public arena summary" />
                    <div className="arena-deck-preview-cards">
                      {selectedDeck.cards.map((card) => (
                        <CardThumbnail key={card.id} card={card} width={80} height={56} />
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn-primary arena-ready-btn"
                    onClick={handleReady}
                    disabled={battling}
                  >
                    ⚔️ Ready for Battle
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Right: opponents in the arena */}
        <div className="arena-opponents">
          <h2 className="arena-section-title">Arena Challengers</h2>

          {opponents.length === 0 ? (
            <div className="arena-empty-state">
              <span className="empty-icon">🏟️</span>
              <p>No opponents in the arena yet.</p>
              <p className="page-sub">Ready your deck and wait for challengers to appear!</p>
            </div>
          ) : (
            <div className="arena-opponent-list">
              {opponents.map((entry) => (
                <div key={entry.uid} className="arena-opponent-card">
                  <div className="arena-opponent-info">
                    <span className="arena-opponent-name">{entry.displayName}</span>
                    <span className="arena-opponent-deck">
                      {entry.deckName} · {entry.cardCount} cards
                    </span>
                    <ArenaBattleSummary summary={entry.battleSummary} label="Scouting report" />
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleChallenge(entry)}
                    disabled={battling || !myArenaEntry || !entry.battleDeck || entry.battleDeck.length < MIN_BATTLE_CARDS}
                    title={
                      !myArenaEntry
                        ? "Ready your deck first!"
                        : !entry.battleDeck || entry.battleDeck.length < MIN_BATTLE_CARDS
                          ? "Opponent deck sync in progress"
                          : "Challenge this player"
                    }
                  >
                    ⚔️ Challenge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Battle animation overlay */}
      {showAnimation && selectedDeck && (
        <BattleAnimation
          challengerName={selectedDeck.name}
          defenderName={pendingResult?.defenderDeckName ?? "Opponent"}
          onComplete={handleAnimComplete}
        />
      )}

      {/* Outcome popup */}
      {showOutcome && battleResult && uid && (
        <OutcomePopup result={battleResult} myUid={uid} onDismiss={handleDismissOutcome} />
      )}
    </div>
  );
}
