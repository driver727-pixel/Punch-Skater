import { useState, useCallback, useRef, useEffect } from "react";
import { CardPrompts, CardPayload, Archetype, Rarity, Style, Vibe, District, Gender } from "../lib/types";
import { generateCard } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { CardViewer3D } from "../components/CardViewer3D";
import { PrintModal } from "../components/PrintModal";
import { generateImage, removeBackground, isImageGenConfigured } from "../services/imageGen";
import { getCachedImage, setCachedImage } from "../services/imageCache";
import { buildBackgroundPrompt, buildCharacterPrompt, buildFramePrompt } from "../lib/promptBuilder";

const ARCHETYPES: Archetype[] = ["The Knights Technarchy", "Qu111s", "Iron Curtains", "D4rk $pider", "The Asclepians", "The Mesopotamian Society", "Hermes' Squirmies", "UCPS", "The Team"];
const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const STYLES: Style[] = ["Corporate", "Ninja", "Punk Rocker", "Ex Military", "Hacker", "Chef", "Fascist", "Street", "Off-grid", "Military", "Union", "Olympic"];
const VIBES: Vibe[] = ["Grunge", "Neon", "Chrome", "Plastic", "Recycled"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];

const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];

// ── Image generation layer helpers ─────────────────────────────────────────────

interface LayerState {
  backgroundUrl?: string;
  characterUrl?: string;
  frameUrl?: string;
  loading: { background: boolean; character: boolean; frame: boolean };
  errors: string[];
}

const INITIAL_LAYER_STATE: LayerState = {
  loading: { background: false, character: false, frame: false },
  errors: [],
};

export function CardForge() {
  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "The Knights Technarchy", rarity: "Punch Skater", style: "Street",
    vibe: "Grunge", district: "Nightshade", accentColor: "#00ff88", stamina: 5,
    gender: "Non-binary",
  });
  const [generated, setGenerated] = useState<CardPayload | null>(null);
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYER_STATE);
  const [characterBlend, setCharacterBlend] = useState(1);
  const [forging, setForging] = useState(false);
  const [viewing3D, setViewing3D] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Abort controller ref for cancelling in-flight image generation
  const abortRef = useRef<AbortController | null>(null);

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
      seed: string,
      signal: AbortSignal,
      postProcess?: (url: string) => Promise<string>,
    ) => {
      setLayers((s) => ({ ...s, loading: { ...s.loading, [layer]: true } }));
      try {
        // Check cache first
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

        // Generate via Fal.ai
        const result = await generateImage(prompt, seed);
        if (signal.aborted) return;

        let finalUrl = result.imageUrl;

        // Post-process (e.g., background removal for character layer)
        if (postProcess) {
          finalUrl = await postProcess(finalUrl);
          if (signal.aborted) return;
        }

        // Cache the result
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
    // Cancel any in-flight generation
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    // Generate card payload
    const card = generateCard(prompts);
    setGenerated(card);
    setForging(true);

    // Reset layer state
    setLayers(INITIAL_LAYER_STATE);

    if (!isImageGenConfigured) {
      setForging(false);
      return;
    }

    // Kick off all three layers in parallel
    const bgPrompt   = buildBackgroundPrompt(prompts.district);
    const charPrompt = buildCharacterPrompt(prompts);
    const framePrompt = buildFramePrompt(prompts.rarity);

    const bgKey    = `bg::${card.backgroundSeed}`;
    const charKey  = `char::${card.characterSeed}`;
    const frameKey = `frame::${card.frameSeed}`;

    const bgSeed    = card.backgroundSeed;
    const charSeed  = card.characterSeed;
    const frameSeed = card.frameSeed;

    // Background layer
    generateLayer("background", bgKey, bgPrompt, bgSeed, signal);

    // Character layer — post-process with background removal
    generateLayer("character", charKey, charPrompt, charSeed, signal, async (url) => {
      const result = await removeBackground(url);
      return result.imageUrl;
    });

    // Frame layer
    generateLayer("frame", frameKey, framePrompt, frameSeed, signal);

    setForging(false);
  }, [prompts, generateLayer]);

  // ── Derive UI state ──────────────────────────────────────────────────────
  const isAnyLayerLoading = layers.loading.background || layers.loading.character || layers.loading.frame;
  const hasAnyLayerUrl = !!(layers.backgroundUrl || layers.characterUrl || layers.frameUrl);

  return (
    <div className="page">
      <h1 className="page-title">CARD FORGE</h1>
      <p className="page-sub">Configure your courier and forge a unique card</p>

      <div className="forge-layout">
        {/* ── Left column: form controls ── */}
        <div className="forge-form">
          <div className="form-group">
            <label>Archetype</label>
            <div className="pill-group">
              {ARCHETYPES.map((opt) => (
                <button
                  key={opt}
                  className={`pill${prompts.archetype === opt ? " selected" : ""}`}
                  onClick={() => set("archetype", opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
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

          <button
            className="btn-primary btn-lg btn-forge"
            onClick={handleForge}
            disabled={forging || isAnyLayerLoading}
          >
            {isAnyLayerLoading ? "✨ Generating…" : "⚡ FORGE COURIER CARD"}
          </button>

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
              </div>
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
          characterImageUrl={layers.characterUrl}
          frameImageUrl={layers.frameUrl}
          characterBlend={characterBlend}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
}
