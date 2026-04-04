import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { CardPayload, Archetype, Rarity, Style, Vibe, District, CardPrompts } from "../lib/types";
import { generateCard, STORAGE_PACK_LABELS } from "../lib/generator";
import { buildImagePrompt } from "../lib/promptBuilder";
import { generateImage } from "../services/imageGen";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";
import { useTier } from "../context/TierContext";

const ARCHETYPES: Archetype[] = ["Ninja", "Punk Rocker", "Ex Military", "Hacker", "Chef"];
const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const STYLES: Style[] = ["Corporate", "Street", "Off-grid", "Military", "Union"];
const VIBES: Vibe[] = ["Grunge", "Neon", "Chrome", "Plastic"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville"];
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff00aa", "#ffaa00", "#8b5cf6", "#ff4444", "#44ffff"];

const DISTRICT_HINTS: Record<District, string> = {
  Airaway:      "☁️ Floating City in the Clouds",
  Nightshade:   "🌆 Cyberpunk Megalopolis",
  Batteryville: "🌵 Off-grid Solar/Wind Camp",
};

export function EditCard() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, updateCard } = useCollection();
  const { openUpgradeModal } = useTier();

  const original = cards.find((c) => c.id === cardId) ?? null;

  const [prompts, setPrompts] = useState<CardPrompts | null>(null);
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
        archetype: original.prompts.archetype as Archetype,
        rarity: original.prompts.rarity as Rarity,
        style: original.prompts.style as Style,
        vibe: original.prompts.vibe as Vibe,
        district: original.prompts.district as District,
        accentColor: original.prompts.accentColor,
        stamina: original.prompts.stamina,
      });
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
            <label>Archetype</label>
            <div className="pill-group">
              {ARCHETYPES.map((a) => (
                <button key={a} className={`pill ${prompts.archetype === a ? "selected" : ""}`} onClick={() => set("archetype", a)}>{a}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Rarity</label>
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
            <p className="form-hint">{DISTRICT_HINTS[prompts.district]}</p>
          </div>

          <div className="form-group">
            <label>Stamina — {prompts.stamina}</label>
            <input
              type="range" min={1} max={10} value={prompts.stamina}
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
