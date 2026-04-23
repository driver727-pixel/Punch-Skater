import { CardViewer3D } from "../../components/CardViewer3D";
import { PrintModal } from "../../components/PrintModal";
import { sfxClick } from "../../lib/sfx";
import type { CardPayload, Faction } from "../../lib/types";
import type { LayerState } from "./useForgeLayers";

interface ForgeResultOverlaysProps {
  card: CardPayload | null;
  characterBlend: number;
  isFirstCard: boolean;
  layers: LayerState;
  onCloseFactionReveal: () => void;
  onClosePrint: () => void;
  onCloseViewer3D: () => void;
  onGoToCollection: () => void;
  onOpenFactions: () => void;
  printing: boolean;
  revealedFaction: { faction: Faction; isNew: boolean } | null;
  savedCard: CardPayload | null;
  viewing3D: boolean;
}

export function ForgeResultOverlays({
  card,
  characterBlend,
  isFirstCard,
  layers,
  onCloseFactionReveal,
  onClosePrint,
  onCloseViewer3D,
  onGoToCollection,
  onOpenFactions,
  printing,
  revealedFaction,
  savedCard,
  viewing3D,
}: ForgeResultOverlaysProps) {
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
          backgroundPrintUrl={layers.backgroundPrintUrl}
          characterImageUrl={layers.characterUrl}
          frameImageUrl={layers.frameUrl}
          characterBlend={characterBlend}
          onClose={onClosePrint}
        />
      )}
      {savedCard && (
        <div className="save-celebrate-overlay" onClick={onGoToCollection}>
          <div className="save-celebrate-modal" onClick={(event) => event.stopPropagation()}>
            <div className="save-celebrate-emoji">🎉</div>
            <h2 className="save-celebrate-title">
              {isFirstCard
                ? "Congrats! You saved your first card!"
                : "Card saved to your Collection!"}
            </h2>
            <p className="save-celebrate-name">{savedCard.identity.name}</p>
            <p className="save-celebrate-seed">SEED · {savedCard.seed}</p>
            <button
              className="btn-primary"
              onClick={() => {
                sfxClick();
                onGoToCollection();
              }}
            >
              Go to My Collection →
            </button>
          </div>
        </div>
      )}
      {revealedFaction && (
        <div className="save-celebrate-overlay" onClick={onCloseFactionReveal}>
          <div className="save-celebrate-modal save-celebrate-modal--reveal" onClick={(event) => event.stopPropagation()}>
            <div className="save-celebrate-emoji">🎴</div>
            <h2 className="save-celebrate-title">
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
