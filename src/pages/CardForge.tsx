import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Archetype, CardPrompts, CardPayload, Rarity, District, Gender, AgeGroup, BodyType, Faction, HairLength, SkinTone, FaceCharacter } from "../lib/types";
import { buildCharacterSeed, generateCard } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { CardViewer3D } from "../components/CardViewer3D";
import { PrintModal } from "../components/PrintModal";
import { ReferralPanel } from "../components/ReferralPanel";
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
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import type { BoardConfig } from "../lib/boardBuilder";
import { calculateBoardStats } from "../lib/boardBuilder";
import { buildRandomBoardConfig, getRandomItemExcluding } from "../lib/cardForgeRandom";
import { resolveArchetypeStyle } from "../lib/styles";
import { sfxSuccessPing, sfxSuccess, sfxError, sfxClick } from "../lib/sfx";
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
          onClick={() => {
            localStorage.removeItem("forge-welcome-dismissed");
            setShowWelcome(true);
          }}
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
        {/* ── Left column: form controls ── */}
        <div className="forge-form">
          <div className={`form-group${tier === "free" ? " form-group--locked" : ""}`}>
            <label>
              Cover Identity
              {tier === "free" && (
                <button type="button" className="form-group-lock-badge" onClick={openUpgradeModal} aria-label="Upgrade to unlock Cover Identity">
                  🔒 Upgrade
                </button>
              )}
            </label>
            <div className="pill-group">
              {FORGE_ARCHETYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`pill${prompts.archetype === opt.value ? " selected" : ""}`}
                  onClick={() => { sfxClick(); setArchetype(opt.value); }}
                  aria-pressed={prompts.archetype === opt.value}
                  disabled={tier === "free"}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="form-hint">Pick the public-facing role your courier presents to the city.</p>
          </div>

          <div className={`form-group${tier === "free" ? " form-group--locked" : ""}`}>
            <label>
              Class
              {tier === "free" && (
                <button type="button" className="form-group-lock-badge" onClick={openUpgradeModal} aria-label="Upgrade to unlock Class">
                  🔒 Upgrade
                </button>
              )}
            </label>
            <div className="pill-group">
              {RARITIES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.rarity === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("rarity", opt); }}
                  aria-pressed={prompts.rarity === opt}
                  disabled={tier === "free"}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className={`form-group${tier === "free" ? " form-group--locked" : ""}`}>
            <label>
              District
              {tier === "free" && (
                <button type="button" className="form-group-lock-badge" onClick={openUpgradeModal} aria-label="Upgrade to unlock District">
                  🔒 Upgrade
                </button>
              )}
            </label>
            <div className="pill-group">
              {DISTRICTS.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.district === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("district", opt); }}
                  aria-pressed={prompts.district === opt}
                  disabled={tier === "free"}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Gender</label>
            <div className="pill-group">
              {GENDERS.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.gender === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("gender", opt); }}
                  aria-pressed={prompts.gender === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Age Group</label>
            <div className="pill-group">
              {AGE_GROUPS.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.ageGroup === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("ageGroup", opt); }}
                  aria-pressed={prompts.ageGroup === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Body Type</label>
            <div className="pill-group">
              {BODY_TYPES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.bodyType === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("bodyType", opt); }}
                  aria-pressed={prompts.bodyType === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Hair Length</label>
            <div className="pill-group">
              {HAIR_LENGTHS.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.hairLength === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("hairLength", opt); }}
                  aria-pressed={prompts.hairLength === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Skin Tone</label>
            <div className="pill-group">
              {SKIN_TONES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.skinTone === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("skinTone", opt); }}
                  aria-pressed={prompts.skinTone === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Face Character</label>
            <div className="pill-group">
              {FACE_CHARACTERS.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.faceCharacter === opt ? " selected" : ""}`}
                  onClick={() => { sfxClick(); set("faceCharacter", opt); }}
                  aria-pressed={prompts.faceCharacter === opt}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Accent Color</label>
            <p className="form-hint">Accent color also drives hair color.</p>
            <div className="color-group">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch${prompts.accentColor === c ? " selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => { sfxClick(); set("accentColor", c); }}
                  aria-pressed={prompts.accentColor === c}
                  aria-label={`Accent color ${c}`}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Board Loadout</label>
            <p className="form-hint" style={{ marginBottom: 6 }}>
              Build your electric skateboard — your most important piece of gear.
            </p>
            <BoardBuilder
              value={boardConfig}
              onChange={setBoardConfig}
              accentColor={prompts.accentColor}
              onSave={(config) => { setBoardConfig(config); }}
            />
          </div>

          <button
            className="btn-primary btn-lg btn-forge"
            onClick={handleForge}
            disabled={forging || isAnyLayerLoading}
            data-testid="forge-button"
          >
            {isAnyLayerLoading
              ? "✨ Generating…"
              : !canForge
              ? "🔒 FORGE YOUR CARD — Upgrade to Unlock"
              : tier === "free" && !freeCardUsed
              ? "⚡ FORGE YOUR CARD (1 free card)"
              : generateCredits > 0
              ? `⚡ FORGE YOUR CARD (${generateCredits} credit${generateCredits === 1 ? "" : "s"} left)`
              : "⚡ FORGE YOUR CARD"
            }
          </button>

          {/* Referral panel — helps free-tier users earn credits by sharing */}
          <ReferralPanel />

          {/* Post-generation controls */}
          {generated && (
            <div className="forge-generated-actions">
              {(hasAnyLayerUrl || isAnyLayerLoading) && (
                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Character Blend</span>
                    <span>{Math.round(characterBlend * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={0}
                    max={1}
                    step={0.05}
                    value={characterBlend}
                    onChange={(e) => setCharacterBlend(Number(e.target.value))}
                  />
                </div>
              )}
              <div className="forge-generated-buttons">
                <button className="btn-outline btn-3d" onClick={() => { sfxClick(); setViewing3D(true); }} title="View card in 3D">
                  ◈ 3D
                </button>
                <button className="btn-outline" onClick={() => { sfxClick(); setPrinting(true); }} title="Print this card">
                  🖨 Print
                </button>
                {tierData.canSave ? (
                  <button
                    className="btn-primary"
                    onClick={handleSaveToCollection}
                    disabled={saving}
                    title="Save card to your Collection"
                  >
                    {saving ? "💾 Saving…" : "💾 Save to Collection"}
                  </button>
                ) : (
                  <button
                    className="btn-outline"
                    onClick={openUpgradeModal}
                    title="Upgrade to save cards to your Collection"
                  >
                    🔒 Save to Collection
                  </button>
                )}
                <button
                  className="btn-outline"
                  onClick={handleDownloadJpg}
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
          )}
        </div>

        {/* ── Right column: card preview ── */}
        <div className="forge-preview">
          {generated ? (
            <div className="forge-card-wrapper">
              <div>
                {/* Layer errors */}
                {layers.errors.length > 0 && (
                  <div className="forge-image-errors">
                    {layers.errors.map((err, i) => (
                      <p key={i} className="forge-image-error">{err}</p>
                    ))}
                  </div>
                )}

                {/* Image gen not configured notice */}
                {!isImageGenConfigured && (
                  <p className="forge-image-notice">
                    AI image generation is not configured. Set{" "}
                    <code>VITE_IMAGE_API_URL</code> in your <code>.env</code> to
                    enable Fal.ai layered artwork.
                  </p>
                )}

                <CardDisplay
                  card={generated}
                  backgroundImageUrl={layers.backgroundUrl}
                  characterImageUrl={layers.characterUrl}
                  frameImageUrl={layers.frameUrl}
                  layerLoading={layers.loading}
                  characterBlend={characterBlend}
                  hideToolButtons
                  onLayerError={handleLayerError}
                  onUpdate={(updates) => {
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
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="empty-preview">
              <span className="empty-icon">🛹</span>
              <span>Select prompts &amp; forge a card</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D viewer and print modals — rendered at page level since tool buttons are hidden on the card */}
      {generated && viewing3D && (
        <CardViewer3D
          card={generated}
          backgroundImageUrl={layers.backgroundUrl}
          characterImageUrl={layers.characterUrl}
          frameImageUrl={layers.frameUrl}
          characterBlend={characterBlend}
          onClose={() => setViewing3D(false)}
        />
      )}
      {generated && printing && (
        <PrintModal
          card={generated}
          backgroundImageUrl={layers.backgroundUrl}
          backgroundPrintUrl={layers.backgroundPrintUrl}
          characterImageUrl={layers.characterUrl}
          frameImageUrl={layers.frameUrl}
          characterBlend={characterBlend}
          onClose={() => setPrinting(false)}
        />
      )}
      {/* ── Save-to-collection celebration overlay ── */}
      {savedCard && (
        <div className="save-celebrate-overlay" onClick={() => { setSavedCard(null); navigate("/collection"); }}>
          <div className="save-celebrate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="save-celebrate-emoji">🎉</div>
            <h2 className="save-celebrate-title">
              {isFirstCard
                ? "Congrats! You saved your first card!"
                : "Card saved to your Collection!"}
            </h2>
            <p className="save-celebrate-name">{savedCard.identity.name}</p>
            <p className="save-celebrate-seed">SEED · {savedCard.seed}</p>
            <button
              className="btn-primary"
              onClick={() => { sfxClick(); setSavedCard(null); navigate("/collection"); }}
            >
              Go to My Collection →
            </button>
          </div>
        </div>
      )}
      {revealedFaction && (
        <div className="save-celebrate-overlay" onClick={() => setRevealedFaction(null)}>
          <div className="save-celebrate-modal save-celebrate-modal--reveal" onClick={(e) => e.stopPropagation()}>
            <div className="save-celebrate-emoji">{generated?.discovery?.logoMark ?? "🎴"}</div>
            <h2 className="save-celebrate-title">
              {revealedFaction.isNew
                ? "Secret faction discovered!"
                : "Faction signal reacquired!"}
            </h2>
            <p className="save-celebrate-name">{revealedFaction.faction}</p>
            <p className="save-celebrate-notice">
              Your forged card has been branded with the faction mark, and the Factions tab is now tracking what you know.
            </p>
            <div className="forge-generated-buttons">
              <button
                className="btn-primary"
                onClick={() => { setRevealedFaction(null); navigate("/factions"); }}
              >
                Open Factions →
              </button>
              <button
                className="btn-outline"
                onClick={() => setRevealedFaction(null)}
              >
                Keep Forging
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
