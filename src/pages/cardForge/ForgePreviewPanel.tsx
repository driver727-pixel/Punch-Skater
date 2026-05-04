import { useCallback } from "react";
import { PrintedCardPreviewPair } from "../../components/PrintedCardFaces";
import { CardContainer } from "../../components/CardContainer";
import { buildCardVars } from "../../lib/cardVars";
import type { BoardPlacement, CardPayload, CharacterPlacement, CompositeLayerOrder } from "../../lib/types";
import type { LayerState } from "./useForgeLayers";
import {
  BOARD_PLACEMENT_MAX_SCALE,
  BOARD_PLACEMENT_MIN_SCALE,
  BOARD_PLACEMENT_SCALE_STEP,
  CHARACTER_PLACEMENT_MAX_SCALE,
  CHARACTER_PLACEMENT_MIN_SCALE,
  CHARACTER_PLACEMENT_SCALE_STEP,
} from "../../lib/boardPlacement";

interface ForgePreviewPanelProps {
  boardImageLoading: boolean;
  boardLayerOrder: CompositeLayerOrder;
  boardRotation: number;
  boardScale: number;
  canSaveToCollection: boolean;
  card: CardPayload | null;
  characterBlend: number;
  characterRotation: number;
  characterScale: number;
  downloading: boolean;
  isAnyLayerLoading: boolean;
  isImageGenConfigured: boolean;
  layers: LayerState;
  onBoardLayerOrderChange: (value: CompositeLayerOrder) => void;
  onBoardPlacementChange: (placement: BoardPlacement) => void;
  onBoardRotationChange: (value: number) => void;
  onBoardScaleChange: (value: number) => void;
  onCharacterPlacementChange: (placement: CharacterPlacement) => void;
  onCharacterRotationChange: (value: number) => void;
  onCharacterScaleChange: (value: number) => void;
  onDownloadJpg: () => void;
  onOpen3D: () => void;
  onOpenPrint: () => void;
  onOpenUpgradeModal: () => void;
  onSaveToCollection: () => void;
  patchGeneratedCard: (updates: Partial<CardPayload>) => void;
  patchIdentity: (updates: Partial<CardPayload["identity"]>) => void;
  patchStats: (updates: Partial<CardPayload["stats"]>) => void;
  saveError: string | null;
  saving: boolean;
}

export function ForgePreviewPanel({
  boardImageLoading,
  boardLayerOrder,
  boardRotation,
  boardScale,
  canSaveToCollection,
  card,
  characterBlend,
  characterRotation,
  characterScale,
  downloading,
  isAnyLayerLoading,
  isImageGenConfigured,
  layers,
  onBoardLayerOrderChange,
  onBoardPlacementChange,
  onBoardRotationChange,
  onBoardScaleChange,
  onCharacterPlacementChange,
  onCharacterRotationChange,
  onCharacterScaleChange,
  onDownloadJpg,
  onOpen3D,
  onOpenPrint,
  onOpenUpgradeModal,
  onSaveToCollection,
  patchGeneratedCard,
  patchIdentity,
  patchStats,
  saveError,
  saving,
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

            <div className="forge-generated-actions">
              <div className="blend-control">
                <label className="blend-control__label">
                  <span>Skateboard Size</span>
                  <span>{Math.round(boardScale * 100)}%</span>
                </label>
                <input
                  type="range"
                  className="range-slider"
                  min={BOARD_PLACEMENT_MIN_SCALE}
                  max={BOARD_PLACEMENT_MAX_SCALE}
                  step={BOARD_PLACEMENT_SCALE_STEP}
                  value={boardScale}
                  onChange={(event) => onBoardScaleChange(Number(event.target.value))}
                  aria-label="Skateboard size"
                />
              </div>
              <div className="blend-control">
                <label className="blend-control__label">
                  <span>Skateboard Rotation</span>
                  <span>{Math.round(boardRotation)}°</span>
                </label>
                <input
                  type="range"
                  className="range-slider"
                  min={-180}
                  max={180}
                  step={1}
                  value={boardRotation}
                  onChange={(event) => onBoardRotationChange(Number(event.target.value))}
                  aria-label="Skateboard rotation"
                />
              </div>
              <div className="blend-control">
                <label className="blend-control__label">
                  <span>Character Size</span>
                  <span>{Math.round(characterScale * 100)}%</span>
                </label>
                <input
                  type="range"
                  className="range-slider"
                  min={CHARACTER_PLACEMENT_MIN_SCALE}
                  max={CHARACTER_PLACEMENT_MAX_SCALE}
                  step={CHARACTER_PLACEMENT_SCALE_STEP}
                  value={characterScale}
                  onChange={(event) => onCharacterScaleChange(Number(event.target.value))}
                  aria-label="Character size"
                />
              </div>
              <div className="blend-control">
                <label className="blend-control__label">
                  <span>Character Rotation</span>
                  <span>{Math.round(characterRotation)}°</span>
                </label>
                <input
                  type="range"
                  className="range-slider"
                  min={-180}
                  max={180}
                  step={1}
                  value={characterRotation}
                  onChange={(event) => onCharacterRotationChange(Number(event.target.value))}
                  aria-label="Character rotation"
                />
              </div>
              <div className="blend-control">
                <label className="blend-control__label">
                  <span>Skateboard Layer</span>
                  <span>{boardLayerOrder === "behind-character" ? "Behind Character" : "In Front"}</span>
                </label>
                <input
                  type="range"
                  className="range-slider"
                  min={0}
                  max={1}
                  step={1}
                  value={boardLayerOrder === "behind-character" ? 0 : 1}
                  onChange={(event) => onBoardLayerOrderChange(Number(event.target.value) === 0 ? "behind-character" : "in-front")}
                  aria-label="Skateboard layer"
                />
                <p className="form-hint">
                  Drag the board or character on the card face to place them before saving. On mobile, use one finger to move and two fingers to pinch or rotate.
                </p>
              </div>
              <div className="forge-generated-buttons">
                <button className="btn-outline btn-3d" onClick={onOpen3D} title="View card in 3D">
                  ◈ 3D
                </button>
                <button className="btn-outline" onClick={onOpenPrint} title="Print this card">
                  🖨 Print
                </button>
                {canSaveToCollection ? (
                  <button
                    className="btn-primary"
                    onClick={onSaveToCollection}
                    disabled={saving}
                    title="Save card to your Collection"
                  >
                    {saving ? "💾 Saving…" : "💾 Save to Collection"}
                  </button>
                ) : (
                  <button
                    className="btn-outline"
                    onClick={onOpenUpgradeModal}
                    title="Upgrade to save cards to your Collection"
                  >
                    🔒 Save to Collection
                  </button>
                )}
                <button
                  className="btn-outline"
                  onClick={onDownloadJpg}
                  disabled={downloading || isAnyLayerLoading}
                  title="Download composed card as JPG"
                >
                  {downloading ? "⏳ Saving…" : "⬇ Download JPG"}
                </button>
              </div>
              {saveError && (
                <p className="forge-image-error" role="alert">{saveError}</p>
              )}
            </div>
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
