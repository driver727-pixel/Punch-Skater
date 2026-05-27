import type { CardPayload } from "../lib/types";
import { MAX_SINGLE_STAT } from "../lib/generator";
import { computeDeckTotalPower } from "../lib/battle";
import { computeCrewOzzies, computeCrewXp, MAX_DECK_POWER_TARGET, CREW_SIZE } from "../lib/progression";
import { CARD_STAT_LABELS } from "../lib/statLabels";

interface DeckStatsPanelProps {
  cards: CardPayload[];
  maxCardsInDeck: number;
}

const STAT_DEFS = [
  { key: "speed"   as const, color: "#00ccff", glow: "rgba(0,204,255,0.7)"   },
  { key: "range"   as const, color: "#00ff88", glow: "rgba(0,255,136,0.7)"   },
  { key: "stealth" as const, color: "#cc44ff", glow: "rgba(204,68,255,0.7)"  },
  { key: "grit"    as const, color: "#ff6644", glow: "rgba(255,102,68,0.7)"  },
];

export function DeckStatsPanel({ cards, maxCardsInDeck }: DeckStatsPanelProps) {
  const filledCards = cards.filter(Boolean);
  if (filledCards.length === 0) return null;

  // Each stat is 1–10; with maxCardsInDeck cards the theoretical max is 10 × maxCardsInDeck
  const statMax = MAX_SINGLE_STAT * maxCardsInDeck;

  const totals = STAT_DEFS.map(({ key, color, glow }) => {
    const { label, tooltip } = CARD_STAT_LABELS[key];
    const total = filledCards.reduce((sum, c) => sum + (c.stats[key as keyof typeof c.stats] ?? 0), 0);
    const pct = Math.min((total / statMax) * 100, 100);
    return { key, label, tooltip, color, glow, total, pct };
  });

  const grandTotal   = computeDeckTotalPower(filledCards);
  const grandMax     = statMax * STAT_DEFS.length;
  const grandPct     = Math.min((grandTotal / grandMax) * 100, 100);
  const crewOzzies   = computeCrewOzzies(filledCards);
  const crewXp       = computeCrewXp(filledCards);
  const isFullCrew   = filledCards.length >= CREW_SIZE;

  return (
    <div className="deck-stats-panel">
      <h3 className="deck-stats-title">Deck Power ⚡</h3>
      <div className="deck-stats-bars">
        {totals.map(({ key, label, tooltip, color, glow, total, pct }) => (
          <div key={key} className="deck-stats-row">
            <span className="deck-stats-label" style={{ color }} title={tooltip}>{label}</span>
            <div className="deck-stats-track">
              <div
                className="deck-stats-fill"
                style={{
                  width: `${pct}%`,
                  background: color,
                  boxShadow: `0 0 8px ${glow}, 0 0 16px ${glow}, 0 0 2px #fff inset`,
                }}
              />
              {/* tube segment notches */}
              {Array.from({ length: maxCardsInDeck - 1 }).map((_, i) => (
                <span
                  key={i}
                  className="deck-stats-notch"
                  style={{ left: `${((i + 1) / maxCardsInDeck) * 100}%` }}
                />
              ))}
            </div>
            <span className="deck-stats-value" style={{ color }} aria-label={`${label} total ${total}`}>{total}</span>
          </div>
        ))}
      </div>

      {/* Grand-total power meter */}
      <div className="deck-stats-total">
        <span className="deck-stats-total-label">TOTAL POWER</span>
        <div className="deck-stats-total-track">
          <div
            className="deck-stats-total-fill"
            style={{ width: `${grandPct}%` }}
          />
        </div>
        <span
          className="deck-stats-total-value"
          aria-label={`Total power ${grandTotal} of ${grandMax}`}
        >{grandTotal}<span className="deck-stats-total-max" aria-hidden="true">/{grandMax}</span></span>
      </div>

      {/* Crew Ozzies */}
      <div className="deck-stats-ozzies">
        <span
          className="deck-stats-ozzies-label"
          title="Ozzies show how valuable and respected your collection is. Crew Ozzies = sum of all card Ozzy values in your active 6-card Crew."
        >
          {isFullCrew ? "CREW OZZIES" : "OZZIES"}
        </span>
        <span
          className="deck-stats-ozzies-value"
          aria-label={`Crew Ozzies ${crewOzzies}`}
        >
          {crewOzzies.toLocaleString()} Ozzies
        </span>
      </div>

      {/* Crew XP (shown when any card has earned XP) */}
      {crewXp > 0 && (
        <div className="deck-stats-ozzies">
          <span
            className="deck-stats-ozzies-label"
            title="Crew XP = sum of all card XP values in your active Crew. XP shows what your Crew has done through gameplay."
          >
            {isFullCrew ? "CREW XP" : "TOTAL XP"}
          </span>
          <span className="deck-stats-ozzies-value" aria-label={`Crew XP ${crewXp.toLocaleString()}`}>
            {crewXp.toLocaleString()} XP
          </span>
        </div>
      )}

      {/* Design-target Deck Power cap callout for full Crews */}
      {isFullCrew && (
        <div
          className="deck-stats-ozzies"
          title={`Design target: ${MAX_DECK_POWER_TARGET.toLocaleString()} max Deck Power. Reaching 1,000 unlocks Apprentice forge, 2,500 Master, 5,000 Rare, and 8,500+ opens Legendary eligibility (earn only).`}
        >
          <span className="deck-stats-ozzies-label">POWER TARGET</span>
          <span className="deck-stats-ozzies-value" style={{ opacity: 0.6 }}>
            / {MAX_DECK_POWER_TARGET.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
