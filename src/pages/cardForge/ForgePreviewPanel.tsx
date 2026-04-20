import { CardDisplay } from "../../components/CardDisplay";
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
          <div>
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
