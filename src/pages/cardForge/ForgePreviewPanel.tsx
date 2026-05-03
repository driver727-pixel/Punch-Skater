import { useCallback } from "react";
import { PrintedCardPreviewPair } from "../../components/PrintedCardFaces";
import { CardContainer } from "../../components/CardContainer";
import { buildCardVars } from "../../lib/cardVars";
import type { BoardPlacement, CardPayload, CharacterPlacement } from "../../lib/types";
import type { LayerState } from "./useForgeLayers";

interface ForgePreviewPanelProps {
  boardImageLoading: boolean;
  card: CardPayload | null;
  characterBlend: number;
  isImageGenConfigured: boolean;
  layers: LayerState;
  patchGeneratedCard: (updates: Partial<CardPayload>) => void;
  patchIdentity: (updates: Partial<CardPayload["identity"]>) => void;
  patchStats: (updates: Partial<CardPayload["stats"]>) => void;
  onBoardPlacementChange: (placement: BoardPlacement) => void;
  onCharacterPlacementChange: (placement: CharacterPlacement) => void;
}

export function ForgePreviewPanel({
  boardImageLoading,
  card,
  characterBlend,
  isImageGenConfigured,
  layers,
  patchGeneratedCard,
  patchIdentity,
  patchStats,
  onBoardPlacementChange,
  onCharacterPlacementChange,
}: ForgePreviewPanelProps) {
  const cardVars = buildCardVars(card, "editor");

  const handleNameChange = useCallback(
    (name: string) => patchIdentity({ name }),
    [patchIdentity],
  );
  const handleBioChange = useCallback(
    (flavorText: string) => {
      if (!card) return;
      patchGeneratedCard({ front: { ...card.front, flavorText, flavorTextEnglish: flavorText } });
    },
    [card, patchGeneratedCard],
  );
  const handleAgeChange = useCallback(
    (age: string) => patchIdentity({ age }),
    [patchIdentity],
  );
  const handleStatChange = useCallback(
    (key: keyof CardPayload["stats"], value: number) => patchStats({ [key]: value }),
    [patchStats],
  );

  return (
    <div className="forge-preview">
      {card ? (
        <div className="forge-card-wrapper">
          <div className="forge-preview-stack">
            {layers.errors.length > 0 && (
              <div className="forge-image-errors">
                {layers.errors.map((error, index) => (
                  <p key={index} className="forge-image-error">{error}</p>
                ))}
              </div>
            )}

            {!isImageGenConfigured && (
              <p className="forge-image-notice">
                AI image generation is not configured. Set{" "}
                <code>VITE_IMAGE_API_URL</code> in your <code>.env</code> to
                enable Fal.ai layered artwork.
              </p>
            )}

            <section className="forge-preview-section">
              <h2 className="forge-preview-heading">Card Editor</h2>
              <CardContainer cardVars={cardVars}>
                <PrintedCardPreviewPair
                  boardImageLoading={boardImageLoading}
                  card={card}
                  backgroundImageUrl={layers.backgroundUrl}
                  characterImageUrl={layers.characterUrl}
                  frameImageUrl={layers.frameUrl}
                  characterBlend={characterBlend}
                  className="print-preview-area--forge"
                  editable
                  onNameChange={handleNameChange}
                  onBioChange={handleBioChange}
                  onAgeChange={handleAgeChange}
                  onStatChange={handleStatChange}
                  onBoardPlacementChange={onBoardPlacementChange}
                  onCharacterPlacementChange={onCharacterPlacementChange}
                />
              </CardContainer>
              <p className="forge-preview-hint">
                Use ◈ 3D for the spinning card and 🖨 Print for the print-ready popup.
              </p>
            </section>
          </div>
        </div>
      ) : (
        <div className="empty-preview">
          <span className="empty-icon">🛹</span>
          <span>Select prompts &amp; forge a card</span>
        </div>
      )}
    </div>
  );
}
