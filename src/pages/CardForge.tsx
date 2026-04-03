import { useState } from "react";
import type { CardPayload, Archetype, Rarity, Style, Vibe, District, CardPrompts } from "../lib/types";
import { generateCard, STORAGE_PACK_LABELS } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";

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

  const set = <K extends keyof CardPrompts>(key: K, val: CardPrompts[K]) =>
    setPrompts((p) => ({ ...p, [key]: val }));

  const handleGenerate = () => {
    setGenerated(generateCard(prompts));
  };

  const canSave = tierData.canSave;
  const cardLimit = tierData.cardLimit;
  const atLimit = canSave && cardLimit !== null && cards.length >= cardLimit;

  const handleSave = () => {
    if (!canSave) {
      openUpgradeModal();
      return;
    }
    if (atLimit) {
      openUpgradeModal();
      return;
    }
    if (generated) addCard(generated);
  };

  const saveLabel = () => {
    if (!canSave) return "🔒 Upgrade to Save";
    if (atLimit) return `🔒 Limit Reached (${cardLimit} cards)`;
    if (generated && hasCard(generated.id)) return "✓ Saved";
    return "Save to Collection";
  };

  const saveBtnDisabled = !!(generated && hasCard(generated.id));

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
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Rarity</label>
            <div className="pill-group">
              {RARITIES.map((r) => (
                <button
                  key={r}
                  className={`pill ${prompts.rarity === r ? "selected" : ""}`}
                  onClick={() => set("rarity", r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Style</label>
            <div className="pill-group">
              {STYLES.map((s) => (
                <button
                  key={s}
                  className={`pill ${prompts.style === s ? "selected" : ""}`}
                  onClick={() => set("style", s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Vibe</label>
            <div className="pill-group">
              {VIBES.map((v) => (
                <button
                  key={v}
                  className={`pill ${prompts.vibe === v ? "selected" : ""}`}
                  onClick={() => set("vibe", v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>District</label>
            <div className="pill-group">
              {DISTRICTS.map((d) => (
                <button
                  key={d}
                  className={`pill ${prompts.district === d ? "selected" : ""}`}
                  onClick={() => set("district", d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="form-hint">{DISTRICT_HINTS[prompts.district]}</p>
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
          </div>

          <button className="btn-primary btn-lg" onClick={handleGenerate}>
            ⚡ Forge Card
          </button>
        </div>

        <div className="forge-preview">
          {generated ? (
            <CardDisplay
              card={generated}
              onSave={handleSave}
              isSaved={saveBtnDisabled || (!canSave) || atLimit}
              saveLabel={saveLabel()}
              showShare={true}
            />
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
