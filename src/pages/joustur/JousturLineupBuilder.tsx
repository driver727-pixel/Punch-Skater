/**
 * JousturLineupBuilder.tsx — Pick 6 rider cards + 1 support card for Joustur.
 *
 * Card faction (crew) drives the Joustur faction passive and support effect.
 * Uses the player's existing card collection via useCollection.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCollection } from "../../hooks/useCollection";
import { useJousturLineup } from "../../hooks/useJousturLineup";
import type { CardPayload } from "../../lib/types";

const RIDER_COUNT = 6;

const FACTION_LABELS: Record<string, string> = {
  rustKids:        "Rust Kids — patchworkRush",
  neonSaints:      "Neon Saints — crowdHalo",
  signalGhosts:    "Signal Ghosts — ghostRoute",
  chromeSyndicate: "Chrome Syndicate — precisionCast",
  voltageVultures: "Voltage Vultures — surgeTrigger",
  alleyWraiths:    "Alley Wraiths — cutline",
};

const SUPPORT_EFFECT_LABELS: Record<string, string> = {
  rustKids:        "recoveryPing — recover a captured rider",
  neonSaints:      "crowdRoar — extra turn",
  signalGhosts:    "smokeScreen — immune to capture for 1 opponent turn",
  chromeSyndicate: "reroll — regenerate the USB Shard roll",
  voltageVultures: "overclock — +1 to current roll",
  alleyWraiths:    "sideRoute — teleport a rider from entry to exit zone",
};

const CREW_TO_FACTION: Record<string, string> = {
  "Punch Skaters":   "rustKids",
  "Ne0n Legion":     "neonSaints",
  "Qu111s (Quills)": "signalGhosts",
  "The Team":        "chromeSyndicate",
  "Iron Curtains":   "voltageVultures",
  "The Asclepians":  "alleyWraiths",
};

function factionForCrew(crew: string): string {
  return CREW_TO_FACTION[crew] ?? "rustKids";
}

function CardSlot({
  label,
  card,
  onClear,
  onClick,
}: {
  label: string;
  card: CardPayload | null;
  onClear: () => void;
  onClick: () => void;
}) {
  return (
    <div className="lineup-slot">
      <span className="lineup-slot__label">{label}</span>
      {card ? (
        <div className="lineup-slot__card">
          <span className="lineup-slot__card-name">
            {card.identity?.name ?? card.id}
          </span>
          <span className="lineup-slot__card-crew">
            {card.identity?.crew ?? "—"}
          </span>
          <button
            type="button"
            className="lineup-slot__clear"
            onClick={onClear}
            aria-label={`Remove ${card.identity?.name ?? card.id}`}
          >
            ✕
          </button>
        </div>
      ) : (
        <button type="button" className="lineup-slot__empty" onClick={onClick}>
          + Select card
        </button>
      )}
    </div>
  );
}

export function JousturLineupBuilder() {
  const navigate = useNavigate();
  const { cards } = useCollection();
  const { lineup, saving, error: saveError, saveLineup } = useJousturLineup();

  const [riderIds, setRiderIds] = useState<(string | null)[]>(
    () => lineup?.riderCardIds ?? Array(RIDER_COUNT).fill(null),
  );
  const [supportId, setSupportId] = useState<string | null>(
    () => lineup?.supportCardId ?? null,
  );
  const [pickingSlot, setPickingSlot] = useState<
    { type: "rider"; index: number } | { type: "support" } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cardById = useMemo(() => {
    const map: Record<string, CardPayload> = {};
    cards.forEach((c) => { if (c.id) map[c.id] = c; });
    return map;
  }, [cards]);

  // Cards already picked — exclude from picker.
  const usedIds = useMemo(() => {
    const s = new Set<string>();
    riderIds.forEach((id) => { if (id) s.add(id); });
    if (supportId) s.add(supportId);
    return s;
  }, [riderIds, supportId]);

  const availableCards = useMemo(
    () => cards.filter((c) => c.id && !usedIds.has(c.id)),
    [cards, usedIds],
  );

  const supportFaction = supportId
    ? factionForCrew(cardById[supportId]?.identity?.crew ?? "")
    : null;

  const handlePick = (card: CardPayload) => {
    if (!card.id || !pickingSlot) return;
    if (pickingSlot.type === "rider") {
      setRiderIds((prev) => {
        const next = [...prev];
        next[(pickingSlot as { type: "rider"; index: number }).index] = card.id!;
        return next;
      });
    } else {
      setSupportId(card.id);
    }
    setPickingSlot(null);
    setSaved(false);
  };

  const clearRider = (index: number) => {
    setRiderIds((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setSaved(false);
  };

  const isComplete =
    riderIds.every((id) => id !== null) && supportId !== null;

  const handleSave = async () => {
    if (!isComplete) return;
    setError(null);
    setSaved(false);
    try {
      await saveLineup(riderIds as string[], supportId!);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  };

  return (
    <div className="page joustur-lineup">
      <p className="page-eyebrow">Joustur Skatur</p>
      <h1 className="page-title">Build Your Lineup</h1>
      <p className="page-sub">
        Pick <strong>6 riders</strong> and <strong>1 support card</strong>.
        The support card's crew sets your faction passive and one-time support
        effect.
      </p>

      {(error ?? saveError) && (
        <div className="status-banner status-banner--error" role="alert">
          {error ?? saveError}
        </div>
      )}
      {saved && (
        <div className="status-banner status-banner--ok" role="status">
          ✓ Lineup saved!{" "}
          <button
            type="button"
            className="inline-link"
            onClick={() => navigate("/joustur")}
          >
            Back to Joustur
          </button>
        </div>
      )}

      {/* Rider slots */}
      <section className="joustur-lineup__section">
        <h2 className="joustur-lineup__section-title">Riders</h2>
        <div className="joustur-lineup__slots">
          {Array.from({ length: RIDER_COUNT }, (_, i) => (
            <CardSlot
              key={i}
              label={`Rider ${i + 1}`}
              card={riderIds[i] ? cardById[riderIds[i]!] ?? null : null}
              onClear={() => clearRider(i)}
              onClick={() => setPickingSlot({ type: "rider", index: i })}
            />
          ))}
        </div>
      </section>

      {/* Support slot */}
      <section className="joustur-lineup__section">
        <h2 className="joustur-lineup__section-title">Support Card</h2>
        <CardSlot
          label="Support"
          card={supportId ? cardById[supportId] ?? null : null}
          onClear={() => { setSupportId(null); setSaved(false); }}
          onClick={() => setPickingSlot({ type: "support" })}
        />
        {supportFaction && (
          <div className="joustur-lineup__faction-info">
            <p>
              <strong>Faction:</strong>{" "}
              {FACTION_LABELS[supportFaction] ?? supportFaction}
            </p>
            <p>
              <strong>Support effect:</strong>{" "}
              {SUPPORT_EFFECT_LABELS[supportFaction] ?? supportFaction}
            </p>
          </div>
        )}
      </section>

      <div className="joustur-lineup__actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={!isComplete || saving}
        >
          {saving ? "Saving…" : "Save Lineup"}
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => navigate("/joustur")}
        >
          Cancel
        </button>
      </div>

      {/* Card picker */}
      {pickingSlot && (
        <div
          className="joustur-lineup__picker-overlay"
          role="dialog"
          aria-label="Pick a card"
        >
          <div className="joustur-lineup__picker">
            <div className="joustur-lineup__picker-header">
              <h3>
                {pickingSlot.type === "rider"
                  ? `Pick Rider ${(pickingSlot as { type: "rider"; index: number }).index + 1}`
                  : "Pick Support Card"}
              </h3>
              <button
                type="button"
                className="joustur-lineup__picker-close"
                onClick={() => setPickingSlot(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {availableCards.length === 0 ? (
              <p className="joustur-lineup__picker-empty">
                No more cards available.
              </p>
            ) : (
              <ul className="joustur-lineup__picker-list">
                {availableCards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="joustur-lineup__picker-item"
                      onClick={() => handlePick(card)}
                    >
                      <span className="picker-item__name">
                        {card.identity?.name ?? card.id}
                      </span>
                      <span className="picker-item__crew">
                        {card.identity?.crew ?? "—"}
                      </span>
                      <span className="picker-item__rarity">
                        {card.class?.rarity ?? "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
