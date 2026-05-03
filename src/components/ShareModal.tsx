import { useState } from "react";
import type { CardPayload } from "../lib/types";
import { getDisplayedArchetype, getDisplayedCrew } from "../lib/cardIdentity";

interface ShareModalProps {
  card: CardPayload;
  onClose: () => void;
}

export function ShareModal({ card, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareText = [
    `🛹 ${card.identity.name} — ${getDisplayedArchetype(card)} · ${card.class.badgeLabel}`,
    `Faction: ${getDisplayedCrew(card)}`,
    `Speed ${card.stats.speed} | Range ${card.stats.range} | Stealth ${card.stats.stealth} | Grit ${card.stats.grit}`,
    (card.front.flavorTextEnglish ?? card.front.flavorText) ? `"${card.front.flavorTextEnglish ?? card.front.flavorText}"` : "",
    `\n#SkaterPunkDeckBuilder`,
  ].filter(Boolean).join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      /* clipboard access denied — silently ignore */
    });
  };

  const encodedCard = encodeURIComponent(
    JSON.stringify({
      archetype: getDisplayedArchetype(card),
      rarity: card.prompts.rarity,
      district: card.prompts.district,
      accentColor: card.prompts.accentColor,
      seed: card.seed,
    })
  );
  const shareUrl = `${window.location.origin}/?card=${encodedCard}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      /* clipboard access denied — silently ignore */
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel modal-panel--sm" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Share Card</h2>
        <p className="modal-sub">{card.identity.name}</p>

        <div className="share-text-box">
          <pre className="share-text">{shareText}</pre>
        </div>

        <div className="share-actions">
          <button className="btn-primary" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy Text"}
          </button>
          <button className="btn-outline" onClick={handleCopyUrl}>
            Copy Share Link
          </button>
        </div>
      </div>
    </div>
  );
}
