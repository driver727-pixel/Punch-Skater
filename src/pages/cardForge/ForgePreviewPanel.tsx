import { useCallback } from "react";
import { PrintedCardPreviewPair } from "../../components/PrintedCardFaces";
import { CardContainer } from "../../components/CardContainer";
import { buildCardVars } from "../../lib/cardVars";
import {
  COLLECTION_REROLL_ACTIONS,
  type CollectionRerollActionId,
} from "../../lib/collectionRewards";
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

const FORGE_RATE_LIMIT_PATTERNS = [
  "too many image requests",
  "too many status requests",
];

function getForgeIssueLabel(error: string): string {
  const normalized = error.toLowerCase();
  if (normalized.includes("sign in")) return "Sign in required";
  if (FORGE_RATE_LIMIT_PATTERNS.some((pattern) => normalized.includes(pattern))) return "Image queue cooling down";
  if (normalized.includes("timed out")) return "Generation took too long";
  if (normalized.includes("not configured")) return "Image service unavailable";
  return "Generation hiccup";
}

function getForgeIssueHint(error: string): string {
  const normalized = error.toLowerCase();
  if (normalized.includes("sign in")) return "Sign back in, then try the reroll again.";
  if (FORGE_RATE_LIMIT_PATTERNS.some((pattern) => normalized.includes(pattern))) return "Wait a moment before retrying so the paid queue stays controlled.";
  if (normalized.includes("timed out")) return "Keep the current art or retry a smaller reroll when the queue is calmer.";
  if (normalized.includes("not configured")) return "The current card is still usable; the art pipeline just is not available right now.";
  return "Your current art stays in place until a reroll finishes successfully.";
}

interface ForgePreviewPanelProps {
  boardError: string;
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
  isAdmin: boolean;
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
  onForceRegenerateBoard: () => void;
  onOpen3D: () => void;
  onOpenPrint: () => void;
  onOpenUpgradeModal: () => void;
  onReroll: (actionId: CollectionRerollActionId) => void;
  onSaveToCollection: () => void;
  patchGeneratedCard: (updates: Partial<CardPayload>) => void;
  patchIdentity: (updates: Partial<CardPayload["identity"]>) => void;
  patchStats: (updates: Partial<CardPayload["stats"]>) => void;
  recoveryError: string;
  recoveryMessage: string;
  rerollTokens: number;
  rerollingActionId: CollectionRerollActionId | null;
  saveError: string | null;
  saving: boolean;
}

export function ForgePreviewPanel({
  boardError,
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
  isAdmin,
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
  onForceRegenerateBoard,
  onOpen3D,
  onOpenPrint,
  onOpenUpgradeModal,
  onReroll,
  onSaveToCollection,
  patchGeneratedCard,
  patchIdentity,
  patchStats,
  recoveryError,
  recoveryMessage,
  rerollTokens,
  rerollingActionId,
  saveError,
  saving,
}: ForgePreviewPanelProps) {
  const cardVars = buildCardVars(card, "editor");
  const issueMessages = [...layers.errors, ...(boardError ? [`board: ${boardError}`] : [])];
  const rerollButtonsDisabled = !card || !isImageGenConfigured || isAnyLayerLoading || boardImageLoading || saving;

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
            {issueMessages.length > 0 && (
              <div className="forge-image-errors">
                {issueMessages.map((error, index) => (
                  <div key={index} className="forge-image-error-card" role="alert">
                    <strong>{getForgeIssueLabel(error)}</strong>
                    <p className="forge-image-error">{error}</p>
                    <p className="forge-image-error-hint">{getForgeIssueHint(error)}</p>
                  </div>
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
            {recoveryMessage && (
              <p className="forge-image-notice forge-image-notice--success" role="status">{recoveryMessage}</p>
            )}
            {recoveryError && (
              <p className="forge-image-notice forge-image-notice--error" role="alert">{recoveryError}</p>
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
                  <span>Cosmetic Rerolls</span>
                  <span>{rerollTokens} token{rerollTokens === 1 ? "" : "s"}</span>
                </label>
                <p className="form-hint">
                  Partial rerolls keep the rest of the card intact. Full reroll refreshes character + board art together.
                </p>
                <div className="forge-reroll-buttons">
                  {COLLECTION_REROLL_ACTIONS.map((action) => {
                    const disabled = rerollButtonsDisabled || rerollTokens < action.tokenCost;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className="btn-outline"
                        disabled={disabled}
                        onClick={() => onReroll(action.id)}
                        title={action.description}
                      >
                        {rerollingActionId === action.id
                          ? `⏳ ${action.name}…`
                          : `${action.name} (${action.tokenCost})`}
                      </button>
                    );
                  })}
                </div>
                <p className="form-hint form-hint--secondary">
                  Earn more reroll tokens from Collection Rewards. Tokens only cover cosmetic image refreshes.
                </p>
              </div>
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
                {isAdmin && (
                  <button
                    className="btn-outline"
                    onClick={onForceRegenerateBoard}
                    disabled={!card || boardImageLoading || saving}
                    title="Admin only — bypasses the per-user board cache for a fresh render."
                    aria-label="Force regenerate board art and ignore cache"
                  >
                    {boardImageLoading ? "⏳ Regenerating…" : "🛠 Force regenerate (ignore cache)"}
                  </button>
                )}
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
                  disabled={downloading || isAnyLayerLoading || boardImageLoading}
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
