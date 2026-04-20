import { CardDisplay } from "../../components/CardDisplay";
import { CardViewer3D } from "../../components/CardViewer3D";
import { PrintedCardPreviewPair } from "../../components/PrintedCardFaces";
import type { CardPayload } from "../../lib/types";
import type { LayerState, ForgeLayer } from "./useForgeLayers";

interface ForgePreviewPanelProps {
  card: CardPayload | null;
  characterBlend: number;
  isImageGenConfigured: boolean;
  layers: LayerState;
  onCardUpdate: (updates: { name?: string; age?: number; flavorText?: string }) => void;
  onLayerError: (layer: ForgeLayer) => void;
}

export function ForgePreviewPanel({
  card,
  characterBlend,
  isImageGenConfigured,
  layers,
  onCardUpdate,
  onLayerError,
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

            <section className="forge-preview-section">
              <h2 className="forge-preview-heading">3D Viewer</h2>
              <CardViewer3D
                card={card}
                backgroundImageUrl={layers.backgroundUrl}
                characterImageUrl={layers.characterUrl}
                frameImageUrl={layers.frameUrl}
                characterBlend={characterBlend}
                inline
              />
            </section>

            <section className="forge-preview-section">
              <h2 className="forge-preview-heading">Printed Version</h2>
              <PrintedCardPreviewPair
                card={card}
                backgroundImageUrl={layers.backgroundUrl}
                characterImageUrl={layers.characterUrl}
                frameImageUrl={layers.frameUrl}
                characterBlend={characterBlend}
                className="print-preview-area--forge"
              />
            </section>

            <section className="forge-preview-section">
              <h2 className="forge-preview-heading">Final Stat Card</h2>
              <CardDisplay
                card={card}
                backgroundImageUrl={layers.backgroundUrl}
                characterImageUrl={layers.characterUrl}
                frameImageUrl={layers.frameUrl}
                layerLoading={layers.loading}
                characterBlend={characterBlend}
                hideToolButtons
                onLayerError={onLayerError}
                onUpdate={onCardUpdate}
              />
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
