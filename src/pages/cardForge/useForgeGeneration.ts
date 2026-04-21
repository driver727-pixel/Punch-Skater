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
import { useTier } from "../../context/TierContext";
import { useAuth } from "../../context/AuthContext";
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

const ARCHETYPE_VALUES = FORGE_ARCHETYPE_OPTIONS.map((option) => option.value);

export function useForgeGeneration() {
  const { tier, canForge, generateCredits, consumeCredit, openUpgradeModal, freeCardUsed, markFreeCardUsed } = useTier();
  const { user } = useAuth();
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

  const handleForge = useCallback(() => {
    if (!canForge) {
      openUpgradeModal();
      return;
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
      try {
        const boardImageUrl = await generateGouacheBoard(boardConfig);
        if (signal.aborted) return;
        setGenerated((current) => (current ? { ...current, boardImageUrl } : current));
      } catch (error) {
        console.warn("Board image generation failed:", error);
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
    resetLayerSession,
    setLayerParams,
    tier,
    unlockFaction,
    user?.uid,
  ]);

  const handleRandomSkater = useCallback(() => {
    sfxClick();
    setPrompts((current) => buildRandomizedPrompts(current, ARCHETYPE_VALUES));
    setBoardConfig((current) => buildRandomizedBoardConfig(current));
  }, []);

  const handlePreviewUpdate = useCallback((updates: { name?: string; age?: number; flavorText?: string }) => {
    setGenerated((current) => applyPreviewUpdates(current, updates));
  }, []);

  const handleCloseFactionReveal = useCallback(() => {
    setRevealedFaction(null);
  }, []);

  return useMemo(() => ({
    boardConfig,
    canForge,
    characterBlend,
    forging,
    freeCardUsed,
    generated,
    generateCredits,
    handleCloseFactionReveal,
    handleForge,
    handleLayerError,
    handlePreviewUpdate,
    handleRandomSkater,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    openUpgradeModal,
    prompts,
    revealedFaction,
    setArchetype,
    setBoardConfig,
    setCharacterBlend,
    setPrompt,
    tier,
  }), [
    boardConfig,
    canForge,
    characterBlend,
    forging,
    freeCardUsed,
    generated,
    generateCredits,
    handleCloseFactionReveal,
    handleForge,
    handleLayerError,
    handlePreviewUpdate,
    handleRandomSkater,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    openUpgradeModal,
    prompts,
    revealedFaction,
    setArchetype,
    setBoardConfig,
    setCharacterBlend,
    setPrompt,
    tier,
  ]);
}
