import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Archetype, CardPayload, Rarity, District, CardPrompts, Gender, AgeGroup, BodyType, HairLength, HairColor, SkinTone, FaceCharacter, ShoeStyle } from "../lib/types";
import { generateCard } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";
import { useTier } from "../context/TierContext";
import { FORGE_ARCHETYPE_OPTIONS } from "../lib/factionDiscovery";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import type { BoardConfig } from "../lib/boardBuilder";
import { calculateBoardStats, normalizeBoardConfig } from "../lib/boardBuilder";
import { resolveArchetypeStyle } from "../lib/styles";
import { sfxClick } from "../lib/sfx";

const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];
const AGE_GROUPS: AgeGroup[] = ["Young Adult", "Adult", "Middle-aged", "Senior"];
const BODY_TYPES: BodyType[] = ["Slim", "Athletic", "Average", "Stocky", "Heavy"];
const HAIR_LENGTHS: HairLength[] = ["Bald", "Short", "Medium", "Long"];
const HAIR_COLORS: HairColor[] = ["Black", "Brown", "Blonde", "Red", "Gray", "White", "Auburn", "Dyed Bright"];
const SKIN_TONES: SkinTone[] = ["Very Light", "Light", "Medium Light", "Medium", "Medium Dark", "Dark", "Very Dark"];
const FACE_CHARACTERS: FaceCharacter[] = ["Conventional", "Weathered", "Scarred", "Asymmetric", "Rugged", "Baby-faced", "Gaunt", "Round-faced"];
const SHOE_STYLES: ShoeStyle[] = ["Skate Shoes", "High Tops", "Chunky Sneakers", "Work Boots", "Trail Runners"];
const DEFAULT_AGE_GROUP: AgeGroup = "Adult";
const DEFAULT_BODY_TYPE: BodyType = "Athletic";
const DEFAULT_SHOE_STYLE: ShoeStyle = "Skate Shoes";
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];
const LEGACY_BODY_TYPE_MAP: Record<string, BodyType> = {
  Wiry: "Slim",
  "Pear-shaped": "Average",
  Lanky: "Slim",
  "Barrel-chested": "Stocky",
};
const LEGACY_HAIR_LENGTH_MAP: Record<string, HairLength> = {
  Buzzcut: "Short",
  "Very Long": "Long",
};

function normalizeBodyType(bodyType?: string): BodyType {
  if (bodyType && BODY_TYPES.includes(bodyType as BodyType)) return bodyType as BodyType;
  return LEGACY_BODY_TYPE_MAP[bodyType ?? ""] ?? DEFAULT_BODY_TYPE;
}

function normalizeHairLength(hairLength?: string): HairLength {
  if (hairLength && HAIR_LENGTHS.includes(hairLength as HairLength)) return hairLength as HairLength;
  return LEGACY_HAIR_LENGTH_MAP[hairLength ?? ""] ?? "Short";
}

export function EditCard() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, updateCard } = useCollection();
  const { openUpgradeModal } = useTier();

  const original = cards.find((c) => c.id === cardId) ?? null;

  const [prompts, setPrompts] = useState<CardPrompts | null>(null);
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [preview, setPreview] = useState<CardPayload | null>(null);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise prompts from the original card once loaded
  useEffect(() => {
    if (original && !prompts) {
      setPrompts({
        archetype: original.prompts.archetype,
        rarity: original.prompts.rarity as Rarity,
        style: resolveArchetypeStyle(original.prompts.archetype, original.prompts.style),
        district: original.prompts.district as District,
        accentColor: original.prompts.accentColor,
        gender: (original.prompts.gender as Gender) ?? "Non-binary",
        ageGroup: (original.prompts.ageGroup as AgeGroup) ?? DEFAULT_AGE_GROUP,
        bodyType: normalizeBodyType(original.prompts.bodyType),
        hairLength: normalizeHairLength(original.prompts.hairLength),
        hairColor: (original.prompts.hairColor as HairColor) ?? "Black",
        skinTone: (original.prompts.skinTone as SkinTone) ?? "Medium",
        faceCharacter: (original.prompts.faceCharacter as FaceCharacter) ?? "Conventional",
        shoeStyle: (original.prompts.shoeStyle as ShoeStyle) ?? DEFAULT_SHOE_STYLE,
      });
      if (original.board) setBoardConfig(normalizeBoardConfig({ ...DEFAULT_BOARD_CONFIG, ...original.board }));
      // Show the original card as starting preview
      setPreview(original);
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
  const setArchetype = (archetype: Archetype) => {
    setPrompts((current) => current ? {
      ...current,
      archetype,
      style: resolveArchetypeStyle(archetype, current.style),
    } : current);
    setSaved(false);
  };

  const handlePreview = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const previewPrompts = { ...prompts, style: resolveArchetypeStyle(prompts.archetype, prompts.style) };
    const newCard = generateCard(previewPrompts);
    const merged: CardPayload = {
      ...newCard,
      id: original.id,
      createdAt: original.createdAt,
      backgroundImageUrl: original.backgroundImageUrl,
      characterImageUrl: original.characterImageUrl,
      frameImageUrl: original.frameImageUrl,
      imageUrl: original.imageUrl,
      discovery: original.discovery,
      board: boardConfig,
      boardLoadout: calculateBoardStats(boardConfig),
    };
    setPreview(merged);
    setSaved(false);
  };

  const handleSaveEdit = () => {
    if (!preview) return;
    updateCard(preview);
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
        <button className="btn-outline" onClick={() => { sfxClick(); navigate("/collection"); }}>← Back</button>
      </div>

      <div className="forge-layout">
        <div className="forge-form">
          <div className="form-group">
            <label>Cover Identity</label>
            <div className="pill-group">
              {FORGE_ARCHETYPE_OPTIONS.map((opt) => (
                <button key={opt.value} className={`pill ${prompts.archetype === opt.value ? "selected" : ""}`} onClick={() => { sfxClick(); setArchetype(opt.value); }}>{opt.label}</button>
              ))}
            </div>
            <p className="form-hint">Pick the public-facing role your courier presents to the city.</p>
          </div>

          <div className="form-group">
            <label>Class</label>
            <div className="pill-group">
              {RARITIES.map((r) => (
                <button key={r} className={`pill ${prompts.rarity === r ? "selected" : ""}`} onClick={() => { sfxClick(); set("rarity", r); }}>{r}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>District</label>
            <div className="pill-group">
              {DISTRICTS.map((d) => (
                <button key={d} className={`pill ${prompts.district === d ? "selected" : ""}`} onClick={() => { sfxClick(); set("district", d); }}>{d}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Gender</label>
            <div className="pill-group">
              {GENDERS.map((g) => (
                <button key={g} className={`pill${prompts.gender === g ? " selected" : ""}`} onClick={() => { sfxClick(); set("gender", g); }}>{g}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Age Group</label>
            <div className="pill-group">
              {AGE_GROUPS.map((ageGroup) => (
                <button key={ageGroup} className={`pill${prompts.ageGroup === ageGroup ? " selected" : ""}`} onClick={() => { sfxClick(); set("ageGroup", ageGroup); }}>{ageGroup}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Body Type</label>
            <div className="pill-group">
              {BODY_TYPES.map((bodyType) => (
                <button key={bodyType} className={`pill${prompts.bodyType === bodyType ? " selected" : ""}`} onClick={() => { sfxClick(); set("bodyType", bodyType); }}>{bodyType}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Hair Length</label>
            <div className="pill-group">
              {HAIR_LENGTHS.map((opt) => (
                <button key={opt} className={`pill${prompts.hairLength === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("hairLength", opt); }}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Hair Color</label>
            <div className="pill-group">
              {HAIR_COLORS.map((opt) => (
                <button key={opt} className={`pill${prompts.hairColor === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("hairColor", opt); }}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Skin Tone</label>
            <div className="pill-group">
              {SKIN_TONES.map((opt) => (
                <button key={opt} className={`pill${prompts.skinTone === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("skinTone", opt); }}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Face Character</label>
            <div className="pill-group">
              {FACE_CHARACTERS.map((opt) => (
                <button key={opt} className={`pill${prompts.faceCharacter === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("faceCharacter", opt); }}>{opt}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Shoes</label>
            <div className="pill-group">
              {SHOE_STYLES.map((opt) => (
                <button key={opt} className={`pill${prompts.shoeStyle === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("shoeStyle", opt); }}>{opt}</button>
              ))}
            </div>
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
                  onClick={() => { sfxClick(); set("accentColor", c); }}
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

          <button className="btn-primary btn-lg" onClick={() => { sfxClick(); handlePreview(); }}>
            ⚡ Preview Changes
          </button>

          {preview && (
            <button
              className="btn-primary btn-lg"
              style={{ marginTop: "8px", borderColor: "var(--accent2)", color: "var(--accent2)" }}
              onClick={() => { sfxClick(); handleSaveEdit(); }}
              disabled={saved}
            >
              {saved ? "✓ Saved!" : "💾 Save Edit"}
            </button>
          )}
          <button className="btn-outline" style={{ width: "100%", marginTop: "8px" }} onClick={() => { sfxClick(); openUpgradeModal(); }}>
            Manage Tier
          </button>
        </div>

        <div className="forge-preview">
          {preview ? (
            <>
              <CardDisplay
                card={preview}
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
