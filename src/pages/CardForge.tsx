import { useState, useEffect, useRef } from "react";
import type { CardPayload, Archetype, Rarity, Style, Vibe, District, CardPrompts } from "../lib/types";
import { generateCard, buildSeed, STORAGE_PACK_LABELS } from "../lib/generator";
import { buildBackgroundPrompt, buildCharacterPrompt, buildFramePrompt } from "../lib/promptBuilder";
import { generateImage, isImageGenConfigured } from "../services/imageGen";
import { getCachedImage, setCachedImage } from "../services/imageCache";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";

const ARCHETYPES: Archetype[] = ["Ninja", "Punk Rocker", "Ex Military", "Hacker", "Chef", "Olympic", "Fash"];
const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const STYLES: Style[] = ["Corporate", "Street", "Off-grid", "Military", "Union"];
const VIBES: Vibe[] = ["Grunge", "Neon", "Chrome", "Plastic", "Recycled"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "Glass City"];
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff00aa", "#ffaa00", "#8b5cf6", "#ff4444", "#44ffff"];

const DISTRICT_HINTS: Record<District, string> = {
  Airaway:      "☁️ Floating sky-city above the clouds — levitating platforms & glass sky-bridges",
  Nightshade:   "🌑 Underground subway labyrinth (aka The Murk) — neon skateboards, blacklight murals & subterranean communes",
  Batteryville: "🌵 Off-grid desert compound — solar arrays, wind turbines & salvaged-tech markets",
  "The Grid":   "⚙️ Diesel-punk industrial wasteland — defunct refineries & oil derricks controlled by rival Marxist factions",
  "Glass City": "🏙️ Cyberpunk neon megalopolis — glass skyscrapers & decayed roads where only electric skateboarders rule",
};

const ARCHETYPE_HINTS: Record<Archetype, string> = {
  "Ninja":       "⚔️ Swift stealth courier — high Speed & Stealth. Silent, shadow-walking, disappears in the dark.",
  "Punk Rocker": "🎸 Rebel street performer — high Grit & Rep. Loud, defiant, and impossible to ignore.",
  "Ex Military": "🪖 Tactical veteran — high Grit with balanced stats. Disciplined, armoured, mission-focused.",
  "Hacker":      "💻 Tech specialist — high Tech & Rep. Cracks any system, reads every sensor, owns the grid.",
  "Chef":        "👨‍🍳 Underground food courier — apron, chef hat, pot or pan. Balanced stats with a Speed bonus.",
  "Olympic":     "🏅 High-performance athlete — high Rep & Speed. Coordinated team apparel, premium fabrics, clean professional look.",
  "Fash":        "🎩 Sharp-dressed enforcer — very high Rep. Necktie, jacket, lapels, coat-of-arms insignia. Upper-class prep-school energy.",
};

const RARITY_HINTS: Record<Rarity, string> = {
  "Punch Skater": "🛹 Common — gritty, low-budget courier just starting out",
  "Apprentice":   "⚡ Uncommon — energetic and hopeful, learning the ropes",
  "Master":       "🌟 Skilled — confident and polished, respected on every route",
  "Rare":         "💎 Rare — dynamic and striking, a legend in the making",
  "Legendary":    "🔱 Legendary — epic, otherworldly, the stuff of courier myth",
};

const STYLE_HINTS: Record<Style, string> = {
  Corporate:  "👔 Sleek suit & high-tech earpiece — fits right into Corporate zones",
  Street:     "🧢 Hoodie & cargo pants with graffiti patches — versatile urban style",
  "Off-grid": "🪓 Survivalist gear & utility belts — built for the wilderness",
  Military:   "🪖 Tactical fatigues & body armour — combat-ready at all times",
  Union:      "🔧 Worker overalls covered in solidarity badge patches",
};

const VIBE_HINTS: Record<Vibe, string> = {
  Grunge:   "🔩 Worn & weathered — battle-scarred board with duct-tape repairs",
  Neon:     "💡 Glowing neon — lights up the dark, visible from a mile away",
  Chrome:   "✨ Sleek chrome finish — mirror-polished, blinding reflections",
  Plastic:  "🎨 Bright colourful plastic — loud, playful, and hard to miss",
  Recycled: "♻️ Tattered DIY junk build — repurposed scrap and leftover materials, very punk",
};

// ── Layer state helpers ────────────────────────────────────────────────────────

interface LayerUrls {
  background: string | null;
  character:  string | null;
  frame:      string | null;
}

interface LayerLoading {
  background: boolean;
  character:  boolean;
  frame:      boolean;
}

interface LayerSeeds {
  background: string | null;
  character:  string | null;
  frame:      string | null;
}

export function CardForge() {
  const { addCard, hasCard, cards } = useCollection();
  const { tier, openUpgradeModal } = useTier();
  const tierData = TIERS[tier];

  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "Ninja",
    rarity: "Punch Skater",
    style: "Street",
    vibe: "Grunge",
    district: "Nightshade",
    accentColor: "#00ff88",
    stamina: 5,
  });

  const [generated, setGenerated] = useState<CardPayload | null>(null);

  // ── Per-layer URL and loading state ─────────────────────────────────────────
  const [layerUrls, setLayerUrls] = useState<LayerUrls>({
    background: null,
    character:  null,
    frame:      null,
  });
  const [layerLoading, setLayerLoading] = useState<LayerLoading>({
    background: false,
    character:  false,
    frame:      false,
  });
  const [layerErrors, setLayerErrors] = useState<Partial<Record<keyof LayerUrls, string>>>({});

  // 0–1 opacity applied to the character layer (1 = fully opaque / solid portrait).
  const [characterBlend, setCharacterBlend] = useState(1);

  // Track the seed used to generate each layer so we can skip unchanged layers.
  const lastSeedsRef = useRef<LayerSeeds>({
    background: null,
    character:  null,
    frame:      null,
  });

  // Tracks whether the user has clicked "Forge Card" at least once.
  const hasGeneratedRef = useRef(false);
  // Holds the pending debounce timer.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Layer generation helper ──────────────────────────────────────────────────
  /**
   * Generates only the layers whose underlying seed has changed since the last
   * generation, running dirty layers in parallel to minimise wait time.
   *
   * Layer → seed mapping:
   *   background  = backgroundSeed (district)
   *   character   = characterSeed  (archetype | style | vibe | stamina | district bag)
   *   frame       = frameSeed      (rarity)
   */
  const fetchLayers = async (card: CardPayload, latestPrompts: CardPrompts) => {
    if (!isImageGenConfigured) return;

    const { frameSeed, backgroundSeed, characterSeed } = card;

    // Character layer cache key is based on characterSeed alone (no district)
    // so the character image stays untouched when only the district changes.
    // The "v2" prefix busts any previously cached white-background images so that
    // only black-background images (compatible with mix-blend-mode: screen) are used.
    const charCacheKey = characterSeed;

    // Determine which layers are stale
    const needsBackground = backgroundSeed !== lastSeedsRef.current.background;
    const needsCharacter  = charCacheKey   !== lastSeedsRef.current.character;
    const needsFrame      = frameSeed      !== lastSeedsRef.current.frame;

    if (!needsBackground && !needsCharacter && !needsFrame) return;

    // Mark stale layers as loading and clear old errors
    setLayerLoading({
      background: needsBackground,
      character:  needsCharacter,
      frame:      needsFrame,
    });
    setLayerErrors({});

    const promises: Promise<void>[] = [];

    /**
     * Resolve an image URL for a layer:
     * 1. Check the Firestore image cache (free — no fal.ai credits used).
     * 2. On a miss, call fal.ai and write the result back to the cache.
     */
    const resolveLayer = async (
      storeCacheKey: string,
      prompt: string,
      seed: string,
    ): Promise<string> => {
      const cached = await getCachedImage(storeCacheKey);
      if (cached) return cached;

      const result = await generateImage(prompt, seed);
      // Fire-and-forget the cache write; errors are already swallowed inside.
      void setCachedImage(storeCacheKey, result.imageUrl);
      return result.imageUrl;
    };

    if (needsBackground) {
      promises.push(
        resolveLayer(`bg::${backgroundSeed}`, buildBackgroundPrompt(latestPrompts.district), backgroundSeed)
          .then((imageUrl) => {
            setLayerUrls((prev) => ({ ...prev, background: imageUrl }));
            lastSeedsRef.current.background = backgroundSeed;
          })
          .catch((err: unknown) => {
            setLayerErrors((prev) => ({
              ...prev,
              background: err instanceof Error ? err.message : "Background generation failed.",
            }));
          })
          .finally(() => setLayerLoading((prev) => ({ ...prev, background: false }))),
      );
    }

    if (needsCharacter) {
      promises.push(
        resolveLayer(`char::v2::${charCacheKey}`, buildCharacterPrompt(latestPrompts), charCacheKey)
          .then((imageUrl) => {
            setLayerUrls((prev) => ({ ...prev, character: imageUrl }));
            lastSeedsRef.current.character = charCacheKey;
          })
          .catch((err: unknown) => {
            setLayerErrors((prev) => ({
              ...prev,
              character: err instanceof Error ? err.message : "Character generation failed.",
            }));
          })
          .finally(() => setLayerLoading((prev) => ({ ...prev, character: false }))),
      );
    }

    if (needsFrame) {
      promises.push(
        resolveLayer(`frame::${frameSeed}`, buildFramePrompt(latestPrompts.rarity), frameSeed)
          .then((imageUrl) => {
            setLayerUrls((prev) => ({ ...prev, frame: imageUrl }));
            lastSeedsRef.current.frame = frameSeed;
          })
          .catch((err: unknown) => {
            setLayerErrors((prev) => ({
              ...prev,
              frame: err instanceof Error ? err.message : "Frame generation failed.",
            }));
          })
          .finally(() => setLayerLoading((prev) => ({ ...prev, frame: false }))),
      );
    }

    await Promise.all(promises);
  };

  // ── Auto-refresh layers when prompts change (after first forge) ──────────────
  useEffect(() => {
    if (!hasGeneratedRef.current) return;

    const newCard = generateCard(prompts);
    setGenerated(newCard);

    // Reset only the URLs for stale layers so the UI shows loading skeletons
    // for the changing layers while keeping the others intact.
    const { frameSeed, backgroundSeed, characterSeed } = buildSeed(prompts);
    const charCacheKey = characterSeed;
    if (backgroundSeed !== lastSeedsRef.current.background) {
      setLayerUrls((prev) => ({ ...prev, background: null }));
    }
    if (charCacheKey !== lastSeedsRef.current.character) {
      setLayerUrls((prev) => ({ ...prev, character: null }));
    }
    if (frameSeed !== lastSeedsRef.current.frame) {
      setLayerUrls((prev) => ({ ...prev, frame: null }));
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLayers(newCard, prompts);
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prompts]);

  const set = <K extends keyof CardPrompts>(key: K, val: CardPrompts[K]) =>
    setPrompts((p) => ({ ...p, [key]: val }));

  const handleGenerate = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const card = generateCard(prompts);
    setGenerated(card);
    hasGeneratedRef.current = true;

    // Only reset the URL for each layer whose underlying seed has changed
    // (or hasn't been generated yet).  Unchanged layers keep their current
    // image so the user sees a smooth, targeted update rather than a full
    // refresh of everything.
    const { frameSeed, backgroundSeed, characterSeed } = card;
    if (backgroundSeed !== lastSeedsRef.current.background) {
      setLayerUrls((prev) => ({ ...prev, background: null }));
    }
    if (characterSeed !== lastSeedsRef.current.character) {
      setLayerUrls((prev) => ({ ...prev, character: null }));
    }
    if (frameSeed !== lastSeedsRef.current.frame) {
      setLayerUrls((prev) => ({ ...prev, frame: null }));
    }

    fetchLayers(card, prompts);
  };

  const canSave = tierData.canSave;
  const cardLimit = tierData.cardLimit;
  const atLimit = canSave && cardLimit !== null && cards.length >= cardLimit;

  const handleSave = () => {
    if (!canSave) { openUpgradeModal(); return; }
    if (atLimit)  { openUpgradeModal(); return; }
    if (generated) {
      addCard({
        ...generated,
        backgroundImageUrl: layerUrls.background ?? undefined,
        characterImageUrl:  layerUrls.character  ?? undefined,
        frameImageUrl:      layerUrls.frame      ?? undefined,
      });
    }
  };

  const saveLabel = () => {
    if (!canSave) return "🔒 Upgrade to Save";
    if (atLimit) return `🔒 Limit Reached (${cardLimit} cards)`;
    if (generated && hasCard(generated.id)) return "✓ Saved";
    return "Save to Collection";
  };

  const saveBtnDisabled = !!(generated && hasCard(generated.id));

  // Determine overall loading / error state for the preview area
  const anyLayerLoading = layerLoading.background || layerLoading.character || layerLoading.frame;
  const layerErrorMessages = Object.values(layerErrors).filter(Boolean);

  return (
    <div className="page">
      <h1 className="page-title">Card Forge</h1>
      <p className="page-sub">Configure your courier and forge a unique card.</p>

      {tier === "free" && (
        <div className="tier-banner">
          <span>
            🛹 <strong>Free Tier</strong> — Generate cards and share them. Upgrade to save your collection.
          </span>
          <button className="btn-primary btn-sm" onClick={openUpgradeModal}>Upgrade</button>
        </div>
      )}
      {tier === "tier2" && cardLimit !== null && (
        <div className="tier-banner tier-banner--info">
          <span>
            ⚡ <strong>Street Creator</strong> — {cards.length}/{cardLimit} cards saved.
            {atLimit && " Upgrade for unlimited cards."}
          </span>
          {atLimit && <button className="btn-primary btn-sm" onClick={openUpgradeModal}>Upgrade</button>}
        </div>
      )}

      <div className="forge-layout">
        <div className="forge-form">
          <div className="form-group">
            <label>Archetype</label>
            <div className="pill-group">
              {ARCHETYPES.map((a) => (
                <button
                  key={a}
                  className={`pill ${prompts.archetype === a ? "selected" : ""}`}
                  onClick={() => set("archetype", a)}
                  title={ARCHETYPE_HINTS[a]}
                >
                  {a}
                </button>
              ))}
            </div>
            <p className="form-hint">{ARCHETYPE_HINTS[prompts.archetype]}</p>
          </div>

          <div className="form-group">
            <label>Rarity</label>
            <div className="pill-group">
              {RARITIES.map((r) => (
                <button
                  key={r}
                  className={`pill ${prompts.rarity === r ? "selected" : ""}`}
                  onClick={() => set("rarity", r)}
                  title={RARITY_HINTS[r]}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="form-hint">{RARITY_HINTS[prompts.rarity]}</p>
          </div>

          <div className="form-group">
            <label>Style</label>
            <div className="pill-group">
              {STYLES.map((s) => (
                <button
                  key={s}
                  className={`pill ${prompts.style === s ? "selected" : ""}`}
                  onClick={() => set("style", s)}
                  title={STYLE_HINTS[s]}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="form-hint">{STYLE_HINTS[prompts.style]}</p>
          </div>

          <div className="form-group">
            <label>Vibe</label>
            <div className="pill-group">
              {VIBES.map((v) => (
                <button
                  key={v}
                  className={`pill ${prompts.vibe === v ? "selected" : ""}`}
                  onClick={() => set("vibe", v)}
                  title={VIBE_HINTS[v]}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="form-hint">{VIBE_HINTS[prompts.vibe]}</p>
            <p className="form-hint form-hint--secondary">Vibe sets the look and finish of your electric skateboard.</p>
          </div>

          <div className="form-group">
            <label>District</label>
            <div className="pill-group">
              {DISTRICTS.map((d) => (
                <button
                  key={d}
                  className={`pill ${prompts.district === d ? "selected" : ""}`}
                  onClick={() => set("district", d)}
                  title={DISTRICT_HINTS[d]}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="form-hint">{DISTRICT_HINTS[prompts.district]}</p>
            <p className="form-hint form-hint--secondary">
              District sets the background scene and the style of your courier bag.
            </p>
          </div>

          <div className="form-group">
            <label>Stamina — {prompts.stamina}</label>
            <input
              type="range"
              min={1}
              max={10}
              value={prompts.stamina}
              onChange={(e) => set("stamina", Number(e.target.value))}
              className="stamina-slider"
            />
            <p className="form-hint">
              {STORAGE_PACK_LABELS[
                prompts.stamina <= 2 ? "shopping-bag" :
                prompts.stamina <= 5 ? "backpack" :
                prompts.stamina <= 8 ? "cardboard-box" : "duffel-bag"
              ]}
            </p>
            <p className="form-hint form-hint--secondary">
              Stamina controls how much cargo your courier carries and affects all base stats.
            </p>
          </div>

          <div className="form-group">
            <label>Accent Color</label>
            <div className="color-group">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`color-swatch ${prompts.accentColor === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => set("accentColor", c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={prompts.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="color-picker"
                title="Custom color"
              />
            </div>
            <p className="form-hint form-hint--secondary">
              Accent color tints the SVG card frame and highlight details.
            </p>
          </div>

          <button className="btn-primary btn-lg" onClick={handleGenerate}>
            ⚡ Forge Card
          </button>

          {isImageGenConfigured && (
            <p className="form-hint form-hint--secondary" style={{ marginTop: "0.5rem" }}>
              🎨 Layered generation: background, character and frame are generated separately —
              only the layers affected by your changes will be regenerated.
            </p>
          )}
        </div>

        <div className="forge-preview">
          {!isImageGenConfigured && (
            <p className="forge-image-notice">
              ℹ️ AI image generation is not configured — cards display SVG art.
              Set <code>VITE_IMAGE_API_URL</code> in your <code>.env</code> to enable it.
            </p>
          )}
          {layerErrorMessages.length > 0 && (
            <div className="forge-image-errors">
              {layerErrorMessages.map((msg, i) => (
                <p key={i} className="forge-image-error">⚠️ {msg}</p>
              ))}
            </div>
          )}
          {generated ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", width: "100%" }}>
              <CardDisplay
                card={generated}
                onSave={handleSave}
                isSaved={saveBtnDisabled || (!canSave) || atLimit}
                saveLabel={saveLabel()}
                showShare={true}
                backgroundImageUrl={layerUrls.background ?? undefined}
                characterImageUrl={layerUrls.character  ?? undefined}
                frameImageUrl={layerUrls.frame          ?? undefined}
                layerLoading={layerLoading}
                imageLoading={anyLayerLoading}
                characterBlend={characterBlend}
              />
              {isImageGenConfigured && layerUrls.character && (
                <div className="blend-control">
                  <span className="blend-control__label">
                    <span>Character Blend</span>
                    <span>{Math.round(characterBlend * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(characterBlend * 100)}
                    onChange={(e) => setCharacterBlend(Number(e.target.value) / 100)}
                    className="stamina-slider"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="empty-preview">
              <span className="empty-icon">🛹</span>
              <p>Select options and hit Forge Card to generate your courier.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
