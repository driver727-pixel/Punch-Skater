import { useCallback, useMemo, useState } from "react";
import { buildCharacterSeed, generateCard } from "../../lib/generator";
import {
  applyFactionBranding,
  FORGE_ARCHETYPE_OPTIONS,
  getForgeArchetypeLabel,
  resolveSecretFaction,
} from "../../lib/factionDiscovery";
import { DEFAULT_BOARD_CONFIG } from "../../components/BoardBuilder";
import { calculateBoardStats } from "../../lib/boardBuilder";
import { resolveArchetypeStyle } from "../../lib/styles";
import { sfxClick, sfxSuccessPing } from "../../lib/sfx";
import { removeBackground, isImageGenConfigured } from "../../services/imageGen";
import { generateGouacheBoard } from "../../services/boardImageGen";
import { buildBackgroundPrompt, buildCharacterPrompt, buildFramePrompt } from "../../lib/promptBuilder";
import ozziesConfig from "../../lib/ozziesConfig.json";
import { useTier } from "../../context/TierContext";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";
import { useFactionDiscovery } from "../../hooks/useFactionDiscovery";
import type { Archetype, CardPayload, CardPrompts, Faction } from "../../lib/types";
import { createCharacterLayerValidator, useForgeLayers } from "./useForgeLayers";
import {
  CHARACTER_CACHE_VERSION,
  CHARACTER_GENERATION_OPTIONS,
  CHARACTER_MIN_DIMENSIONS,
  CHARACTER_SEED_VARIANTS,
} from "./constants";
import { applyPreviewUpdates, buildRandomizedBoardConfig, buildRandomizedPrompts } from "./helpers";
import { spendOzzies } from "../../services/wallet";

const ARCHETYPE_VALUES = FORGE_ARCHETYPE_OPTIONS.map((option) => option.value);
const CARD_FORGE_OZZIES_COST = Number.isFinite(ozziesConfig.cardForgeCost)
  ? Math.max(1, Math.floor(ozziesConfig.cardForgeCost))
  : 25;

export function useForgeGeneration() {
  const { tier, canForge: tierCanForge, generateCredits, consumeCredit, openUpgradeModal, freeCardUsed, markFreeCardUsed } = useTier();
  const { user, userProfile } = useAuth();
  const { applyWalletMutation, wallet } = useWallet();
  const { hasFaction, unlockFaction } = useFactionDiscovery();
  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "Qu111s", rarity: "Punch Skater", style: "Corporate",
    district: "Nightshade", accentColor: "#00ff88",
    gender: "Non-binary", ageGroup: "Adult", bodyType: "Athletic",
    hairLength: "Short", skinTone: "Medium", faceCharacter: "Conventional",
  });
  const [boardConfig, setBoardConfig] = useState(DEFAULT_BOARD_CONFIG);
  const [generated, setGenerated] = useState<CardPayload | null>(null);
  const [characterBlend, setCharacterBlend] = useState(1);
  const [forging, setForging] = useState(false);
  const [boardImageLoading, setBoardImageLoading] = useState(false);
  const [spendingOzzies, setSpendingOzzies] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletMessageTone, setWalletMessageTone] = useState<"info" | "error">("info");
  const [revealedFaction, setRevealedFaction] = useState<{ faction: Faction; isNew: boolean } | null>(null);
  const {
    abortRef,
    generateLayer,
    handleLayerError,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    resetLayerSession,
    setLayerParams,
  } = useForgeLayers();
  const ozziesBalance = wallet?.currentBalance ?? userProfile?.ozziesBalance ?? 0;
  const requiresOzzies = !tierCanForge && generateCredits === 0 && (tier !== "free" || freeCardUsed);
  const canSpendOzzies = Boolean(user && ozziesBalance >= CARD_FORGE_OZZIES_COST);
  const canForge = tierCanForge || canSpendOzzies;

  const setPrompt = useCallback(<K extends keyof CardPrompts>(key: K, value: CardPrompts[K]) => {
    setPrompts((current) => ({ ...current, [key]: value }));
  }, []);

  const setArchetype = useCallback((archetype: Archetype) => {
    setPrompts((current) => ({
      ...current,
      archetype,
      style: resolveArchetypeStyle(archetype, current.style),
    }));
  }, []);

  const handleForge = useCallback(async () => {
    if (!canForge) {
      if (requiresOzzies && user) {
        setWalletMessageTone("error");
        setWalletMessage(`You need ${CARD_FORGE_OZZIES_COST} Ozzies to forge after your free and referral credits are gone.`);
        return;
      }
      openUpgradeModal();
      return;
    }
    setWalletMessage(null);
    if (requiresOzzies) {
      if (!user) {
        openUpgradeModal();
        return;
      }
      setSpendingOzzies(true);
      try {
        const walletSpend = await spendOzzies(user, {
          sink: "card_forge",
          idempotencyKey: crypto.randomUUID(),
        });
        applyWalletMutation(walletSpend);
        setWalletMessageTone("info");
        setWalletMessage(`Spent ${CARD_FORGE_OZZIES_COST} Ozzies. Balance: ${walletSpend.wallet.currentBalance}.`);
      } catch (error) {
        setWalletMessageTone("error");
        setWalletMessage(error instanceof Error ? error.message : "Card Forge could not spend Ozzies.");
        return;
      } finally {
        setSpendingOzzies(false);
      }
    }
    sfxSuccessPing();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const forgePrompts = { ...prompts, style: resolveArchetypeStyle(prompts.archetype, prompts.style) };
    const displayArchetype = getForgeArchetypeLabel(forgePrompts.archetype);
    const secretFaction = tier === "free" ? null : resolveSecretFaction(forgePrompts);
    const generationPrompts =
      secretFaction === "D4rk $pider"
        ? { ...forgePrompts, archetype: "D4rk $pider" as const }
        : forgePrompts;
    const idNonce = `${user?.uid ?? "guest"}:${Date.now()}:${crypto.randomUUID()}`;
    const card = applyFactionBranding(
      generateCard(generationPrompts, { idNonce }),
      displayArchetype,
      secretFaction,
    );
    const cardWithBoard = { ...card, board: boardConfig, boardLoadout: calculateBoardStats(boardConfig) };
    setGenerated(cardWithBoard);
    setForging(true);
    if (secretFaction) {
      const isNew = !hasFaction(secretFaction);
      unlockFaction(secretFaction);
      setRevealedFaction({ faction: secretFaction, isNew });
    } else {
      setRevealedFaction(null);
    }

    if (tier === "free" && !freeCardUsed) {
      markFreeCardUsed();
    } else if (generateCredits > 0) {
      consumeCredit();
    }

    resetLayerSession();

    (async () => {
      setBoardImageLoading(true);
      try {
        const boardImageUrl = await generateGouacheBoard(boardConfig);
        if (signal.aborted) return;
        setGenerated((current) => (current ? { ...current, boardImageUrl } : current));
      } catch (error) {
        console.warn("Board image generation failed:", error);
      } finally {
        if (!signal.aborted) setBoardImageLoading(false);
      }
    })();

    if (!isImageGenConfigured) {
      setForging(false);
      return;
    }

    const backgroundPrompt = buildBackgroundPrompt(forgePrompts.district);
    const characterPrompt = buildCharacterPrompt(forgePrompts);
    const framePrompt = buildFramePrompt(prompts.rarity);
    const backgroundKey = `bg::${card.backgroundSeed}`;
    const charImageSeed = buildCharacterSeed(forgePrompts);
    const characterKey = `char::${CHARACTER_CACHE_VERSION}::${charImageSeed}`;
    const frameKey = `frame::${card.frameSeed}`;
    const charPostProcess = async (url: string) => (await removeBackground(url)).imageUrl;
    const validateCharacterLayer = createCharacterLayerValidator(CHARACTER_MIN_DIMENSIONS);
    const characterAttempts = CHARACTER_SEED_VARIANTS.map((variant) => ({
      seed: `${charImageSeed}|${variant}`,
      generationOptions: CHARACTER_GENERATION_OPTIONS,
    }));

    setLayerParams({
      background: { key: backgroundKey, prompt: backgroundPrompt, seed: card.backgroundSeed },
      character: {
        key: characterKey,
        prompt: characterPrompt,
        seed: charImageSeed,
        attempts: characterAttempts,
        postProcess: charPostProcess,
        validateResult: validateCharacterLayer,
        generationOptions: CHARACTER_GENERATION_OPTIONS,
      },
      frame: {
        key: frameKey,
        prompt: framePrompt,
        seed: card.frameSeed,
        generationOptions: { loras: [] },
      },
    });

    generateLayer("background", backgroundKey, backgroundPrompt, card.backgroundSeed, signal);
    generateLayer(
      "character",
      characterKey,
      characterPrompt,
      charImageSeed,
      signal,
      charPostProcess,
      validateCharacterLayer,
      CHARACTER_GENERATION_OPTIONS,
      characterAttempts,
    );
    generateLayer("frame", frameKey, framePrompt, card.frameSeed, signal);

    setForging(false);
  }, [
    abortRef,
    boardConfig,
    canForge,
    consumeCredit,
    freeCardUsed,
    generateCredits,
    generateLayer,
    hasFaction,
    markFreeCardUsed,
    openUpgradeModal,
    prompts,
    requiresOzzies,
    resetLayerSession,
    setLayerParams,
    tier,
    unlockFaction,
    user,
    applyWalletMutation,
  ]);

  const handleRandomSkater = useCallback(() => {
    sfxClick();
    setPrompts((current) => buildRandomizedPrompts(current, ARCHETYPE_VALUES));
    setBoardConfig((current) => buildRandomizedBoardConfig(current));
  }, []);

  const handlePreviewUpdate = useCallback((updates: { name?: string; age?: number; flavorText?: string }) => {
    setGenerated((current) => applyPreviewUpdates(current, updates));
  }, []);

  /** Shallow-merge a partial CardPayload into the generated card. */
  const patchGeneratedCard = useCallback((updates: Partial<CardPayload>) => {
    setGenerated((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  /** Deep-merge a partial identity object into the generated card's identity. */
  const patchIdentity = useCallback((updates: Partial<CardPayload["identity"]>) => {
    setGenerated((prev) =>
      prev ? { ...prev, identity: { ...prev.identity, ...updates } } : prev,
    );
  }, []);

  /** Deep-merge partial stats into the generated card. Callers should pass
   *  already-validated values (within 0–10); clamp only happens in the UI. */
  const patchStats = useCallback((updates: Partial<CardPayload["stats"]>) => {
    setGenerated((prev) =>
      prev ? { ...prev, stats: { ...prev.stats, ...updates } } : prev,
    );
  }, []);

  const handleCloseFactionReveal = useCallback(() => {
    setRevealedFaction(null);
  }, []);

  return useMemo(() => ({
    boardConfig,
    boardImageLoading,
    canForge,
    characterBlend,
    forging,
    freeCardUsed,
    generated,
    generateCredits,
    ozziesBalance,
    requiresOzzies,
    spendingOzzies,
    walletMessage,
    walletMessageTone,
    handleCloseFactionReveal,
    handleForge,
    handleLayerError,
    handlePreviewUpdate,
    handleRandomSkater,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    openUpgradeModal,
    patchGeneratedCard,
    patchIdentity,
    patchStats,
    prompts,
    revealedFaction,
    setArchetype,
    setBoardConfig,
    setCharacterBlend,
    setPrompt,
    tier,
  }), [
    boardConfig,
    boardImageLoading,
    canForge,
    characterBlend,
    forging,
    freeCardUsed,
    generated,
    generateCredits,
    ozziesBalance,
    requiresOzzies,
    spendingOzzies,
    walletMessage,
    walletMessageTone,
    handleCloseFactionReveal,
    handleForge,
    handleLayerError,
    handlePreviewUpdate,
    handleRandomSkater,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    openUpgradeModal,
    patchGeneratedCard,
    patchIdentity,
    patchStats,
    prompts,
    revealedFaction,
    setArchetype,
    setBoardConfig,
    setCharacterBlend,
    setPrompt,
    tier,
  ]);
}
