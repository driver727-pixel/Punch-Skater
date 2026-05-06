import { BattlePassPanel } from "../components/BattlePassPanel";
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
  SKIN_TONES,
} from "./cardForge/constants";
import { useCardForgeController } from "./cardForge/useCardForgeController";
import { useBattlePass } from "../hooks/useBattlePass";
import { isImageGenConfigured } from "../services/imageGen";

export function CardForge() {
  const {
    boardError,
    boardConfig,
    boardImageLoading,
    boardLayerOrder,
    boardPlacement,
    canForge,
    characterPlacement,
    characterBlend,
    clearSavedCard,
    closeWelcome,
    downloading,
    forging,
    freeCardUsed,
    freeForgeReadyAt,
    generated,
    generateCredits,
    handleClose3D,
    handleCloseFactionReveal,
    handleCloseRarityReveal,
    handleClosePrint,
    handleCollectionNavigation,
    handleDownloadJpg,
    handleForge,
    handleOpen3D,
    handleOpenFactions,
    handleOpenPrint,
    handleRandomSkater,
    handleReroll,
    handleReopenWelcome,
    handleSaveToCollection,
    isAnyLayerLoading,
    isFirstCard,
    layers,
    openUpgradeModal,
    patchGeneratedCard,
    patchIdentity,
    patchStats,
    printing,
    prompts,
    recoveryError,
    recoveryMessage,
    revealedFaction,
    revealedRarity,
    rerollTokens,
    rerollingActionId,
    saveError,
    savedCard,
    saving,
    setArchetype,
    setBoardPlacement,
    setBoardScale,
    setBoardConfig,
    setBoardLayerOrder,
    setPrompt,
    setBoardRotation,
    setCharacterPlacement,
    setCharacterRotation,
    setCharacterScale,
    showWelcome,
    tier,
    tierCanSave,
    viewing3D,
  } = useCardForgeController();
  const battlePass = useBattlePass();

  return (
    <div className="page">
      <span className="build-number">{__BUILD_NUMBER__}</span>
      <h1 className="page-title">CARD FORGE</h1>
      <p className="page-sub">Forge your skater — then build a 6-card crew, run missions, win jousts, and climb the neon leaderboard</p>

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
          districts={DISTRICTS}
          faceCharacters={FACE_CHARACTERS}
          forging={forging}
          freeCardUsed={freeCardUsed}
          freeForgeReadyAt={freeForgeReadyAt}
          genders={GENDERS}
          generateCredits={generateCredits}
          hairLengths={HAIR_LENGTHS}
          isAnyLayerLoading={isAnyLayerLoading}
          onArchetypeChange={setArchetype}
          onBoardConfigChange={setBoardConfig}
          onForge={handleForge}
          onOpenUpgradeModal={openUpgradeModal}
          onPromptChange={setPrompt}
          prompts={prompts}
          skinTones={SKIN_TONES}
          tier={tier}
        />

        <ForgePreviewPanel
          boardError={boardError}
          boardImageLoading={boardImageLoading}
          boardLayerOrder={boardLayerOrder}
          boardRotation={boardPlacement?.rotationDeg ?? 0}
          boardScale={boardPlacement?.scale ?? 1}
          canSaveToCollection={tierCanSave}
          card={generated}
          characterBlend={characterBlend}
          characterRotation={characterPlacement?.rotationDeg ?? 0}
          characterScale={characterPlacement?.scale ?? 1}
          downloading={downloading}
          isAnyLayerLoading={isAnyLayerLoading}
          isImageGenConfigured={isImageGenConfigured}
          layers={layers}
          onBoardLayerOrderChange={setBoardLayerOrder}
          onBoardPlacementChange={setBoardPlacement}
          onBoardRotationChange={setBoardRotation}
          onBoardScaleChange={setBoardScale}
          onCharacterPlacementChange={setCharacterPlacement}
          onCharacterRotationChange={setCharacterRotation}
          onCharacterScaleChange={setCharacterScale}
          onDownloadJpg={handleDownloadJpg}
          onOpen3D={handleOpen3D}
          onOpenPrint={handleOpenPrint}
          onOpenUpgradeModal={openUpgradeModal}
          onReroll={handleReroll}
          onSaveToCollection={handleSaveToCollection}
          patchGeneratedCard={patchGeneratedCard}
          patchIdentity={patchIdentity}
          patchStats={patchStats}
          recoveryError={recoveryError}
          recoveryMessage={recoveryMessage}
          rerollTokens={rerollTokens}
          rerollingActionId={rerollingActionId}
          saveError={saveError}
          saving={saving}
        />
      </div>

      <BattlePassPanel battlePass={battlePass} />

      <ForgeResultOverlays
        card={generated}
        characterBlend={characterBlend}
        isFirstCard={isFirstCard}
        layers={layers}
        onCloseFactionReveal={handleCloseFactionReveal}
        onCloseRarityReveal={handleCloseRarityReveal}
        onClosePrint={handleClosePrint}
        onCloseViewer3D={handleClose3D}
        onGoToCollection={handleCollectionNavigation}
        onKeepForging={clearSavedCard}
        onOpenFactions={handleOpenFactions}
        printing={printing}
        revealedFaction={revealedFaction}
        revealedRarity={revealedRarity}
        savedCard={savedCard}
        viewing3D={viewing3D}
      />
    </div>
  );
}
