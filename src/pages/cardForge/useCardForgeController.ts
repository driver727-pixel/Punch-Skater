import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useForgeGeneration } from "./useForgeGeneration";
import { useForgeNavigation } from "./useForgeNavigation";
import { useForgeSave } from "./useForgeSave";

export function useCardForgeController() {
  const { user } = useAuth();
  const forge = useForgeGeneration();
  const save = useForgeSave({
    characterBlend: forge.characterBlend,
    generated: forge.generated,
    layers: forge.layers,
    openUpgradeModal: forge.openUpgradeModal,
    tier: forge.tier,
    uid: user?.uid ?? null,
  });
  const navigation = useForgeNavigation({
    onBeforeCollectionNavigation: save.clearSavedCard,
    onBeforeFactionsNavigation: forge.handleCloseFactionReveal,
  });

  return useMemo(() => ({
    boardConfig: forge.boardConfig,
    boardImageLoading: forge.boardImageLoading,
    canForge: forge.canForge,
    characterBlend: forge.characterBlend,
    closeWelcome: navigation.closeWelcome,
    downloading: save.downloading,
    forging: forge.forging,
    freeCardUsed: forge.freeCardUsed,
    generated: forge.generated,
    generateCredits: forge.generateCredits,
    handleClose3D: navigation.handleClose3D,
    handleCloseFactionReveal: forge.handleCloseFactionReveal,
    handleClosePrint: navigation.handleClosePrint,
    handleCollectionNavigation: navigation.handleCollectionNavigation,
    handleDownloadJpg: save.handleDownloadJpg,
    handleForge: forge.handleForge,
    handleLayerError: forge.handleLayerError,
    handleOpen3D: navigation.handleOpen3D,
    handleOpenFactions: navigation.handleOpenFactions,
    handleOpenPrint: navigation.handleOpenPrint,
    handlePreviewUpdate: forge.handlePreviewUpdate,
    handleRandomSkater: forge.handleRandomSkater,
    handleReopenWelcome: navigation.handleReopenWelcome,
    handleSaveToCollection: save.handleSaveToCollection,
    hasAnyLayerUrl: forge.hasAnyLayerUrl,
    isAnyLayerLoading: forge.isAnyLayerLoading,
    isFirstCard: save.isFirstCard,
    layers: forge.layers,
    openUpgradeModal: forge.openUpgradeModal,
    patchGeneratedCard: forge.patchGeneratedCard,
    patchIdentity: forge.patchIdentity,
    patchStats: forge.patchStats,
    printing: navigation.printing,
    prompts: forge.prompts,
    revealedFaction: forge.revealedFaction,
    saveError: save.saveError,
    savedCard: save.savedCard,
    saving: save.saving,
    setArchetype: forge.setArchetype,
    setBoardConfig: forge.setBoardConfig,
    setCharacterBlend: forge.setCharacterBlend,
    setPrompt: forge.setPrompt,
    showWelcome: navigation.showWelcome,
    tier: forge.tier,
    tierCanSave: save.tierCanSave,
    viewing3D: navigation.viewing3D,
  }), [forge, navigation, save]);
}
