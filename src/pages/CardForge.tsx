import { useState } from "react";
import type { CardPayload, Archetype, Rarity, StyleVibe, District, CardPrompts } from "../lib/types";
import { generateCard } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";

const ARCHETYPES: Archetype[] = ["Runner", "Ghost", "Bruiser", "Tech", "Medic"];
const RARITIES: Rarity[] = ["Common", "Uncommon", "Rare", "Legendary"];
const STYLE_VIBES: StyleVibe[] = ["Street", "Corporate", "Underground", "Neon", "Chrome"];
const DISTRICTS: District[] = ["Neon District", "The Sprawl", "Chrome Heights", "Undercity", "Corporate Core"];
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff00aa", "#ffaa00", "#8b5cf6", "#ff4444", "#44ffff"];

export function CardForge() {
  const { addCard, hasCard } = useCollection();

  const [prompts, setPrompts] = useState<CardPrompts>({
    archetype: "Runner",
    rarity: "Common",
    styleVibe: "Street",
    district: "Neon District",
    accentColor: "#00ff88",
  });

  const [generated, setGenerated] = useState<CardPayload | null>(null);

  const set = <K extends keyof CardPrompts>(key: K, val: CardPrompts[K]) =>
    setPrompts((p) => ({ ...p, [key]: val }));

  const handleGenerate = () => {
    setGenerated(generateCard(prompts));
  };

  const handleSave = () => {
    if (generated) addCard(generated);
  };

  return (
    <div className="page">
      <h1 className="page-title">Card Forge</h1>
      <p className="page-sub">Configure your courier and forge a unique card.</p>

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
            <label>Style Vibe</label>
            <div className="pill-group">
              {STYLE_VIBES.map((s) => (
                <button
                  key={s}
                  className={`pill ${prompts.styleVibe === s ? "selected" : ""}`}
                  onClick={() => set("styleVibe", s)}
                >
                  {s}
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
              isSaved={hasCard(generated.id)}
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
