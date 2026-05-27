import { ForgeControlsPanel } from "./cardForge/ForgeControlsPanel";
import { ForgePreviewPanel } from "./cardForge/ForgePreviewPanel";
import { ForgeResultOverlays } from "./cardForge/ForgeResultOverlays";
import { ForgeWelcomeModal } from "./cardForge/ForgeWelcomeModal";
import {
  ACCENT_PRESETS,
  AGE_GROUPS,
  BODY_TYPES,
  DISTRICTS,
  FACE_CHARACTERS,
  GENDERS,
  HAIR_LENGTHS,
  RANDOM_SKATER_TOOLTIP,
  RARITIES,
  SKIN_TONES,
} from "./cardForge/constants";
import { useCardForgeController } from "./cardForge/useCardForgeController";
import { isImageGenConfigured } from "../services/imageGen";

export function CardForge() {
  const {
    boardConfig,
    boardImageLoading,
    canForge,
    characterBlend,
    closeWelcome,
    downloading,
    forging,
    freeCardUsed,
    generated,
    generateCredits,
    handleClose3D,
    handleCloseFactionReveal,
    handleClosePrint,
    handleCollectionNavigation,
    handleDownloadJpg,
    handleForge,
    handleOpen3D,
    handleOpenFactions,
    handleOpenPrint,
    handleRandomSkater,
    handleReopenWelcome,
    handleSaveToCollection,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    isFirstCard,
    layers,
    openUpgradeModal,
    patchGeneratedCard,
    patchIdentity,
    patchStats,
    printing,
    prompts,
    revealedFaction,
    saveError,
    savedCard,
    saving,
    setArchetype,
    setBoardConfig,
    setCharacterBlend,
    setPrompt,
    showWelcome,
    tier,
    tierCanSave,
    viewing3D,
  } = useCardForgeController();

  return (
    <div className="page">
      <span className="build-number">{__BUILD_NUMBER__}</span>
      <h1 className="page-title">CARD FORGE</h1>
      <p className="page-sub">Configure your Sk8r and forge a unique card</p>

      <ForgeWelcomeModal open={showWelcome} onClose={closeWelcome} />

      <div className="forge-quick-actions">
        <button
          type="button"
          className="btn-outline btn-sm forge-welcome-reopen"
          onClick={handleReopenWelcome}
          aria-label="Open Start Here welcome"
        >
          Start Here
        </button>
        <button
          type="button"
          className="btn-outline btn-sm forge-randomize-button"
          onClick={handleRandomSkater}
          disabled={forging || isAnyLayerLoading}
          title={RANDOM_SKATER_TOOLTIP}
          aria-label={`Random Skater. ${RANDOM_SKATER_TOOLTIP}`}
          data-testid="random-punch-skater-button"
        >
          Random Skater
        </button>
      </div>

      <div className="forge-layout">
        <ForgeControlsPanel
          accentPresets={ACCENT_PRESETS}
          ageGroups={AGE_GROUPS}
          bodyTypes={BODY_TYPES}
          boardConfig={boardConfig}
          canForge={canForge}
          canSaveToCollection={tierCanSave}
          characterBlend={characterBlend}
          districts={DISTRICTS}
          downloading={downloading}
          faceCharacters={FACE_CHARACTERS}
          forging={forging}
          freeCardUsed={freeCardUsed}
          genders={GENDERS}
          generateCredits={generateCredits}
          generated={generated}
          hairLengths={HAIR_LENGTHS}
          hasAnyLayerUrl={hasAnyLayerUrl}
          isAnyLayerLoading={isAnyLayerLoading}
          onArchetypeChange={setArchetype}
          onBlendChange={setCharacterBlend}
          onBoardConfigChange={setBoardConfig}
          onDownloadJpg={handleDownloadJpg}
          onForge={handleForge}
          onOpen3D={handleOpen3D}
          onOpenPrint={handleOpenPrint}
          onOpenUpgradeModal={openUpgradeModal}
          onPromptChange={setPrompt}
          onSaveToCollection={handleSaveToCollection}
          prompts={prompts}
          rarities={RARITIES}
          saveError={saveError}
          saving={saving}
          skinTones={SKIN_TONES}
          tier={tier}
        />

        <ForgePreviewPanel
          boardImageLoading={boardImageLoading}
          card={generated}
          characterBlend={characterBlend}
          isImageGenConfigured={isImageGenConfigured}
          layers={layers}
          patchGeneratedCard={patchGeneratedCard}
          patchIdentity={patchIdentity}
          patchStats={patchStats}
        />
      </div>

      <ForgeResultOverlays
        card={generated}
        characterBlend={characterBlend}
        isFirstCard={isFirstCard}
        layers={layers}
        onCloseFactionReveal={handleCloseFactionReveal}
        onClosePrint={handleClosePrint}
        onCloseViewer3D={handleClose3D}
        onGoToCollection={handleCollectionNavigation}
        onOpenFactions={handleOpenFactions}
        printing={printing}
        revealedFaction={revealedFaction}
        savedCard={savedCard}
        viewing3D={viewing3D}
      />
    </div>
  );
}
