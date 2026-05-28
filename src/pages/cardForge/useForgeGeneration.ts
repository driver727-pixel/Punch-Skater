import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateCard } from "../../lib/generator";
import {
  applyFactionBranding,
  FORGE_ARCHETYPE_OPTIONS,
  getForgeArchetypeLabel,
  resolveSecretFaction,
} from "../../lib/factionDiscovery";
import { DEFAULT_BOARD_CONFIG } from "../../components/BoardBuilder";
import { enforceCompatibility, normalizeBoardConfig } from "../../lib/boardBuilder";
import { resolveArchetypeStyle } from "../../lib/styles";
import { sfxClick, sfxSuccessPing } from "../../lib/sfx";
import { removeBackground, isImageGenConfigured } from "../../services/imageGen";
import { generateGouacheBoard, shouldRemoveBoardImageBackground } from "../../services/boardImageGen";
import { buildBackgroundPrompt, buildCharacterPrompt, buildFramePrompt } from "../../lib/promptBuilder";
import ozziesConfig from "../../lib/ozziesConfig.json";
import { useTier } from "../../context/TierContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useWallet } from "../../context/WalletContext";
import { useFactionDiscovery } from "../../hooks/useFactionDiscovery";
import {
  COLLECTION_REROLL_ACTION_BY_ID,
  type CollectionRerollActionId,
} from "../../lib/collectionRewards";
import type {
  Archetype,
  BoardPlacement,
  CardPayload,
  CardPrompts,
  CharacterPlacement,
  CompositeLayerOrder,
  Faction,
  Rarity,
  WeaponPlacement,
} from "../../lib/types";
import {
  promoteCardClass,
  rollForgeRarity,
} from "../../lib/cardClassProgression";
import { createCharacterLayerValidator, type ForgeLayer, useForgeLayers } from "./useForgeLayers";
import {
  CHARACTER_CACHE_VERSION,
  CHARACTER_GENERATION_OPTIONS,
  CHARACTER_MIN_DIMENSIONS,
  CHARACTER_SEED_VARIANTS,
} from "./constants";
import { applyPreviewUpdates, buildRandomizedBoardConfig, buildRandomizedPrompts } from "./helpers";
import { loadForgeSession, saveForgeSession, type ForgeSessionData } from "../../services/forgeSessionCache";
import { resolveBoardPoseScene } from "../../lib/boardPoseScenes";
import {
  normalizeBoardPlacement,
  normalizeCharacterPlacement,
  normalizeWeaponPlacement,
  resolveBoardLayerOrder,
} from "../../lib/boardPlacement";
import { buildCraftlinguaFlavorFields } from "../../services/craftlingua";
import { spendCollectionReroll } from "../../services/collectionRewards";
import { spendOzzies } from "../../services/wallet";

const ARCHETYPE_VALUES = FORGE_ARCHETYPE_OPTIONS.map((option) => option.value);
const DEFAULT_CHARACTER_BLEND = 1;
const CHARACTER_LAYER_VALIDATOR = createCharacterLayerValidator(CHARACTER_MIN_DIMENSIONS);
const CARD_FORGE_OZZIES_COST = Number.isFinite(ozziesConfig.cardForgeCost)
  ? Math.max(1, Math.floor(ozziesConfig.cardForgeCost))
  : 25;

function buildVariationKey(actionId: CollectionRerollActionId): string {
  return `${actionId}:${Date.now()}:${crypto.randomUUID()}`;
}

function getSavedBoardConfig(session: ForgeSessionData | null) {
  if (!session?.card?.board?.config) return DEFAULT_BOARD_CONFIG;
  return enforceCompatibility(normalizeBoardConfig({
    ...DEFAULT_BOARD_CONFIG,
    ...session.card.board.config,
  }));
}

function formatTokenCount(count: number): string {
  return `${count} token${count === 1 ? "" : "s"}`;
}

function buildCharacterAttempts(baseSeed: string, variationKey?: string) {
  const variantSeed = variationKey ? `${baseSeed}|reroll|${variationKey}` : baseSeed;
  return CHARACTER_SEED_VARIANTS.map((variant) => ({
    seed: `${variantSeed}|${variant}`,
    generationOptions: CHARACTER_GENERATION_OPTIONS,
  }));
}

export function useForgeGeneration() {
  const {
    tier,
    canForge: tierCanForge,
    generateCredits,
    consumeCredit,
    freeForgeReadyAt,
    openUpgradeModal,
    freeCardUsed,
    markFreeCardUsed,
    startFreeForgeCooldown,
  } = useTier();
  const { user, userProfile } = useAuth();
  const { linkedLanguage, profile, useCraftlingua } = useLanguage();
  const { applyWalletMutation, wallet } = useWallet();
  const { hasFaction, unlockFaction } = useFactionDiscovery();
  const sessionOwnerKey = user?.uid ?? "guest";
  const skipNextSessionPersistRef = useRef(false);
  const craftlinguaSyncKeyRef = useRef("");
  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "Qu111s", rarity: "Punch Skater™", style: "Corporate",
    district: "Nightshade", accentColor: "#00ff88",
    gender: "Non-binary", ageGroup: "Adult", bodyType: "Athletic",
    hairLength: "Short", skinTone: "Medium", faceCharacter: "Conventional",
  });
  const [boardConfig, setBoardConfig] = useState(() => getSavedBoardConfig(loadForgeSession(sessionOwnerKey)));
  const [generated, setGenerated] = useState<CardPayload | null>(() => loadForgeSession(sessionOwnerKey)?.card ?? null);
  const [characterBlend, setCharacterBlend] = useState(() => loadForgeSession(sessionOwnerKey)?.characterBlend ?? DEFAULT_CHARACTER_BLEND);
  const [forging, setForging] = useState(false);
  const [boardImageLoading, setBoardImageLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [spendingOzzies, setSpendingOzzies] = useState(false);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletMessageTone, setWalletMessageTone] = useState<"info" | "error">("info");
  const [rerollTokens, setRerollTokens] = useState(0);
  const [rerollingActionId, setRerollingActionId] = useState<CollectionRerollActionId | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [revealedFaction, setRevealedFaction] = useState<{ faction: Faction; isNew: boolean } | null>(null);
  const [revealedRarity, setRevealedRarity] = useState<Rarity | null>(null);
  const {
    abortGeneration,
    generateLayer,
    handleLayerError,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    replaceAbortController,
    resetLayerSession,
    setLayerParams,
    setLayers,
  } = useForgeLayers();
  const ozziesBalance = wallet?.currentBalance ?? userProfile?.ozziesBalance ?? 0;
  const requiresOzzies = !tierCanForge && generateCredits === 0 && (tier !== "free" || freeCardUsed);
  const canSpendOzzies = Boolean(user && requiresOzzies && ozziesBalance >= CARD_FORGE_OZZIES_COST);
  const canForge = tierCanForge || canSpendOzzies;
  const boardPlacement = useMemo(() => {
    if (!generated) return null;
    const scene = resolveBoardPoseScene(generated.characterSeed);
    return normalizeBoardPlacement(scene.key, generated.board.placement);
  }, [generated]);
  const characterPlacement = useMemo(
    () => (generated ? normalizeCharacterPlacement(generated.characterPlacement) : null),
    [generated],
  );
  const weaponPlacement = useMemo(
    () => (generated ? normalizeWeaponPlacement(generated.weaponPlacement) : null),
    [generated],
  );
  const boardLayerOrder = useMemo(
    () => resolveBoardLayerOrder(generated?.board.layerOrder),
    [generated?.board.layerOrder],
  );

  useEffect(() => {
    setRerollTokens(userProfile?.collectionRewards?.rerollTokens ?? 0);
  }, [userProfile?.collectionRewards?.rerollTokens, user?.uid]);

  const refreshCraftlinguaFront = useCallback(async (card: CardPayload) => {
    const nextFront = await buildCraftlinguaFlavorFields({
      card,
      linkedLanguage,
      profile,
      useCraftlingua,
    });
    setGenerated((current) => (
      current && current.id === card.id
        ? { ...current, front: nextFront }
        : current
    ));
  }, [linkedLanguage, profile, useCraftlingua]);

  const clearRecoveryIssues = useCallback((layersToClear: ForgeLayer[] = [], clearBoardIssue = false) => {
    setRecoveryError("");
    setRecoveryMessage("");
    if (clearBoardIssue) setBoardError("");
    if (layersToClear.length === 0) return;
    setLayers((current) => ({
      ...current,
      errors: current.errors.filter((error) => !layersToClear.some((layer) => error.startsWith(`${layer}:`))),
    }));
  }, [setLayers]);

  const buildForgeLayerParams = useCallback((card: CardPayload, variationKey?: string) => {
    const backgroundPrompt = buildBackgroundPrompt(card.prompts.district);
    const characterPrompt = buildCharacterPrompt(card.prompts);
    const framePrompt = buildFramePrompt(card.prompts.rarity);
    const characterKey = `char::${CHARACTER_CACHE_VERSION}::${card.characterSeed}`;

    return {
      background: {
        key: `bg::${card.backgroundSeed}`,
        prompt: backgroundPrompt,
        seed: card.backgroundSeed,
      },
      character: {
        key: characterKey,
        prompt: characterPrompt,
        seed: card.characterSeed,
        attempts: buildCharacterAttempts(card.characterSeed, variationKey),
        postProcess: async (url: string) => (await removeBackground(url)).imageUrl,
        validateResult: CHARACTER_LAYER_VALIDATOR,
        generationOptions: CHARACTER_GENERATION_OPTIONS,
      },
      frame: {
        key: `frame::${card.frameSeed}`,
        prompt: framePrompt,
        seed: card.frameSeed,
        generationOptions: { loras: [] },
      },
    };
  }, []);

  const runBoardGeneration = useCallback(async (
    config = boardConfig,
    signal?: AbortSignal,
    options?: Parameters<typeof generateGouacheBoard>[1],
  ) => {
    setBoardImageLoading(true);
    setBoardError("");
    try {
      const boardImageUrl = await generateGouacheBoard(config, options);
      if (signal?.aborted) return false;
      let finalBoardUrl = boardImageUrl;
      if (shouldRemoveBoardImageBackground(config)) {
        try {
          finalBoardUrl = (await removeBackground(boardImageUrl)).imageUrl;
        } catch (bgError) {
          console.warn("Board background removal failed, using original image:", bgError);
        }
      }
      if (signal?.aborted) return false;
      setGenerated((current) => current ? {
        ...current,
        board: { ...current.board, imageUrl: finalBoardUrl },
      } : current);
      return true;
    } catch (error) {
      if (signal?.aborted) return false;
      const message = error instanceof Error ? error.message : "Board image generation failed.";
      console.warn("Board image generation failed:", error);
      setBoardError(message);
      return false;
    } finally {
      if (!signal?.aborted) setBoardImageLoading(false);
    }
  }, [boardConfig]);

  useEffect(() => {
    if (!generated) return;
    const syncKey = [
      generated.id,
      generated.front.flavorTextEnglish ?? generated.front.flavorText ?? "",
      linkedLanguage?.shareCode ?? "",
      profile?.exportedAt ?? "",
      useCraftlingua ? "enabled" : "disabled",
    ].join("|");
    if (craftlinguaSyncKeyRef.current === syncKey) return;
    craftlinguaSyncKeyRef.current = syncKey;
    void refreshCraftlinguaFront(generated);
  }, [generated, linkedLanguage?.shareCode, profile?.exportedAt, useCraftlingua, refreshCraftlinguaFront]);

  // Restore the per-user forge session whenever the active auth identity changes.
  useEffect(() => {
    abortGeneration();
    skipNextSessionPersistRef.current = true;
    const session = loadForgeSession(sessionOwnerKey);
    setBoardConfig(getSavedBoardConfig(session));
    setGenerated(session?.card ?? null);
    setCharacterBlend(session?.characterBlend ?? DEFAULT_CHARACTER_BLEND);
    setForging(false);
    setBoardImageLoading(false);
    setBoardError("");
    setSpendingOzzies(false);
    setWalletMessage(null);
    setWalletMessageTone("info");
    setRecoveryMessage("");
    setRecoveryError("");
    setRerollingActionId(null);
    setRevealedFaction(null);
    setRevealedRarity(null);
    setLayers({
      loading: { background: false, character: false, frame: false },
      errors: [],
      ...(session?.backgroundUrl != null ? { backgroundUrl: session.backgroundUrl } : {}),
      ...(session?.characterUrl != null ? { characterUrl: session.characterUrl } : {}),
      ...(session?.frameUrl != null ? { frameUrl: session.frameUrl } : {}),
    });
  }, [abortGeneration, sessionOwnerKey, setLayers]);

  // Persist the current forge state to sessionStorage whenever it changes.
  useEffect(() => {
    if (skipNextSessionPersistRef.current) {
      skipNextSessionPersistRef.current = false;
      return;
    }
    if (!generated) return;
    saveForgeSession({
      card: generated,
      backgroundUrl: layers.backgroundUrl,
      characterUrl: layers.characterUrl,
      frameUrl: layers.frameUrl,
      characterBlend,
    }, sessionOwnerKey);
  }, [generated, layers.backgroundUrl, layers.characterUrl, layers.frameUrl, characterBlend, sessionOwnerKey]);

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

    const controller = replaceAbortController();
    const { signal } = controller;
    const rolledRarity = rollForgeRarity(crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000);

    const forgePrompts = {
      ...prompts,
      rarity: rolledRarity,
      style: resolveArchetypeStyle(prompts.archetype, prompts.style),
    };
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
    const promotedCard = promoteCardClass(card);

    // ── Board stats & forge state (now inside buildForgedCard, but keep for board image) ─────
    const boardPoseScene = resolveBoardPoseScene(promotedCard.characterSeed);
    const cardWithBoard = {
      ...promotedCard,
      characterPlacement: normalizeCharacterPlacement(promotedCard.characterPlacement),
      board: {
        ...promotedCard.board,
        layerOrder: resolveBoardLayerOrder(promotedCard.board.layerOrder),
        placement: normalizeBoardPlacement(boardPoseScene.key, promotedCard.board.placement),
      },
    };
    setGenerated(cardWithBoard);
    void refreshCraftlinguaFront(cardWithBoard);
    setForging(true);
    setRevealedRarity(cardWithBoard.class.rarity);
    if (secretFaction) {
      const isNew = !hasFaction(secretFaction);
      unlockFaction(secretFaction);
      setRevealedFaction({ faction: secretFaction, isNew });
    } else {
      setRevealedFaction(null);
    }

    if (!requiresOzzies && tier === "free" && generateCredits === 0) {
      if (!freeCardUsed) {
        markFreeCardUsed();
      }
      startFreeForgeCooldown();
    } else if (generateCredits > 0) {
      consumeCredit();
    }

    resetLayerSession();
    clearRecoveryIssues(["background", "character", "frame"], true);

    void runBoardGeneration(boardConfig, signal);

    if (!isImageGenConfigured) {
      setForging(false);
      return;
    }

    const layerParams = buildForgeLayerParams(cardWithBoard);
    setLayerParams(layerParams);

    generateLayer("background", layerParams.background.key, layerParams.background.prompt, layerParams.background.seed, signal);
    generateLayer(
      "character",
      layerParams.character.key,
      layerParams.character.prompt,
      layerParams.character.seed,
      signal,
      layerParams.character.postProcess,
      layerParams.character.validateResult,
      layerParams.character.generationOptions,
      layerParams.character.attempts,
    );
    generateLayer("frame", layerParams.frame.key, layerParams.frame.prompt, layerParams.frame.seed, signal);

    setForging(false);
  }, [
    buildForgeLayerParams,
    boardConfig,
    canForge,
    clearRecoveryIssues,
    consumeCredit,
    freeCardUsed,
    generateCredits,
    generateLayer,
    hasFaction,
    markFreeCardUsed,
    openUpgradeModal,
    prompts,
    refreshCraftlinguaFront,
    replaceAbortController,
    requiresOzzies,
    resetLayerSession,
    runBoardGeneration,
    setLayerParams,
    startFreeForgeCooldown,
    tier,
    unlockFaction,
    user,
    applyWalletMutation,
  ]);

  const handleReroll = useCallback(async (actionId: CollectionRerollActionId) => {
    const action = COLLECTION_REROLL_ACTION_BY_ID[actionId];
    if (!action) return;
    if (!user) {
      setRecoveryError("Sign in to spend cosmetic reroll tokens.");
      return;
    }
    if (!generated) {
      setRecoveryError("Forge a card before using cosmetic rerolls.");
      return;
    }
    if (!isImageGenConfigured) {
      setRecoveryError("AI image generation is not configured on this server.");
      return;
    }
    if (rerollTokens < action.tokenCost) {
      setRecoveryError(`You need ${formatTokenCount(action.tokenCost)} for ${action.name.toLowerCase()}.`);
      return;
    }

    const controller = replaceAbortController();
    const { signal } = controller;
    const variationKey = buildVariationKey(actionId);
    const nextLayerParams = buildForgeLayerParams(generated, variationKey);
    const layersToClear = action.targets.filter((target): target is ForgeLayer => target === "character");

    setRerollingActionId(actionId);
    clearRecoveryIssues(layersToClear, action.targets.includes("board"));

    try {
      const spendResult = await spendCollectionReroll(user, actionId);
      if (signal.aborted) return;
      setRerollTokens(spendResult.evaluation.state.rerollTokens);
      const characterPromise = action.targets.includes("character")
        ? (() => {
            setLayerParams(nextLayerParams);
            return generateLayer(
              "character",
              nextLayerParams.character.key,
              nextLayerParams.character.prompt,
              nextLayerParams.character.seed,
              signal,
              nextLayerParams.character.postProcess,
              nextLayerParams.character.validateResult,
              nextLayerParams.character.generationOptions,
              nextLayerParams.character.attempts,
              true,
            );
          })()
        : Promise.resolve({ ok: true });

      const results = await Promise.all([
        characterPromise,
        action.targets.includes("board")
          ? runBoardGeneration(boardConfig, signal, { skipCache: true, variationKey })
          : Promise.resolve(true),
      ]);
      if (signal.aborted) return;

      const characterOk = !action.targets.includes("character") || results[0].ok;
      const boardOk = !action.targets.includes("board") || results[1];
      if (characterOk && boardOk) {
        setRecoveryMessage(`${action.name} complete. ${formatTokenCount(spendResult.evaluation.state.rerollTokens)} remaining.`);
        return;
      }

      setRecoveryError(
        `Spent ${formatTokenCount(action.tokenCost)}, but part of the reroll failed. Your previous art stays in place for any layer that did not finish.`,
      );
    } catch (error) {
      if (signal.aborted) return;
      setRecoveryError(error instanceof Error ? error.message : "Failed to spend cosmetic reroll tokens.");
    } finally {
      if (!signal.aborted) setRerollingActionId(null);
    }
  }, [
    boardConfig,
    buildForgeLayerParams,
    clearRecoveryIssues,
    generateLayer,
    generated,
    replaceAbortController,
    rerollTokens,
    runBoardGeneration,
    setLayerParams,
    user,
  ]);

  const handleForceRegenerateBoard = useCallback(async () => {
    if (userProfile?.isAdmin !== true) {
      setRecoveryError("Admin access is required to bypass the board image cache.");
      return;
    }
    if (!generated) {
      setRecoveryError("Forge a card before forcing a fresh board render.");
      return;
    }

    const controller = replaceAbortController();
    const { signal } = controller;
    clearRecoveryIssues([], true);

    const boardConfigToRender = generated.board.config ?? boardConfig;
    const ok = await runBoardGeneration(boardConfigToRender, signal, { skipCache: true });
    if (signal.aborted) return;
    if (ok) {
      setRecoveryMessage("Admin board regeneration complete. Save the card to keep this fresh board art.");
    }
  }, [
    boardConfig,
    clearRecoveryIssues,
    generated,
    replaceAbortController,
    runBoardGeneration,
    userProfile?.isAdmin,
  ]);

  const handleRandomSkater = useCallback(() => {
    sfxClick();
    setPrompts((current) => buildRandomizedPrompts(current, ARCHETYPE_VALUES));
    setBoardConfig((current) => buildRandomizedBoardConfig(current));
  }, []);

   const handlePreviewUpdate = useCallback((updates: { name?: string; age?: string; flavorText?: string }) => {
     setGenerated((current) => {
       const next = applyPreviewUpdates(current, updates);
       if (next && updates.flavorText !== undefined) {
         void refreshCraftlinguaFront(next);
       }
       return next;
     });
   }, [refreshCraftlinguaFront]);

  /** Shallow-merge a partial CardPayload into the generated card. */
  const patchGeneratedCard = useCallback((updates: Partial<CardPayload>) => {
    setGenerated((prev) => {
      const next = prev ? { ...prev, ...updates } : prev;
      const nextFlavorText = updates.front?.flavorText ?? updates.front?.flavorTextEnglish;
      if (next && nextFlavorText !== undefined) {
        void refreshCraftlinguaFront({
          ...next,
          front: {
            ...next.front,
            flavorText: updates.front?.flavorText ?? next.front.flavorText,
            flavorTextEnglish:
              updates.front?.flavorTextEnglish
              ?? updates.front?.flavorText
              ?? next.front.flavorTextEnglish
              ?? next.front.flavorText,
          },
        });
      }
      return next;
    });
  }, [refreshCraftlinguaFront]);

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

  const setBoardPlacement = useCallback((placement: BoardPlacement) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      const scene = resolveBoardPoseScene(prev.characterSeed);
      return {
        ...prev,
        board: {
          ...prev.board,
          placement: normalizeBoardPlacement(scene.key, placement),
        },
      };
    });
  }, []);

  const setBoardScale = useCallback((scale: number) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      const scene = resolveBoardPoseScene(prev.characterSeed);
      const currentPlacement = normalizeBoardPlacement(scene.key, prev.board.placement);
      return {
        ...prev,
        board: {
          ...prev.board,
          placement: normalizeBoardPlacement(scene.key, { ...currentPlacement, scale }),
        },
      };
    });
  }, []);

  const setBoardRotation = useCallback((rotationDeg: number) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      const scene = resolveBoardPoseScene(prev.characterSeed);
      const currentPlacement = normalizeBoardPlacement(scene.key, prev.board.placement);
      return {
        ...prev,
        board: {
          ...prev.board,
          placement: normalizeBoardPlacement(scene.key, { ...currentPlacement, rotationDeg }),
        },
      };
    });
  }, []);

  const setBoardLayerOrder = useCallback((layerOrder: CompositeLayerOrder) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            board: {
              ...prev.board,
              layerOrder: resolveBoardLayerOrder(layerOrder),
            },
          }
        : prev
    ));
  }, []);

  const setCharacterPlacement = useCallback((placement: CharacterPlacement) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            characterPlacement: normalizeCharacterPlacement(placement),
          }
        : prev
    ));
  }, []);

  const setCharacterScale = useCallback((scale: number) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            characterPlacement: normalizeCharacterPlacement({
              ...normalizeCharacterPlacement(prev.characterPlacement),
              scale,
            }),
          }
        : prev
    ));
  }, []);

  const setCharacterRotation = useCallback((rotationDeg: number) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            characterPlacement: normalizeCharacterPlacement({
              ...normalizeCharacterPlacement(prev.characterPlacement),
              rotationDeg,
            }),
          }
        : prev
    ));
  }, []);

  const setWeaponPlacement = useCallback((placement: WeaponPlacement) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            weaponPlacement: normalizeWeaponPlacement(placement),
          }
        : prev
    ));
  }, []);

  const setWeaponScale = useCallback((scale: number) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            weaponPlacement: normalizeWeaponPlacement({
              ...normalizeWeaponPlacement(prev.weaponPlacement),
              scale,
            }),
          }
        : prev
    ));
  }, []);

  const setWeaponRotation = useCallback((rotationDeg: number) => {
    setGenerated((prev) => (
      prev
        ? {
            ...prev,
            weaponPlacement: normalizeWeaponPlacement({
              ...normalizeWeaponPlacement(prev.weaponPlacement),
              rotationDeg,
            }),
          }
        : prev
    ));
  }, []);

  /** Admin-only: set the weapon layer URL from a pre-uploaded asset. */
  const setWeaponImageUrl = useCallback((url: string | undefined) => {
    setGenerated((prev) => (
      prev ? { ...prev, weaponImageUrl: url } : prev
    ));
    setLayers((current) => ({ ...current, weaponUrl: url }));
  }, [setLayers]);

  const handleCloseFactionReveal = useCallback(() => {
    setRevealedFaction(null);
  }, []);

  const handleCloseRarityReveal = useCallback(() => {
    setRevealedRarity(null);
  }, []);

  return useMemo(() => ({
    boardError,
    boardConfig,
    boardImageLoading,
    boardLayerOrder,
    boardPlacement,
    canForge,
    characterPlacement,
    characterBlend,
    forging,
    freeCardUsed,
    freeForgeReadyAt,
    generated,
    generateCredits,
    ozziesBalance,
    requiresOzzies,
    spendingOzzies,
    walletMessage,
    walletMessageTone,
    handleCloseFactionReveal,
    handleCloseRarityReveal,
    handleForge,
    handleForceRegenerateBoard,
    handleLayerError,
    handlePreviewUpdate,
    handleRandomSkater,
    handleReroll,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    openUpgradeModal,
    patchGeneratedCard,
    patchIdentity,
    patchStats,
    prompts,
    recoveryError,
    recoveryMessage,
    revealedFaction,
    revealedRarity,
    rerollTokens,
    rerollingActionId,
    setArchetype,
    setBoardConfig,
    setBoardLayerOrder,
    setBoardPlacement,
    setBoardRotation,
    setBoardScale,
    setCharacterPlacement,
    setCharacterRotation,
    setCharacterScale,
    setCharacterBlend,
    setPrompt,
    setWeaponImageUrl,
    setWeaponPlacement,
    setWeaponRotation,
    setWeaponScale,
    tier,
    weaponPlacement,
  }), [
    boardError,
    boardConfig,
    boardImageLoading,
    boardLayerOrder,
    boardPlacement,
    canForge,
    characterPlacement,
    characterBlend,
    forging,
    freeCardUsed,
    freeForgeReadyAt,
    generated,
    generateCredits,
    ozziesBalance,
    requiresOzzies,
    spendingOzzies,
    walletMessage,
    walletMessageTone,
    handleCloseFactionReveal,
    handleCloseRarityReveal,
    handleForge,
    handleForceRegenerateBoard,
    handleLayerError,
    handlePreviewUpdate,
    handleRandomSkater,
    handleReroll,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    openUpgradeModal,
    patchGeneratedCard,
    patchIdentity,
    patchStats,
    prompts,
    recoveryError,
    recoveryMessage,
    revealedFaction,
    revealedRarity,
    rerollTokens,
    rerollingActionId,
    setArchetype,
    setBoardConfig,
    setBoardLayerOrder,
    setBoardPlacement,
    setBoardRotation,
    setBoardScale,
    setCharacterPlacement,
    setCharacterRotation,
    setCharacterScale,
    setCharacterBlend,
    setPrompt,
    setWeaponImageUrl,
    setWeaponPlacement,
    setWeaponRotation,
    setWeaponScale,
    tier,
    weaponPlacement,
  ]);
}
