import { useState, useEffect, useRef, useCallback } from "react";
import { useBattle, MIN_BATTLE_CARDS } from "../hooks/useBattle";
import { useDecks } from "../hooks/useDecks";
import { useAuth } from "../context/AuthContext";
import type { ArenaEntry, DeckPayload, BattleResult } from "../lib/types";
import { WAGER_POINTS, WINNER_BONUS, computeDeckScore } from "../lib/battle";
import { CardThumbnail } from "../components/CardThumbnail";

// ── Tiny Web Audio SFX helpers ──────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}

function playSfx(type: "clash" | "win" | "lose" | "ready") {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case "ready":
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
      case "clash":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        break;
      case "win":
        osc.type = "square";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.36);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
        break;
      case "lose":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
        break;
    }
  } catch {
    /* Audio unavailable – silently ignore */
  }
}

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
      playSfx("clash");
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
      playSfx("win");
      if (popupRef.current) spawnConfetti(popupRef.current);
    } else if (!isDraw) {
      playSfx("lose");
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

  const handleReady = async () => {
    if (!selectedDeck) return;
    playSfx("ready");
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
    // In a real implementation, we'd fetch the opponent's cards from Firestore.
    // For the client-side demo, we simulate opponent cards by using a score based on card count.
    // The actual battle resolution happens via the challenge() hook which requires opponent cards.
    // Here we create placeholder cards for the opponent to resolve against.
    // In production, this would be a Cloud Function that reads both decks server-side.

    // Start the animation
    setShowAnimation(true);
    setPendingResult(null);

    // Use the selected deck's cards as opponent stand-in (in production this is server-side)
    // For demo purposes, the hook resolves client-side
    await challenge(entry, selectedDeck, selectedDeck.cards);
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
      <h1 className="page-title">⚔️ Battle Arena</h1>
      <p className="page-sub">
        Ready your deck for battle. Each battle wagers {WAGER_POINTS} random attribute points — the winner takes {WINNER_BONUS}!
      </p>

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
                    <span className="arena-opponent-stats-hidden">Stats hidden 🔒</span>
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleChallenge(entry)}
                    disabled={battling || !myArenaEntry}
                    title={!myArenaEntry ? "Ready your deck first!" : "Challenge this player"}
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
