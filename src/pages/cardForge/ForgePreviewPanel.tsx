import { PrintedCardPreviewPair } from "../../components/PrintedCardFaces";
import type { CardPayload } from "../../lib/types";
import type { LayerState } from "./useForgeLayers";

interface ForgePreviewPanelProps {
  card: CardPayload | null;
  characterBlend: number;
  isImageGenConfigured: boolean;
  layers: LayerState;
}

export function ForgePreviewPanel({
  card,
  characterBlend,
  isImageGenConfigured,
  layers,
}: ForgePreviewPanelProps) {
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

            {card.board && (
              <section className="forge-preview-section">
                <h2 className="forge-preview-heading">Skateboard Preview</h2>
                <div className="forge-board-preview">
                  {card.boardImageUrl ? (
                    <img
                      src={card.boardImageUrl}
                      alt="Generated electric skateboard"
                      className="forge-board-preview__image"
                    />
                  ) : (
                    <div className="forge-board-preview__placeholder" role="status" aria-live="polite">
                      <span className="forge-board-preview__icon" aria-hidden="true">🛹</span>
                      <span className="forge-board-preview__label">Generating skateboard…</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="forge-preview-section">
              <h2 className="forge-preview-heading">Card Preview</h2>
              <PrintedCardPreviewPair
                card={card}
                backgroundImageUrl={layers.backgroundUrl}
                characterImageUrl={layers.characterUrl}
                frameImageUrl={layers.frameUrl}
                characterBlend={characterBlend}
                className="print-preview-area--forge"
              />
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
