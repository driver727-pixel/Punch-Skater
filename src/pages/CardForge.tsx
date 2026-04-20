import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Archetype, CardPrompts, CardPayload, Rarity, District, Gender, AgeGroup, BodyType, Faction, HairLength, SkinTone, FaceCharacter } from "../lib/types";
import { buildCharacterSeed, generateCard } from "../lib/generator";
import { removeBackground, isImageGenConfigured, type ImageGenOptions } from "../services/imageGen";
import { generateGouacheBoard } from "../services/boardImageGen";
import { buildBackgroundPrompt, buildCharacterPrompt, buildFramePrompt } from "../lib/promptBuilder";
import { useTier } from "../context/TierContext";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { useFactionDiscovery } from "../hooks/useFactionDiscovery";
import { TIERS } from "../lib/tiers";
import { downloadCardAsJpg } from "../services/cardDownload";
import { applyFactionBranding, FORGE_ARCHETYPE_OPTIONS, getForgeArchetypeLabel, resolveSecretFaction } from "../lib/factionDiscovery";
import { DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import type { BoardConfig } from "../lib/boardBuilder";
import { calculateBoardStats } from "../lib/boardBuilder";
import { buildRandomBoardConfig, getRandomItemExcluding } from "../lib/cardForgeRandom";
import { resolveArchetypeStyle } from "../lib/styles";
import { sfxSuccessPing, sfxSuccess, sfxError, sfxClick } from "../lib/sfx";
import { ForgeControlsPanel } from "./cardForge/ForgeControlsPanel";
import { ForgePreviewPanel } from "./cardForge/ForgePreviewPanel";
import { ForgeResultOverlays } from "./cardForge/ForgeResultOverlays";
import { ForgeWelcomeModal } from "./cardForge/ForgeWelcomeModal";
import { createCharacterLayerValidator, useForgeLayers } from "./cardForge/useForgeLayers";

const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];
const AGE_GROUPS: AgeGroup[] = ["Young Adult", "Adult", "Middle-aged", "Senior"];
const BODY_TYPES: BodyType[] = ["Slim", "Athletic", "Average", "Heavy"];
const HAIR_LENGTHS: HairLength[] = ["Bald", "Short", "Medium", "Long"];
const SKIN_TONES: SkinTone[] = ["Light", "Medium", "Dark", "Very Dark"];
const FACE_CHARACTERS: FaceCharacter[] = ["Conventional", "Attractive", "Weathered", "Scarred", "Rugged"];
const ARCHETYPE_VALUES = FORGE_ARCHETYPE_OPTIONS.map((option) => option.value);
const RANDOM_SKATER_TOOLTIP = "Randomizes the Character loadout and the Board loadout with one click.";

const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#3366ff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];

const CHARACTER_CACHE_VERSION = "v4-dynamic-pose";
const CHARACTER_GENERATION_OPTIONS: ImageGenOptions = {
  imageSize: { width: 1088, height: 1536 },
  numInferenceSteps: 45,
  guidanceScale: 4,
  falProfile: "character",
};
const NON_LORA_GENERATION_OPTIONS: ImageGenOptions = {
  loras: [],
};
const CHARACTER_MIN_DIMENSIONS = { width: 1088, height: 1536 };
const CHARACTER_SEED_VARIANTS = ["hq-a", "hq-b"];

export function CardForge() {
  const { tier, canForge, generateCredits, consumeCredit, openUpgradeModal, freeCardUsed, markFreeCardUsed } = useTier();
  const { user } = useAuth();
  const tierData = TIERS[tier];
  const navigate = useNavigate();
  const { addCard, cards } = useCollection();
  const { hasFaction, unlockFaction } = useFactionDiscovery();
  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "Qu111s", rarity: "Punch Skater", style: "Corporate",
    district: "Nightshade", accentColor: "#00ff88",
    gender: "Non-binary", ageGroup: "Adult", bodyType: "Athletic",
    hairLength: "Short", skinTone: "Medium", faceCharacter: "Conventional",
  });
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [generated, setGenerated] = useState<CardPayload | null>(null);
  const [characterBlend, setCharacterBlend] = useState(1);
  const [forging, setForging] = useState(false);
  const [viewing3D, setViewing3D] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCard, setSavedCard] = useState<CardPayload | null>(null);
  const [isFirstCard, setIsFirstCard] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [revealedFaction, setRevealedFaction] = useState<{ faction: Faction; isNew: boolean } | null>(null);
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem("forge-welcome-dismissed") !== "1"
  );
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

  const closeWelcome = useCallback(() => {
    localStorage.setItem("forge-welcome-dismissed", "1");
    setShowWelcome(false);
  }, []);

  // Close welcome modal on Escape key
  useEffect(() => {
    if (!showWelcome) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWelcome();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showWelcome, closeWelcome]);

  const set = <K extends keyof CardPrompts>(key: K, val: CardPrompts[K]) =>
    setPrompts((p) => ({ ...p, [key]: val }));
  const setArchetype = (archetype: Archetype) =>
    setPrompts((current) => ({
      ...current,
      archetype,
      style: resolveArchetypeStyle(archetype, current.style),
    }));

  // ── Main forge handler ───────────────────────────────────────────────────
  const handleForge = useCallback(() => {
    // Gate: free-tier users without referral credits cannot generate
    if (!canForge) {
      openUpgradeModal();
      return;
    }
    // Play forge success ping sound effect
    sfxSuccessPing();

    // Cancel any in-flight generation
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

    // Generate card payload
    const card = applyFactionBranding(
      generateCard(generationPrompts, { idNonce }),
      displayArchetype,
      secretFaction,
    );
    // Attach the board loadout to the card (always recompute from config to
    // avoid stale stats when the user forges without clicking "Lock It In")
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

    // Consume one referral credit when on the free tier, or mark the free card as used
    if (tier === "free" && !freeCardUsed) {
      markFreeCardUsed();
    } else if (generateCredits > 0) {
      consumeCredit();
    }

    resetLayerSession();

    if (!isImageGenConfigured) {
      setForging(false);
      return;
    }

    // Kick off all three layers in parallel
    const bgPrompt    = buildBackgroundPrompt(forgePrompts.district);
    const charPrompt  = buildCharacterPrompt(forgePrompts);
    const framePrompt = buildFramePrompt(prompts.rarity);

    const bgKey    = `bg::${card.backgroundSeed}`;
    const charImageSeed = buildCharacterSeed(forgePrompts);
    const charKey  = `char::${CHARACTER_CACHE_VERSION}::${charImageSeed}`;
    const frameKey = `frame::${card.frameSeed}`;

    const bgSeed    = card.backgroundSeed;
    const charSeed  = charImageSeed;
    const frameSeed = card.frameSeed;

    const charPostProcess = async (url: string) => {
      const result = await removeBackground(url);
      return result.imageUrl;
    };
    const validateCharacterLayer = createCharacterLayerValidator(CHARACTER_MIN_DIMENSIONS);
    const charAttempts = CHARACTER_SEED_VARIANTS.map((variant) => ({
      seed: `${charSeed}|${variant}`,
      generationOptions: CHARACTER_GENERATION_OPTIONS,
    }));

    // Store params so handleLayerError can retry without re-running handleForge
    setLayerParams({
      background: { key: bgKey,    prompt: bgPrompt,    seed: bgSeed    },
      character:  {
        key: charKey,
        prompt: charPrompt,
        seed: charSeed,
        attempts: charAttempts,
        postProcess: charPostProcess,
        validateResult: validateCharacterLayer,
        generationOptions: CHARACTER_GENERATION_OPTIONS,
      },
      frame:      {
        key: frameKey,
        prompt: framePrompt,
        seed: frameSeed,
        generationOptions: NON_LORA_GENERATION_OPTIONS,
      },
    });

    // Background layer
    generateLayer("background", bgKey, bgPrompt, bgSeed, signal);

    // Character layer — post-process with background removal
    generateLayer(
      "character",
      charKey,
      charPrompt,
      charSeed,
      signal,
      charPostProcess,
      validateCharacterLayer,
      CHARACTER_GENERATION_OPTIONS,
      charAttempts,
    );

    // Frame layer
    generateLayer("frame", frameKey, framePrompt, frameSeed, signal);

    // Board image layer — generate a single skateboard image from the combined
    // component descriptions.  The result is stored as boardImageUrl on the card.
    (async () => {
      try {
        const boardImageUrl = await generateGouacheBoard(boardConfig);
        if (signal.aborted) return;
        setGenerated((prev) => prev ? { ...prev, boardImageUrl } : prev);
      } catch (err) {
        console.warn("Board image generation failed:", err);
      }
    })();

    setForging(false);
  }, [prompts, boardConfig, generateLayer, canForge, generateCredits, consumeCredit, openUpgradeModal, hasFaction, unlockFaction, user?.uid, tier, freeCardUsed, markFreeCardUsed, resetLayerSession, setLayerParams, abortRef]);

  // ── Save to Collection ───────────────────────────────────────────────────
  const handleSaveToCollection = useCallback(async () => {
    if (!generated) return;
    if (!tierData.canSave) {
      openUpgradeModal();
      return;
    }

    // Enforce collection card limit for the current tier
    const cardLimit = tierData.cardLimit;
    if (cardLimit !== null && cards.length >= cardLimit) {
      openUpgradeModal();
      return;
    }

    setSaving(true);
    setSaveError(null);

    // Capture whether this is the user's first card BEFORE updating state
    const firstCard = cards.length === 0;

    const cardToSave: CardPayload = {
      ...generated,
      ...(layers.backgroundUrl != null ? { backgroundImageUrl: layers.backgroundUrl } : {}),
      ...(layers.characterUrl != null ? { characterImageUrl: layers.characterUrl } : {}),
      ...(layers.frameUrl != null ? { frameImageUrl: layers.frameUrl } : {}),
    };

    try {
      await addCard(cardToSave);
      sfxSuccess();
      setIsFirstCard(firstCard);
      setSavedCard(cardToSave);
    } catch (err) {
      console.error("Failed to save card:", err);
      sfxError();
      setSaveError("Failed to save card. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [generated, layers, tierData, cards, addCard, openUpgradeModal]);

  // ── Download composed card as JPEG ──────────────────────────────────────
  const handleDownloadJpg = useCallback(async () => {
    if (!generated) return;
    setDownloading(true);
    try {
      await downloadCardAsJpg(
        generated.identity.name,
        generated.prompts.rarity,
        layers.backgroundPrintUrl ?? layers.backgroundUrl,
        layers.characterUrl,
        layers.frameUrl,
        generated.frameSeed,
        characterBlend,
      );
    } catch (err) {
      console.error("Card JPG download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [generated, layers, characterBlend]);

  const handleRandomSkater = useCallback(() => {
    sfxClick();

    setPrompts((current) => {
      const archetype = getRandomItemExcluding(ARCHETYPE_VALUES, current.archetype);
      return {
        ...current,
        archetype,
        style: resolveArchetypeStyle(archetype, current.style),
        rarity: getRandomItemExcluding(RARITIES, current.rarity),
        district: getRandomItemExcluding(DISTRICTS, current.district),
        accentColor: getRandomItemExcluding(ACCENT_PRESETS, current.accentColor),
        gender: getRandomItemExcluding(GENDERS, current.gender),
        ageGroup: getRandomItemExcluding(AGE_GROUPS, current.ageGroup),
        bodyType: getRandomItemExcluding(BODY_TYPES, current.bodyType),
        hairLength: getRandomItemExcluding(HAIR_LENGTHS, current.hairLength),
        skinTone: getRandomItemExcluding(SKIN_TONES, current.skinTone),
        faceCharacter: getRandomItemExcluding(FACE_CHARACTERS, current.faceCharacter),
      };
    });

    setBoardConfig((current) => buildRandomBoardConfig(current));
  }, []);

  const handleReopenWelcome = useCallback(() => {
    localStorage.removeItem("forge-welcome-dismissed");
    setShowWelcome(true);
  }, []);

  const handleOpen3D = useCallback(() => {
    sfxClick();
    setViewing3D(true);
  }, []);

  const handleOpenPrint = useCallback(() => {
    sfxClick();
    setPrinting(true);
  }, []);

  const handleCollectionNavigation = useCallback(() => {
    setSavedCard(null);
    navigate("/collection");
  }, [navigate]);

  const handleOpenFactions = useCallback(() => {
    setRevealedFaction(null);
    navigate("/factions");
  }, [navigate]);

  const handlePreviewUpdate = useCallback((updates: { name?: string; age?: number; flavorText?: string }) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        identity: (updates.name != null || updates.age != null)
          ? {
              ...prev.identity,
              ...(updates.name != null ? { name: updates.name } : {}),
              ...(updates.age != null ? { age: updates.age } : {}),
            }
          : prev.identity,
        flavorText: updates.flavorText ?? prev.flavorText,
      };
    });
  }, []);

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
          canSaveToCollection={tierData.canSave}
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
          onPromptChange={set}
          onSaveToCollection={handleSaveToCollection}
          prompts={prompts}
          rarities={RARITIES}
          saveError={saveError}
          saving={saving}
          skinTones={SKIN_TONES}
          tier={tier}
        />

        <ForgePreviewPanel
          card={generated}
          characterBlend={characterBlend}
          isImageGenConfigured={isImageGenConfigured}
          layers={layers}
          onCardUpdate={handlePreviewUpdate}
          onLayerError={handleLayerError}
        />
      </div>

      <ForgeResultOverlays
        card={generated}
        characterBlend={characterBlend}
        isFirstCard={isFirstCard}
        layers={layers}
        onCloseFactionReveal={() => setRevealedFaction(null)}
        onClosePrint={() => setPrinting(false)}
        onCloseViewer3D={() => setViewing3D(false)}
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
