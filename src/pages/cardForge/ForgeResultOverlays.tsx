import { useEffect } from "react";
import { CardViewer3D } from "../../components/CardViewer3D";
import { PrintModal } from "../../components/PrintModal";
import { sfxClick } from "../../lib/sfx";
import type { CardPayload, Faction, Rarity } from "../../lib/types";
import type { LayerState } from "./useForgeLayers";

const RARITY_REVEAL_CONFIG: Record<Rarity, { emoji: string; title: string; message: string; cssKey: string }> = {
  "Punch Skater™": {
    emoji: "🛹",
    title: "Card Forged!",
    message: "Punch Skater™ class. Lace up and hit the streets.",
    cssKey: "punch-skater",
  },
  Apprentice: {
    emoji: "⚡",
    title: "Apprentice Pull!",
    message: "Uncommon hit. Your courier is stepping up.",
    cssKey: "apprentice",
  },
  Master: {
    emoji: "🔥",
    title: "Master Class!",
    message: "Rare pull. This courier runs the streets.",
    cssKey: "master",
  },
  Rare: {
    emoji: "💎",
    title: "Rare Hit!",
    message: "Ultra-rare forge drop. The city will remember this one.",
    cssKey: "rare",
  },
  Legendary: {
    emoji: "🏆",
    title: "Legendary!",
    message: "Legendary drop. This card was earned, not just made.",
    cssKey: "legendary",
  },
};

interface ForgeResultOverlaysProps {
  card: CardPayload | null;
  characterBlend: number;
  isFirstCard: boolean;
  layers: LayerState;
  onCloseFactionReveal: () => void;
  onCloseRarityReveal: () => void;
  onClosePrint: () => void;
  onCloseViewer3D: () => void;
  onGoToCollection: () => void;
  onKeepForging: () => void;
  onOpenFactions: () => void;
  printing: boolean;
  revealedFaction: { faction: Faction; isNew: boolean } | null;
  revealedRarity: Rarity | null;
  savedCard: CardPayload | null;
  viewing3D: boolean;
}

export function ForgeResultOverlays({
  card,
  characterBlend,
  isFirstCard,
  layers,
  onCloseFactionReveal,
  onCloseRarityReveal,
  onClosePrint,
  onCloseViewer3D,
  onGoToCollection,
  onKeepForging,
  onOpenFactions,
  printing,
  revealedFaction,
  revealedRarity,
  savedCard,
  viewing3D,
}: ForgeResultOverlaysProps) {
  const rarityConfig = revealedRarity ? RARITY_REVEAL_CONFIG[revealedRarity] : null;

  // Allow Escape to dismiss the celebration overlays (rarity, saved, faction).
  useEffect(() => {
    const closeTop = revealedRarity
      ? onCloseRarityReveal
      : savedCard
        ? onKeepForging
        : revealedFaction
          ? onCloseFactionReveal
          : null;
    if (!closeTop) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTop();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [revealedRarity, savedCard, revealedFaction, onCloseRarityReveal, onKeepForging, onCloseFactionReveal]);

  return (
    <>
      {card && viewing3D && (
        <CardViewer3D
          card={card}
          backgroundImageUrl={layers.backgroundUrl}
          characterImageUrl={layers.characterUrl}
          frameImageUrl={layers.frameUrl}
          characterBlend={characterBlend}
          onClose={onCloseViewer3D}
        />
      )}
      {card && printing && (
        <PrintModal
          card={card}
          backgroundImageUrl={layers.backgroundUrl}
          characterImageUrl={layers.characterUrl}
          frameImageUrl={layers.frameUrl}
          characterBlend={characterBlend}
          onClose={onClosePrint}
        />
      )}
      {revealedRarity && rarityConfig && (
        <div className="save-celebrate-overlay" onClick={onCloseRarityReveal} role="dialog" aria-modal="true" aria-labelledby="forge-rarity-reveal-title">
          <div
            className={`save-celebrate-modal save-celebrate-modal--rarity-reveal save-celebrate-modal--rarity-${rarityConfig.cssKey}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="save-celebrate-emoji rarity-reveal-emoji">{rarityConfig.emoji}</div>
            <h2 className="save-celebrate-title rarity-reveal-title" id="forge-rarity-reveal-title">{rarityConfig.title}</h2>
            <p className="rarity-reveal-badge">{revealedRarity}</p>
            <p className="save-celebrate-notice">{rarityConfig.message}</p>
            <div className="forge-generated-buttons">
              <button
                className="btn-primary"
                onClick={() => {
                  sfxClick();
                  onCloseRarityReveal();
                }}
              >
                Let's Go →
              </button>
            </div>
          </div>
        </div>
      )}
      {savedCard && (
        <div className="save-celebrate-overlay" onClick={onKeepForging} role="dialog" aria-modal="true" aria-labelledby="forge-saved-title">
          <div className="save-celebrate-modal" onClick={(event) => event.stopPropagation()}>
            <div className="save-celebrate-emoji">🎉</div>
            <h2 className="save-celebrate-title" id="forge-saved-title">
              {isFirstCard
                ? "Congrats! You saved your first card!"
                : "Card saved to your Collection!"}
            </h2>
            <p className="save-celebrate-name">{savedCard.identity.name}</p>
            <p className="save-celebrate-seed">SEED · {savedCard.seed}</p>
            <div className="forge-generated-buttons">
              <button
                className="btn-primary"
                onClick={() => {
                  sfxClick();
                  onGoToCollection();
                }}
              >
                Go to My Collection →
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  sfxClick();
                  onKeepForging();
                }}
              >
                Keep Forging
              </button>
            </div>
          </div>
        </div>
      )}
      {revealedFaction && (
        <div className="save-celebrate-overlay" onClick={onCloseFactionReveal} role="dialog" aria-modal="true" aria-labelledby="forge-faction-reveal-title">
          <div className="save-celebrate-modal save-celebrate-modal--reveal" onClick={(event) => event.stopPropagation()}>
            <div className="save-celebrate-emoji">🎴</div>
            <h2 className="save-celebrate-title" id="forge-faction-reveal-title">
              {revealedFaction.isNew
                ? "Secret faction discovered!"
                : "Faction signal reacquired!"}
            </h2>
            <p className="save-celebrate-name">{revealedFaction.faction}</p>
            <p className="save-celebrate-notice">
              Your forged card has been branded with the faction mark, and the Factions tab is now tracking what you know.
            </p>
            <div className="forge-generated-buttons">
              <button
                className="btn-primary"
                onClick={onOpenFactions}
              >
                Open Factions →
              </button>
              <button
                className="btn-outline"
                onClick={onCloseFactionReveal}
              >
                Keep Forging
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
