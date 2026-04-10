import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { CardPayload, Rarity, Style, Vibe, District, CardPrompts, Gender } from "../lib/types";
import { generateCard } from "../lib/generator";
import { buildImagePrompt } from "../lib/promptBuilder";
import { generateImage, isImageGenConfigured } from "../services/imageGen";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";
import { useTier } from "../context/TierContext";
import { FORGE_ARCHETYPE_OPTIONS } from "../lib/factionDiscovery";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import type { BoardConfig } from "../lib/boardBuilder";
import { ACTIVE_STYLES } from "../lib/styles";

const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const STYLES: Style[] = ACTIVE_STYLES;
const VIBES: Vibe[] = ["Grunge", "Neon", "Chrome", "Plastic", "Recycled"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];

export function EditCard() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, updateCard } = useCollection();
  const { openUpgradeModal } = useTier();

  const original = cards.find((c) => c.id === cardId) ?? null;

  const [prompts, setPrompts] = useState<CardPrompts | null>(null);
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [preview, setPreview] = useState<CardPayload | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise prompts from the original card once loaded
  useEffect(() => {
    if (original && !prompts) {
      setPrompts({
        archetype: original.prompts.archetype,
        rarity: original.prompts.rarity as Rarity,
        style: original.prompts.style as Style,
        vibe: original.prompts.vibe as Vibe,
        district: original.prompts.district as District,
        accentColor: original.prompts.accentColor,
        stamina: original.prompts.stamina,
        gender: (original.prompts.gender as Gender) ?? "Non-binary",
      });
      if (original.board) setBoardConfig(original.board);
      // Show the original card as starting preview
      setPreview(original);
      setImageUrl(original.imageUrl ?? null);
    }
  }, [original, prompts]);

  if (!original || !prompts) {
    return (
      <div className="page">
        <p style={{ color: "var(--text-dim)" }}>
          {cards.length === 0 ? "⏳ Loading collection…" : "Card not found."}
        </p>
      </div>
    );
  }

  const set = <K extends keyof CardPrompts>(key: K, val: CardPrompts[K]) => {
    setPrompts((p) => p ? { ...p, [key]: val } : p);
    setSaved(false);
  };

  const fetchImage = async (card: CardPayload, latestPrompts: CardPrompts) => {
    if (!isImageGenConfigured) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const prompt = buildImagePrompt(latestPrompts);
      const result = await generateImage(prompt, card.seed);
      setImageUrl(result.imageUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setImageLoading(false);
    }
  };

  const handlePreview = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const newCard = generateCard(prompts);
    // Preserve original identity
    const merged: CardPayload = {
      ...newCard,
      id: original.id,
      createdAt: original.createdAt,
      board: boardConfig,
      boardLoadout: original.boardLoadout,
    };
    setPreview(merged);
    setImageUrl(null);
    setSaved(false);
    fetchImage(merged, prompts);
  };

  const handleSaveEdit = () => {
    if (!preview) return;
    const toSave: CardPayload = imageUrl ? { ...preview, imageUrl } : preview;
    updateCard(toSave);
    setSaved(true);
    setTimeout(() => navigate("/collection"), 800);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Card</h1>
          <p className="page-sub">Tweak your card's attributes and re-forge it.</p>
        </div>
        <button className="btn-outline" onClick={() => navigate("/collection")}>← Back</button>
      </div>

      <div className="forge-layout">
        <div className="forge-form">
          <div className="form-group">
            <label>Cover Identity</label>
            <div className="pill-group">
              {FORGE_ARCHETYPE_OPTIONS.map((opt) => (
                <button key={opt.value} className={`pill ${prompts.archetype === opt.value ? "selected" : ""}`} onClick={() => set("archetype", opt.value)}>{opt.label}</button>
              ))}
            </div>
            <p className="form-hint">Pick the public-facing role your courier presents to the city.</p>
          </div>

          <div className="form-group">
            <label>Class</label>
            <div className="pill-group">
              {RARITIES.map((r) => (
                <button key={r} className={`pill ${prompts.rarity === r ? "selected" : ""}`} onClick={() => set("rarity", r)}>{r}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Style</label>
            <div className="pill-group">
              {STYLES.map((s) => (
                <button key={s} className={`pill ${prompts.style === s ? "selected" : ""}`} onClick={() => set("style", s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Vibe</label>
            <div className="pill-group">
              {VIBES.map((v) => (
                <button key={v} className={`pill ${prompts.vibe === v ? "selected" : ""}`} onClick={() => set("vibe", v)}>{v}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>District</label>
            <div className="pill-group">
              {DISTRICTS.map((d) => (
                <button key={d} className={`pill ${prompts.district === d ? "selected" : ""}`} onClick={() => set("district", d)}>{d}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Gender</label>
            <div className="pill-group">
              {GENDERS.map((g) => (
                <button key={g} className={`pill${prompts.gender === g ? " selected" : ""}`} onClick={() => set("gender", g)}>{g}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Stamina — {prompts.stamina}/10</label>
            <input
              type="range" min={1} max={10} step={1} value={prompts.stamina}
              onChange={(e) => set("stamina", Number(e.target.value))}
              className="stamina-slider"
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
                type="color" value={prompts.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="color-picker" title="Custom color"
              />
            </div>
          </div>

          <button className="btn-primary btn-lg" onClick={handlePreview}>
            ⚡ Preview Changes
          </button>

          {preview && (
            <button
              className="btn-primary btn-lg"
              style={{ marginTop: "8px", borderColor: "var(--accent2)", color: "var(--accent2)" }}
              onClick={handleSaveEdit}
              disabled={saved}
            >
              {saved ? "✓ Saved!" : "💾 Save Edit"}
            </button>
          )}
          <button className="btn-outline" style={{ width: "100%", marginTop: "8px" }} onClick={openUpgradeModal}>
            Manage Tier
          </button>
        </div>

        <div className="forge-preview">
          {!isImageGenConfigured && (
            <p className="forge-image-notice">
              ℹ️ AI image generation is not configured — cards display SVG art.
              Set <code>VITE_IMAGE_API_URL</code> in your <code>.env</code> to enable it.
            </p>
          )}
          {preview ? (
            <>
              {imageError && <p className="forge-image-error">⚠️ {imageError}</p>}
              <CardDisplay
                card={preview}
                imageUrl={imageUrl ?? undefined}
                imageLoading={imageLoading}
                showShare={false}
              />
            </>
          ) : (
            <div className="empty-preview">
              <span className="empty-icon">✎</span>
              <p>Change options and hit Preview Changes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
