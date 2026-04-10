import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { CardPrompts, CardPayload, Rarity, Style, Vibe, District, Gender, Faction } from "../lib/types";
import { generateCard } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { CardViewer3D } from "../components/CardViewer3D";
import { PrintModal } from "../components/PrintModal";
import { ReferralPanel } from "../components/ReferralPanel";
import { generateImage, removeBackground, isImageGenConfigured, getImageDimensions, type ImageGenOptions } from "../services/imageGen";
import { getCachedImage, setCachedImage } from "../services/imageCache";
import { getStaticBackgroundUrl, getStaticBackgroundSmallUrl, getStaticFrameUrl } from "../services/staticAssets";
import { buildCharacterPrompt, buildFramePrompt } from "../lib/promptBuilder";
import { useTier } from "../context/TierContext";
import { useCollection } from "../hooks/useCollection";
import { useFactionDiscovery } from "../hooks/useFactionDiscovery";
import { TIERS } from "../lib/tiers";
import { downloadCardAsJpg } from "../services/cardDownload";
import { applyFactionBranding, FORGE_ARCHETYPE_OPTIONS, getForgeArchetypeLabel, resolveSecretFaction } from "../lib/factionDiscovery";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import type { BoardConfig } from "../lib/boardBuilder";
import { calculateBoardStats } from "../lib/boardBuilder";
import { ACTIVE_STYLES } from "../lib/styles";

const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const STYLES: Style[] = ACTIVE_STYLES;
const VIBES: Vibe[] = ["Grunge", "Neon", "Chrome", "Plastic", "Recycled"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];

const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];

// ── Image generation layer helpers ─────────────────────────────────────────────

/** Maximum number of automatic retries per layer when a cached URL fails to load. */
const MAX_LAYER_RETRIES = 1;
const CHARACTER_CACHE_VERSION = "v2-hq";
const CHARACTER_GENERATION_OPTIONS: ImageGenOptions = {
  imageSize: { width: 1024, height: 1536 },
  numInferenceSteps: 45,
  guidanceScale: 4,
};
const CHARACTER_MIN_DIMENSIONS = { width: 900, height: 1300 };
const CHARACTER_SEED_VARIANTS = ["hq-a", "hq-b"];

/** Converts a display name to a kebab-case filename stem (e.g. "The Grid" → "the-grid"). */
function toFileSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

interface LayerState {
  backgroundUrl?: string;
  /** Full print-quality background URL (1536 × 2048 px). Only set when a
   *  screen-quality small variant is available; used for print / download. */
  backgroundPrintUrl?: string;
  characterUrl?: string;
  frameUrl?: string;
  loading: { background: boolean; character: boolean; frame: boolean };
  errors: string[];
}

/** Per-layer generation parameters stored for retry use by handleLayerError. */
interface LayerGenParams {
  key: string;
  prompt: string;
  seed?: string;
  attempts?: Array<{ seed: string; generationOptions?: ImageGenOptions }>;
  postProcess?: (url: string) => Promise<string>;
  validateResult?: (url: string) => Promise<void>;
  generationOptions?: ImageGenOptions;
}

const INITIAL_LAYER_STATE: LayerState = {
  loading: { background: false, character: false, frame: false },
  errors: [],
};

export function CardForge() {
  const { tier, canForge, generateCredits, consumeCredit, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];
  const navigate = useNavigate();
  const { addCard, cards } = useCollection();
  const { hasFaction, unlockFaction } = useFactionDiscovery();
  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "The Knights Technarchy", rarity: "Punch Skater", style: "Street",
    vibe: "Grunge", district: "Nightshade", accentColor: "#00ff88", stamina: 5,
    gender: "Non-binary",
  });
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [generated, setGenerated] = useState<CardPayload | null>(null);
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYER_STATE);
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

  // Abort controller ref for cancelling in-flight image generation
  const abortRef = useRef<AbortController | null>(null);

  // Per-layer retry tracking — each entry is the number of retries attempted for
  // the current forge session.  Reset when handleForge starts a fresh forge.
  const retryCountRef = useRef<Record<"background" | "character" | "frame", number>>({
    background: 0, character: 0, frame: 0,
  });

  // Parameters stored for each layer so the retry handler can re-trigger
  // generation without re-running the full forge flow.
  const layerParamsRef = useRef<Record<"background" | "character" | "frame", LayerGenParams | null>>({
    background: null, character: null, frame: null,
  });

  // Clean up on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const set = <K extends keyof CardPrompts>(key: K, val: CardPrompts[K]) =>
    setPrompts((p) => ({ ...p, [key]: val }));

  // ── Generate a single layer (background, character, or frame) ────────────
  const generateLayer = useCallback(
    async (
      layer: "background" | "character" | "frame",
      cacheKey: string,
      prompt: string,
      seed: string | undefined,
      signal: AbortSignal,
      postProcess?: (url: string) => Promise<string>,
      validateResult?: (url: string) => Promise<void>,
      generationOptions?: ImageGenOptions,
      attempts?: Array<{ seed: string; generationOptions?: ImageGenOptions }>,
      skipCache = false,
    ) => {
      setLayers((s) => ({ ...s, loading: { ...s.loading, [layer]: true } }));
      try {
        if (!skipCache) {
          // 1. Check for a pre-loaded static asset (served from public/assets/).
          //    These are permanent files that never expire and consume no credits.
          //    For backgrounds we prefer the screen-quality small variant for
          //    display and keep the full-size URL as backgroundPrintUrl for
          //    print / download.
          const staticUrl =
            layer === "background"
              ? getStaticBackgroundUrl(seed as District)
              : layer === "frame"
              ? getStaticFrameUrl(seed as Rarity)
              : null;

          if (staticUrl) {
            if (signal.aborted) return;
            if (layer === "background") {
              const smallUrl = getStaticBackgroundSmallUrl(seed as District);
              setLayers((s) => ({
                ...s,
                backgroundUrl: smallUrl ?? staticUrl,
                backgroundPrintUrl: smallUrl ? staticUrl : undefined,
                loading: { ...s.loading, background: false },
              }));
            } else {
              const urlKey = `${layer}Url` as keyof Pick<LayerState, "characterUrl" | "frameUrl">;
              setLayers((s) => ({
                ...s,
                [urlKey]: staticUrl,
                loading: { ...s.loading, [layer]: false },
              }));
            }
            return;
          }

          // 2. Check the Firestore cache (write-once, shared across users).
          const cached = await getCachedImage(cacheKey);
          if (signal.aborted) return;
          if (cached) {
            const urlKey = `${layer}Url` as keyof Pick<LayerState, "backgroundUrl" | "characterUrl" | "frameUrl">;
            setLayers((s) => ({
              ...s,
              [urlKey]: cached,
              loading: { ...s.loading, [layer]: false },
            }));
            return;
          }
        }

        // 3. Generate via Fal.ai
        const seedAttempts = attempts?.length
          ? attempts
          : seed
            ? [{ seed, generationOptions }]
            : [];

        if (seedAttempts.length === 0) {
          throw new Error(`No generation seed configured for ${layer} layer.`);
        }

        let finalUrl: string | null = null;
        let lastGenerationError: unknown = null;

        for (const attempt of seedAttempts) {
          try {
            const result = await generateImage(prompt, attempt.seed, attempt.generationOptions ?? generationOptions);
            if (signal.aborted) return;

            let candidateUrl = result.imageUrl;

            // Post-process (e.g., background removal for character layer)
            if (postProcess) {
              candidateUrl = await postProcess(candidateUrl);
              if (signal.aborted) return;
            }

            if (validateResult) {
              await validateResult(candidateUrl);
              if (signal.aborted) return;
            }

            finalUrl = candidateUrl;
            break;
          } catch (err) {
            lastGenerationError = err;
          }
        }

        if (!finalUrl) {
          throw lastGenerationError ?? new Error(`Failed to generate ${layer} layer.`);
        }

        // Log the URL so users can download and save as a static asset
        if (layer === "background") {
          console.info(`[StaticAsset] Generated background for ${seed}: ${finalUrl}`);
          console.info(`  → Download and save to public/assets/backgrounds/${toFileSlug(seed)}.jpg`);
          console.info(`  → Then register it in src/services/staticAssets.ts`);
        } else if (layer === "frame") {
          console.info(`[StaticAsset] Generated frame for ${seed}: ${finalUrl}`);
          console.info(`  → Download and save to public/assets/frames/${toFileSlug(seed)}.jpg`);
          console.info(`  → Then register it in src/services/staticAssets.ts`);
        }

        // Cache the result in Firestore (write-once; a concurrent write for the same
        // key is harmless — the second write is silently rejected by the security rule)
        await setCachedImage(cacheKey, finalUrl);

        const urlKey = `${layer}Url` as keyof Pick<LayerState, "backgroundUrl" | "characterUrl" | "frameUrl">;
        setLayers((s) => ({
          ...s,
          [urlKey]: finalUrl,
          loading: { ...s.loading, [layer]: false },
        }));
      } catch (err) {
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLayers((s) => ({
          ...s,
          loading: { ...s.loading, [layer]: false },
          errors: [...s.errors, `${layer}: ${msg}`],
        }));
      }
    },
    [],
  );

  // ── Main forge handler ───────────────────────────────────────────────────
  const handleForge = useCallback(() => {
    // Gate: free-tier users without referral credits cannot generate
    if (!canForge) {
      openUpgradeModal();
      return;
    }
    // Cancel any in-flight generation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const displayArchetype = getForgeArchetypeLabel(prompts.archetype);
    const secretFaction = resolveSecretFaction(prompts);
    const generationPrompts =
      secretFaction === "D4rk $pider"
        ? { ...prompts, archetype: "D4rk $pider" as const }
        : prompts;

    // Generate card payload
    const card = applyFactionBranding(
      generateCard(generationPrompts),
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

    // Consume one referral credit when on the free tier
    if (generateCredits > 0) {
      consumeCredit();
    }

    // Reset layer state
    setLayers(INITIAL_LAYER_STATE);

    // Reset per-layer retry counts for this new forge session
    retryCountRef.current = { background: 0, character: 0, frame: 0 };

    if (!isImageGenConfigured) {
      setForging(false);
      return;
    }

    // Kick off all three layers in parallel
    const bgPrompt    = "";
    const charPrompt  = buildCharacterPrompt(generationPrompts);
    const framePrompt = buildFramePrompt(prompts.rarity);

    const bgKey    = `bg::${card.backgroundSeed}`;
    const charKey  = `char::${CHARACTER_CACHE_VERSION}::${card.characterSeed}`;
    const frameKey = `frame::${card.frameSeed}`;

    const bgSeed    = card.backgroundSeed;
    const charSeed  = card.characterSeed;
    const frameSeed = card.frameSeed;

    const charPostProcess = async (url: string) => {
      const result = await removeBackground(url);
      return result.imageUrl;
    };
    const validateCharacterLayer = async (url: string) => {
      const { width, height } = await getImageDimensions(url);
      if (width < CHARACTER_MIN_DIMENSIONS.width || height < CHARACTER_MIN_DIMENSIONS.height) {
        throw new Error(
          `Character layer dimensions ${width}×${height} are below the minimum ${CHARACTER_MIN_DIMENSIONS.width}×${CHARACTER_MIN_DIMENSIONS.height}.`,
        );
      }
    };
    const charAttempts = CHARACTER_SEED_VARIANTS.map((variant) => ({
      seed: `${charSeed}|${variant}`,
      generationOptions: CHARACTER_GENERATION_OPTIONS,
    }));

    // Store params so handleLayerError can retry without re-running handleForge
    layerParamsRef.current = {
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
      frame:      { key: frameKey, prompt: framePrompt, seed: frameSeed  },
    };

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

    setForging(false);
  }, [prompts, boardConfig, generateLayer, canForge, generateCredits, consumeCredit, openUpgradeModal, hasFaction, unlockFaction]);

  // ── Expired-URL retry handler ────────────────────────────────────────────
  // Called when a composite img element fires onError (e.g. fal.ai CDN URL has
  // expired).  Bypasses the Firestore cache and re-generates from fal.ai.
  // Limited to one retry per layer per forge session to prevent infinite loops.
  const handleLayerError = useCallback(
    (layer: "background" | "character" | "frame") => {
      const params = layerParamsRef.current?.[layer];
      if (!params) return;

      // Only retry once per layer per forge session
      if (retryCountRef.current[layer] >= MAX_LAYER_RETRIES) return;
      retryCountRef.current[layer] += 1;

      // Clear the broken URL and errors, then re-generate skipping cache
      setLayers((s) => ({
        ...s,
        [`${layer}Url`]: undefined,
        errors: s.errors.filter((e) => !e.startsWith(`${layer}:`)),
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      generateLayer(
        layer,
        params.key,
        params.prompt,
        params.seed,
        controller.signal,
        params.postProcess,
        params.validateResult,
        params.generationOptions,
        params.attempts,
        true, // skipCache — bypass the expired Firestore URL
      );
    },
    [generateLayer],
  );

  // ── Derive UI state ──────────────────────────────────────────────────────
  const isAnyLayerLoading = layers.loading.background || layers.loading.character || layers.loading.frame;
  const hasAnyLayerUrl = !!(layers.backgroundUrl || layers.characterUrl || layers.frameUrl);

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
      setIsFirstCard(firstCard);
      setSavedCard(cardToSave);
    } catch (err) {
      console.error("Failed to save card:", err);
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
        layers.backgroundPrintUrl ?? layers.backgroundUrl,
        layers.characterUrl,
        layers.frameUrl,
        characterBlend,
      );
    } catch (err) {
      console.error("Card JPG download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [generated, layers, characterBlend]);

  return (
    <div className="page">
      <h1 className="page-title">CARD FORGE</h1>
      <p className="page-sub">Configure your courier and forge a unique card</p>

      <div className="forge-layout">
        {/* ── Left column: form controls ── */}
        <div className="forge-form">
          <div className="form-group">
            <label>Cover Identity</label>
            <div className="pill-group">
              {FORGE_ARCHETYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`pill${prompts.archetype === opt.value ? " selected" : ""}`}
                  onClick={() => set("archetype", opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="form-hint">Pick the public-facing role your courier presents to the city.</p>
          </div>

          <div className="form-group">
            <label>Class</label>
            <div className="pill-group">
              {RARITIES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.rarity === opt ? " selected" : ""}`}
                  onClick={() => set("rarity", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Style</label>
            <div className="pill-group">
              {STYLES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.style === opt ? " selected" : ""}`}
                  onClick={() => set("style", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Vibe</label>
            <div className="pill-group">
              {VIBES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.vibe === opt ? " selected" : ""}`}
                  onClick={() => set("vibe", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>District</label>
            <div className="pill-group">
              {DISTRICTS.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.district === opt ? " selected" : ""}`}
                  onClick={() => set("district", opt)}
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
                  onClick={() => set("gender", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Accent Color</label>
            <div className="color-group">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch${prompts.accentColor === c ? " selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => set("accentColor", c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                className="color-picker"
                value={prompts.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Stamina — {prompts.stamina}/10</label>
            <input
              type="range"
              className="stamina-slider"
              min={1}
              max={10}
              step={1}
              value={prompts.stamina}
              onChange={(e) => set("stamina", Number(e.target.value))}
            />
            <p className="form-hint">Higher stamina = heavier cargo capacity</p>
          </div>

          <div className="form-group">
            <label>Board Loadout</label>
            <p className="form-hint" style={{ marginBottom: 12 }}>
              Build your electric skateboard — your most important piece of gear.
            </p>
            <BoardBuilder
              value={boardConfig}
              onChange={setBoardConfig}
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
              ? "🔒 FORGE COURIER CARD — Upgrade to Unlock"
              : generateCredits > 0
              ? `⚡ FORGE COURIER CARD (${generateCredits} credit${generateCredits === 1 ? "" : "s"} left)`
              : "⚡ FORGE COURIER CARD"
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
                    className="stamina-slider"
                    min={0}
                    max={1}
                    step={0.05}
                    value={characterBlend}
                    onChange={(e) => setCharacterBlend(Number(e.target.value))}
                  />
                </div>
              )}
              <div className="forge-generated-buttons">
                <button className="btn-outline btn-3d" onClick={() => setViewing3D(true)} title="View card in 3D">
                  ◈ 3D
                </button>
                <button className="btn-outline" onClick={() => setPrinting(true)} title="Print this card">
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
                        identity: updates.name
                          ? { ...prev.identity, name: updates.name }
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
              onClick={() => { setSavedCard(null); navigate("/collection"); }}
            >
              Go to My Collection →
            </button>
          </div>
        </div>
      )}
      {revealedFaction && (
        <div className="save-celebrate-overlay" onClick={() => setRevealedFaction(null)}>
          <div className="save-celebrate-modal save-celebrate-modal--reveal" onClick={(e) => e.stopPropagation()}>
            <div className="save-celebrate-emoji">🕷</div>
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
