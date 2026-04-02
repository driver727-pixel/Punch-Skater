import { useState } from "react";
import type { CardPayload } from "../lib/types";

interface ShareModalProps {
  card: CardPayload;
  onClose: () => void;
}

export function ShareModal({ card, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareText = [
    `🛹 ${card.identity.name} — ${card.prompts.archetype} · ${card.prompts.rarity}`,
    `Crew: ${card.identity.crew}`,
    `Speed ${card.stats.speed} | Stealth ${card.stats.stealth} | Tech ${card.stats.tech} | Grit ${card.stats.grit} | Rep ${card.stats.rep}`,
    `"${card.flavorText}"`,
    `\n#SkaterPunkDeckBuilder`,
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const encodedCard = encodeURIComponent(
    JSON.stringify({
      archetype: card.prompts.archetype,
      rarity: card.prompts.rarity,
      styleVibe: card.prompts.styleVibe,
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
