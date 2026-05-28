import { useCallback, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { useCollection } from "../../hooks/useCollection";
import { TIERS, type TierLevel } from "../../lib/tiers";
import type { CardPayload } from "../../lib/types";
import { sfxError, sfxSuccess } from "../../lib/sfx";
import { downloadCardAsJpg } from "../../services/cardDownload";
import { db } from "../../lib/firebase";
import type { LayerState } from "./useForgeLayers";

interface UseForgeSaveOptions {
  characterBlend: number;
  generated: CardPayload | null;
  layers: LayerState;
  openUpgradeModal: () => void;
  tier: TierLevel;
  uid: string | null;
  userEmail: string | null;
}

function buildSavedCard(generated: CardPayload, layers: LayerState): CardPayload {
  return {
    ...generated,
    ...(layers.backgroundUrl != null ? { backgroundImageUrl: layers.backgroundUrl } : {}),
    ...(layers.characterUrl != null ? { characterImageUrl: layers.characterUrl } : {}),
    ...(layers.frameUrl != null ? { frameImageUrl: layers.frameUrl } : {}),
    ...(layers.weaponUrl != null ? { weaponImageUrl: layers.weaponUrl } : {}),
  };
}

export function useForgeSave({
  characterBlend,
  generated,
  layers,
  openUpgradeModal,
  tier,
  uid,
}: UseForgeSaveOptions) {
  const { addCard, cards } = useCollection();
  const tierData = TIERS[tier];
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCard, setSavedCard] = useState<CardPayload | null>(null);
  const [isFirstCard, setIsFirstCard] = useState(false);

  const handleSaveToCollection = useCallback(async () => {
    if (!generated) return;
    if (!tierData.canSave) {
      openUpgradeModal();
      return;
    }

    if (tierData.cardLimit !== null && cards.length >= tierData.cardLimit) {
      openUpgradeModal();
      return;
    }

    setSaving(true);
    setSaveError(null);
    const firstCard = cards.length === 0;
    const cardToSave = buildSavedCard(generated, layers);

    try {
      await addCard(cardToSave);
      sfxSuccess();
      setIsFirstCard(firstCard);
      setSavedCard(cardToSave);

    } catch (error) {
      console.error("Failed to save card:", error);
      sfxError();
      setSaveError("Failed to save card. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [addCard, cards.length, generated, layers, openUpgradeModal, tierData]);

  const handleSaveToAdminAssets = useCallback(async () => {
    if (!generated || !uid) return;

    setSaving(true);
    setSaveError(null);
    const cardToSave = buildSavedCard(generated, layers);

    try {
      await setDoc(doc(db, "adminBossAssets", cardToSave.id), cardToSave);
      sfxSuccess();
      setSavedCard(cardToSave);
    } catch (error) {
      console.error("Failed to save to admin assets:", error);
      sfxError();
      setSaveError("Failed to save to Admin Assets. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [generated, layers, uid]);

  const handleDownloadJpg = useCallback(async () => {
    if (!generated) return;
    setDownloading(true);
    try {
      await downloadCardAsJpg(
        generated.identity.name,
        generated.prompts.rarity,
        layers.backgroundUrl,
        layers.characterUrl,
        layers.frameUrl,
        generated.frameSeed,
        generated.visuals.accentColor,
        characterBlend,
        generated.board.imageUrl,
        generated.characterSeed,
        generated.board.placement,
        generated.characterPlacement,
        generated.board.layerOrder,
      );
    } catch (error) {
      console.error("Card JPG download failed:", error);
    } finally {
      setDownloading(false);
    }
  }, [characterBlend, generated, layers]);

  const clearSavedCard = useCallback(() => {
    setSavedCard(null);
  }, []);

  return useMemo(() => ({
    clearSavedCard,
    downloading,
    handleDownloadJpg,
    handleSaveToAdminAssets,
    handleSaveToCollection,
    isFirstCard,
    saveError,
    savedCard,
    saving,
    tierCanSave: tierData.canSave,
  }), [
    clearSavedCard,
    downloading,
    handleDownloadJpg,
    handleSaveToAdminAssets,
    handleSaveToCollection,
    isFirstCard,
    saveError,
    savedCard,
    saving,
    tierData.canSave,
  ]);
}
