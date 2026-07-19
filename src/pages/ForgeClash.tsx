import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CardThumbnail } from "../components/CardThumbnail";
import { useCollection } from "../hooks/useCollection";
import { clamp, getCardRarityBonus, getCardStat } from "../lib/forgeClashMetrics";
import type { CardPayload, StatKey } from "../lib/types";
import { buildArenaDeckSummary, computeCardWorth } from "../lib/battle";

type ClashPhase = "draft" | "playing" | "ended";
type ClashIntent = "Rush" | "Guard" | "Trick";

interface RivalMove {
  name: string;
  intent: ClashIntent;
  speed: number;
  range: number;
  stealth: number;
  grit: number;
}

interface ClashLogEntry {
  turn: number;
  title: string;
  body: string;
  swing: "player" | "rival" | "neutral";
}

interface ClashState {
  phase: ClashPhase;
  turn: number;
  playerHp: number;
  rivalHp: number;
  combo: number;
  heat: number;
  cooldowns: Record<string, number>;
  activeCardId?: string;
  activeRival?: string;
  result?: "win" | "loss" | "draw";
  log: ClashLogEntry[];
}

const MAX_HAND_SIZE = 5;
const MAX_DRAFT_CARDS = 18;
const MAX_TURNS = 8;
const MAX_HP = 100;
const CRIT_STEALTH_DIVISOR = 120;
const COMBO_CRIT_BONUS = 0.025;
const MIN_CRIT_CHANCE = 0.05;
const MAX_CRIT_CHANCE = 0.42;
const SLIP_STEALTH_DIVISOR = 150;
const SLIP_SPEED_DIVISOR = 260;
const MIN_SLIP_CHANCE = 0.02;
const MAX_SLIP_CHANCE = 0.25;
const STAT_KEYS: StatKey[] = ["speed", "range", "stealth", "grit"];

const RIVAL_MOVES: RivalMove[] = [
  { name: "Rail Gnawer", intent: "Rush", speed: 23, range: 12, stealth: 8, grit: 13 },
  { name: "Chrome Bouncer", intent: "Guard", speed: 11, range: 15, stealth: 9, grit: 24 },
  { name: "Signal Ghost", intent: "Trick", speed: 17, range: 11, stealth: 25, grit: 12 },
  { name: "Battery Baron", intent: "Guard", speed: 14, range: 20, stealth: 10, grit: 22 },
  { name: "Neon Jackal", intent: "Rush", speed: 26, range: 14, stealth: 18, grit: 11 },
  { name: "Static Saint", intent: "Trick", speed: 16, range: 17, stealth: 23, grit: 15 },
];

function initialClashState(): ClashState {
  return {
    phase: "draft",
    turn: 1,
    playerHp: MAX_HP,
    rivalHp: MAX_HP,
    combo: 0,
    heat: 0,
    cooldowns: {},
    log: [],
  };
}

function getStat(card: CardPayload, stat: StatKey): number {
  return getCardStat(card, stat);
}

function getRarityBonus(card: CardPayload): number {
  return getCardRarityBonus(card);
}

function getStrongestStat(card: CardPayload): StatKey {
  return STAT_KEYS.reduce((best, stat) => (getStat(card, stat) > getStat(card, best) ? stat : best), "speed");
}

function getCounterBonus(card: CardPayload, intent: ClashIntent): { label: string; value: number } {
  const strongest = getStrongestStat(card);
  if (intent === "Rush" && strongest === "grit") return { label: "Grit stuffs the rush", value: 8 };
  if (intent === "Guard" && strongest === "range") return { label: "Range cracks the guard", value: 8 };
  if (intent === "Trick" && strongest === "stealth") return { label: "Stealth reads the trick", value: 8 };
  if (intent === "Rush" && strongest === "speed") return { label: "Speed mirrors the rush", value: 4 };
  return { label: "Clean line", value: 0 };
}

function resolvePlay(card: CardPayload, state: ClashState): {
  nextState: ClashState;
  entry: ClashLogEntry;
} {
  const rival = RIVAL_MOVES[(state.turn - 1) % RIVAL_MOVES.length];
  const counter = getCounterBonus(card, rival.intent);
  const crit = Math.random() < clamp(
    getStat(card, "stealth") / CRIT_STEALTH_DIVISOR + state.combo * COMBO_CRIT_BONUS,
    MIN_CRIT_CHANCE,
    MAX_CRIT_CHANCE,
  );
  const slip = Math.random() < clamp(
    rival.stealth / SLIP_STEALTH_DIVISOR - getStat(card, "speed") / SLIP_SPEED_DIVISOR,
    MIN_SLIP_CHANCE,
    MAX_SLIP_CHANCE,
  );
  const shield = Math.round(getStat(card, "grit") * 0.42 + state.combo);
  const playerBase = getStat(card, "range") + getStat(card, "speed") * 0.62 + getRarityBonus(card);
  const playerDamage = Math.max(4, Math.round(playerBase + counter.value + state.heat * 0.7 + (crit ? 12 : 0) - rival.grit * 0.28));
  const rivalBase = rival.range + rival.speed * 0.58 + (rival.intent === "Rush" ? 5 : 0) + (rival.intent === "Trick" ? 3 : 0);
  const rivalDamage = slip ? Math.round(rivalBase + 8) : Math.max(0, Math.round(rivalBase - shield));
  const nextRivalHp = clamp(state.rivalHp - playerDamage, 0, MAX_HP);
  const nextPlayerHp = clamp(state.playerHp - rivalDamage, 0, MAX_HP);
  const playerAhead = playerDamage >= rivalDamage;
  const nextCombo = playerAhead ? clamp(state.combo + 1, 0, 5) : 0;
  const nextHeat = clamp(state.heat + (crit ? 9 : 5) + counter.value / 2 - (slip ? 4 : 0), 0, 30);
  const decrementedCooldowns = Object.fromEntries(
    Object.entries(state.cooldowns)
      .map(([id, value]) => [id, Math.max(0, value - 1)])
      .filter(([, value]) => value > 0),
  );
  const cooldowns = { ...decrementedCooldowns, [card.id]: 2 };
  const ended = nextRivalHp <= 0 || nextPlayerHp <= 0 || state.turn === MAX_TURNS;
  const result = ended ? resolveResult(nextRivalHp, nextPlayerHp) : undefined;
  const entry: ClashLogEntry = {
    turn: state.turn,
    title: `${card.identity.name} vs ${rival.name}`,
    body: [
      `${counter.label}: ${playerDamage} hype damage.`,
      rivalDamage > 0 ? `${rival.name} answers for ${rivalDamage}.` : "Perfect block—no damage taken.",
      crit ? "CRIT spark!" : "",
      slip ? "Rival feint lands!" : "",
    ].filter(Boolean).join(" "),
    swing: playerDamage > rivalDamage ? "player" : playerDamage < rivalDamage ? "rival" : "neutral",
  };

  return {
    entry,
    nextState: {
      ...state,
      phase: ended ? "ended" : "playing",
      turn: ended ? state.turn : state.turn + 1,
      playerHp: nextPlayerHp,
      rivalHp: nextRivalHp,
      combo: nextCombo,
      heat: nextHeat,
      cooldowns,
      activeCardId: card.id,
      activeRival: rival.name,
      result,
      log: [entry, ...state.log].slice(0, 5),
    },
  };
}

function healthLabel(value: number): string {
  return `${Math.round(clamp(value, 0, MAX_HP))}%`;
}

function getResultLabel(result: ClashState["result"]): string {
  if (result === "win") return "Victory";
  if (result === "draw") return "Draw";
  return "Defeat";
}

function getStageStatusLabel(clash: ClashState): string {
  if (clash.phase === "draft") return "LOCK HAND";
  if (clash.phase === "ended") return getResultLabel(clash.result);
  return "LIVE CLASH";
}

function getSwingMessage(entry?: ClashLogEntry): string {
  if (!entry) return "Ready";
  switch (entry.swing) {
    case "player":
      return "Advantage!";
    case "rival":
      return "Rival surge!";
    case "neutral":
      return "Clash tie!";
  }
}

function buildIntentModifierClassName(intent: ClashIntent): string {
  return `forge-clash-stage--intent-${intent.toLowerCase()}`;
}

function getClashRenderKey(clash: ClashState): string {
  return [
    clash.phase,
    `turn-${clash.turn}`,
    clash.activeCardId ? `card-${clash.activeCardId}` : "card-none",
  ].join("|");
}

function resolveResult(nextRivalHp: number, nextPlayerHp: number): ClashState["result"] {
  if (nextRivalHp === nextPlayerHp) return "draw";
  if (nextRivalHp < nextPlayerHp) return "win";
  return "loss";
}

export function ForgeClash() {
  const { cards } = useCollection();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clash, setClash] = useState<ClashState>(() => initialClashState());

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => computeCardWorth(b) - computeCardWorth(a)),
    [cards],
  );
  const selectedCards = useMemo(
    () => selectedIds
      .map((id) => cards.find((card) => card.id === id))
      .filter((card): card is CardPayload => Boolean(card)),
    [cards, selectedIds],
  );
  const deckSummary = useMemo(() => buildArenaDeckSummary(selectedCards), [selectedCards]);
  const currentRival = RIVAL_MOVES[(clash.turn - 1) % RIVAL_MOVES.length];
  const latestEntry = clash.log[0];
  const stageClassName = [
    "forge-clash-stage",
    clash.phase === "playing" ? "is-live" : "",
    buildIntentModifierClassName(currentRival.intent),
    latestEntry ? `forge-clash-stage--${latestEntry.swing}` : "",
    clash.phase === "ended" && clash.result ? `forge-clash-stage--${clash.result}` : "",
  ].filter(Boolean).join(" ");
  const activeCard = useMemo(
    () => selectedCards.find((card) => card.id === clash.activeCardId),
    [clash.activeCardId, selectedCards],
  );

  const toggleCard = (cardId: string) => {
    if (clash.phase !== "draft") return;
    setSelectedIds((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= MAX_HAND_SIZE) return current;
      return [...current, cardId];
    });
  };

  const startClash = () => {
    if (selectedCards.length === 0) return;
    setClash({ ...initialClashState(), phase: "playing" });
  };

  const playCard = (card: CardPayload) => {
    if (clash.phase !== "playing" || clash.cooldowns[card.id]) return;
    const { nextState } = resolvePlay(card, clash);
    setClash(nextState);
  };

  const resetDraft = () => {
    setClash(initialClashState());
  };

  return (
    <div className="page forge-clash-page">
      <header className="forge-clash-hero">
        <p className="app-status-eyebrow">Core Game Prototype</p>
        <h1>Forge Clash</h1>
        <p>
          Pick up to five forged cards, read the rival intent, then slam animated cards into
          a fast combo duel. Speed builds tempo, Range hits hard, Stealth spikes crits, and
          Grit blocks rushes.
        </p>
        <div className="forge-clash-hero__actions">
          <Link to="/forge" className="btn-primary">Forge a Card</Link>
          <Link to="/collection" className="btn-outline">Manage Collection</Link>
        </div>
      </header>

      {cards.length === 0 ? (
        <section className="forge-clash-empty">
          <h2>No forged cards yet</h2>
          <p>Forge your first skater card, then come back to play it in the clash arena.</p>
          <Link to="/forge" className="btn-primary">Open Card Forge</Link>
        </section>
      ) : (
        <div className="forge-clash-layout">
          <section className="forge-clash-board" aria-live="polite">
            <div className="forge-clash-scorebar">
              <div className="forge-clash-health">
                <span>Your Crew</span>
                <strong>{healthLabel(clash.playerHp)}</strong>
                <div className="forge-clash-meter"><span style={{ width: `${clash.playerHp}%` }} /></div>
              </div>
              <div className="forge-clash-turn">
                <span>Turn {clash.turn}/{MAX_TURNS}</span>
                <strong>{clash.phase === "ended" ? getResultLabel(clash.result) : currentRival.intent}</strong>
              </div>
              <div className="forge-clash-health forge-clash-health--rival">
                <span>Rival Heat</span>
                <strong>{healthLabel(clash.rivalHp)}</strong>
                <div className="forge-clash-meter"><span style={{ width: `${clash.rivalHp}%` }} /></div>
              </div>
            </div>

            <div className={stageClassName} key={getClashRenderKey(clash)}>
              <div className="forge-clash-stage__grid" aria-hidden="true" />
              <div className="forge-clash-stage__sparks" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="forge-clash-stage__smoke" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="forge-clash-stage__lightning" aria-hidden="true">
                <i />
                <i />
              </div>
              <div className="forge-clash-stage__fire" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div className="forge-clash-stage__status" aria-hidden="true">
                {getStageStatusLabel(clash)}
              </div>
              <div className={`forge-clash-combatant forge-clash-combatant--player${clash.activeCardId ? " is-striking" : ""}`} key={clash.activeCardId ?? "crew"}>
                <div className="forge-clash-card-showcase" aria-hidden="true">
                  {(activeCard ? [activeCard] : selectedCards.slice(0, 3)).map((card, index) => (
                    <div
                      key={card.id}
                      className={`forge-clash-3d-card forge-clash-3d-card--${index + 1}`}
                    >
                      <CardThumbnail card={card} width={168} height={118} />
                    </div>
                  ))}
                  {!activeCard && selectedCards.length === 0 && <span className="forge-clash-card-showcase__empty">⚡</span>}
                </div>
                <strong>{activeCard?.identity.name ?? "Your hand is loaded"}</strong>
                <small>{activeCard ? `${getStrongestStat(activeCard).toUpperCase()} charge` : "Draft a five-card crew"}</small>
              </div>
              <div className="forge-clash-impact">
                <span className="forge-clash-impact__ring" aria-hidden="true" />
                {activeCard && (
                  <div className="forge-clash-impact-card" aria-hidden="true">
                    <CardThumbnail card={activeCard} width={126} height={88} />
                  </div>
                )}
                <span>COMBO x{clash.combo}</span>
                <strong>HEAT {clash.heat}</strong>
                <em>{getSwingMessage(latestEntry)}</em>
              </div>
              <div className={`forge-clash-combatant forge-clash-combatant--rival${clash.activeRival ? " is-recoiling" : ""}`} key={clash.activeRival ?? currentRival.name}>
                <span>{currentRival.intent === "Rush" ? "💥" : currentRival.intent === "Guard" ? "🛡️" : "👁️"}</span>
                <strong>{clash.activeRival ?? currentRival.name}</strong>
                <small>{currentRival.intent} intent incoming</small>
              </div>
            </div>

            <div className="forge-clash-hand">
              {selectedCards.map((card) => {
                const cooldown = clash.cooldowns[card.id] ?? 0;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`forge-clash-card${clash.activeCardId === card.id ? " is-active" : ""}`}
                    onClick={() => playCard(card)}
                    disabled={clash.phase !== "playing" || cooldown > 0}
                  >
                    <CardThumbnail card={card} width={150} height={105} />
                    <span>{card.identity.name}</span>
                    <small>
                      {cooldown > 0 ? `Cooldown: ${cooldown}` : `${getStrongestStat(card).toUpperCase()} lead`}
                    </small>
                  </button>
                );
              })}
            </div>

            <div className="forge-clash-controls">
              {clash.phase === "draft" ? (
                <button type="button" className="btn-primary" onClick={startClash} disabled={selectedCards.length === 0}>
                  Start Clash
                </button>
              ) : (
                <button type="button" className="btn-outline" onClick={resetDraft}>
                  Rebuild Hand
                </button>
              )}
              <div className="forge-clash-summary">
                <span>Power {deckSummary.deckPower}</span>
                <span>{deckSummary.archetypeHint}</span>
                <span>Best {deckSummary.strongestStat}: {deckSummary.strongestStatTotal}</span>
              </div>
            </div>
          </section>

          <aside className="forge-clash-side">
            <section className="forge-clash-panel">
              <h2>Draft forged cards</h2>
              <p>{selectedCards.length}/{MAX_HAND_SIZE} selected. Strong hands rotate between damage, blocks, and counters.</p>
              <div className="forge-clash-draft-grid">
                {sortedCards.slice(0, MAX_DRAFT_CARDS).map((card) => {
                  const selected = selectedIds.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`forge-clash-draft-card${selected ? " is-selected" : ""}`}
                      onClick={() => toggleCard(card.id)}
                      disabled={!selected && selectedIds.length >= MAX_HAND_SIZE}
                    >
                      <CardThumbnail card={card} width={118} height={82} />
                      <span>{card.identity.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="forge-clash-panel">
              <h2>Clash feed</h2>
              {clash.log.length === 0 ? (
                <p>Start the clash and play a card to light up the feed.</p>
              ) : (
                <ol className="forge-clash-log">
                  {clash.log.map((entry) => (
                    <li key={`${entry.turn}:${entry.title}`} className={`forge-clash-log__item forge-clash-log__item--${entry.swing}`}>
                      <strong>Turn {entry.turn}: {entry.title}</strong>
                      <span>{entry.body}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
