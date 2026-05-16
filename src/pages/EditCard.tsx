import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { Archetype, CardPayload, Rarity, District, CardPrompts, Gender, AgeGroup, BodyType, HairLength, SkinTone, FaceCharacter } from "../lib/types";
import { generateCard } from "../lib/generator";
import { CardDisplay } from "../components/CardDisplay";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { useTier } from "../context/TierContext";
import { FORGE_ARCHETYPE_OPTIONS } from "../lib/factionDiscovery";
import { BoardBuilder, DEFAULT_BOARD_CONFIG } from "../components/BoardBuilder";
import type { BoardConfig } from "../lib/boardBuilder";
import { calculateBoardStats, normalizeBoardConfig } from "../lib/boardBuilder";
import { resolveArchetypeStyle } from "../lib/styles";
import { sfxClick } from "../lib/sfx";
import { useLanguage } from "../context/LanguageContext";
import { buildCraftlinguaFlavorFields } from "../services/craftlingua";

const AUTO_PREVIEW_DELAY_MS = 350;

const RARITIES: Rarity[] = ["Punch Skater", "Apprentice", "Master", "Rare", "Legendary"];
const DISTRICTS: District[] = ["Airaway", "Nightshade", "Batteryville", "The Grid", "The Forest", "Glass City"];
const GENDERS: Gender[] = ["Woman", "Man", "Non-binary"];
const AGE_GROUPS: AgeGroup[] = ["Young Adult", "Adult", "Middle-aged", "Senior"];
const BODY_TYPES: BodyType[] = ["Slim", "Athletic", "Average", "Heavy"];
const HAIR_LENGTHS: HairLength[] = ["Bald", "Short", "Medium", "Long"];
const SKIN_TONES: SkinTone[] = ["Light", "Medium", "Dark", "Very Dark"];
const FACE_CHARACTERS: FaceCharacter[] = ["Conventional", "Weathered", "Scarred", "Rugged"];
const DEFAULT_AGE_GROUP: AgeGroup = "Adult";
const DEFAULT_BODY_TYPE: BodyType = "Athletic";
const ACCENT_PRESETS = ["#00ff88", "#00ccff", "#3366ff", "#ff4444", "#ffaa00", "#8b5cf6", "#ff66cc"];
const LEGACY_BODY_TYPE_MAP: Record<string, BodyType> = {
  Wiry: "Slim",
  "Pear-shaped": "Average",
  Lanky: "Slim",
  Stocky: "Heavy",
  "Barrel-chested": "Heavy",
};
const LEGACY_HAIR_LENGTH_MAP: Record<string, HairLength> = {
  Buzzcut: "Short",
  "Very Long": "Long",
};
const LEGACY_AGE_GROUP_MAP: Record<string, AgeGroup> = {
};
const LEGACY_SKIN_TONE_MAP: Record<string, SkinTone> = {
  "Very Light": "Light",
  "Medium Light": "Medium",
  "Medium Dark": "Dark",
};
const LEGACY_FACE_CHARACTER_MAP: Record<string, FaceCharacter> = {
  Asymmetric: "Scarred",
  "Baby-faced": "Conventional",
  Gaunt: "Weathered",
  "Round-faced": "Conventional",
};

function normalizeBodyType(bodyType?: string): BodyType {
  if (bodyType && BODY_TYPES.includes(bodyType as BodyType)) return bodyType as BodyType;
  return LEGACY_BODY_TYPE_MAP[bodyType ?? ""] ?? DEFAULT_BODY_TYPE;
}

function normalizeHairLength(hairLength?: string): HairLength {
  if (hairLength && HAIR_LENGTHS.includes(hairLength as HairLength)) return hairLength as HairLength;
  return LEGACY_HAIR_LENGTH_MAP[hairLength ?? ""] ?? "Short";
}

function normalizeAgeGroup(ageGroup?: string): AgeGroup {
  if (ageGroup && AGE_GROUPS.includes(ageGroup as AgeGroup)) return ageGroup as AgeGroup;
  return LEGACY_AGE_GROUP_MAP[ageGroup ?? ""] ?? DEFAULT_AGE_GROUP;
}

function normalizeSkinTone(skinTone?: string): SkinTone {
  if (skinTone && SKIN_TONES.includes(skinTone as SkinTone)) return skinTone as SkinTone;
  return LEGACY_SKIN_TONE_MAP[skinTone ?? ""] ?? "Medium";
}

function normalizeFaceCharacter(faceCharacter?: string): FaceCharacter {
  if (faceCharacter && FACE_CHARACTERS.includes(faceCharacter as FaceCharacter)) return faceCharacter as FaceCharacter;
  return LEGACY_FACE_CHARACTER_MAP[faceCharacter ?? ""] ?? "Conventional";
}

export function EditCard() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cards, updateCard } = useCollection();
  const { updateCardInDecks } = useDecks();
  const { openUpgradeModal } = useTier();
  const { linkedLanguage, profile, useCraftlingua } = useLanguage();

  const original = cards.find((c) => c.id === cardId) ?? null;

  const [prompts, setPrompts] = useState<CardPrompts | null>(null);
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG);
  const [preview, setPreview] = useState<CardPayload | null>(null);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);

  // Ref pattern: allows the debounced auto-preview effect to access the latest
  // preview without adding `preview` as a dependency (which would create an
  // infinite loop, since the effect itself sets `preview`).
  const latestPreviewRef = useRef<CardPayload | null>(null);
  useEffect(() => { latestPreviewRef.current = preview; }, [preview]);

  // Initialise prompts from the original card once loaded.
  useEffect(() => {
    if (original && !prompts) {
      setPrompts({
        archetype: original.prompts.archetype,
        rarity: original.prompts.rarity as Rarity,
        style: resolveArchetypeStyle(original.prompts.archetype, original.prompts.style),
        district: original.prompts.district as District,
        accentColor: original.prompts.accentColor,
        gender: (original.prompts.gender as Gender) ?? "Non-binary",
        ageGroup: normalizeAgeGroup(original.prompts.ageGroup),
        bodyType: normalizeBodyType(original.prompts.bodyType),
        hairLength: normalizeHairLength(original.prompts.hairLength),
        skinTone: normalizeSkinTone(original.prompts.skinTone),
        faceCharacter: normalizeFaceCharacter(original.prompts.faceCharacter),
      });
      if (original.board) setBoardConfig(normalizeBoardConfig({ ...DEFAULT_BOARD_CONFIG, ...original.board }));
      setPreview(original);
    }
  }, [original, prompts]);

  // Auto-preview: rebuild the card preview 350 ms after any prompt or board
  // config change.  The generation is deterministic (seeded), so the same
  // options always produce the same card.
  useEffect(() => {
    if (!prompts || !original) return;
    setIsAutoUpdating(true);
    const timer = setTimeout(async () => {
      const currentPreview = latestPreviewRef.current;
      const previewPrompts = { ...prompts, style: resolveArchetypeStyle(prompts.archetype, prompts.style) };
      const normalizedBoard = normalizeBoardConfig(boardConfig);
      const newCard = generateCard(previewPrompts);
      const preservedName = currentPreview?.identity.name ?? original.identity.name;
      const preservedAge = currentPreview?.identity.age ?? original.identity.age ?? "";
      const preservedFlavorText =
        currentPreview?.front?.flavorTextEnglish ??
        currentPreview?.front?.flavorText ??
        original.front?.flavorTextEnglish ??
        original.front?.flavorText;
      const merged: CardPayload = {
        ...newCard,
        id: original.id,
        createdAt: original.createdAt,
        identity: {
          ...newCard.identity,
          name: preservedName,
          age: preservedAge,
        },
        backgroundImageUrl: original.backgroundImageUrl,
        characterImageUrl: original.characterImageUrl,
        frameImageUrl: original.frameImageUrl,
        front: {
          ...newCard.front,
          ...(preservedFlavorText !== undefined
            ? { flavorText: preservedFlavorText, flavorTextEnglish: preservedFlavorText }
            : {}),
        },
        board: {
          ...original.board,
          ...newCard.board,
          config: normalizedBoard,
          loadout: calculateBoardStats(normalizedBoard),
        },
        characterPlacement: original.characterPlacement,
      };
      setPreview(merged);
      setIsAutoUpdating(false);

      // Refresh the Craftlingua conlang overlay if configured.
      const front = await buildCraftlinguaFlavorFields({
        card: merged,
        linkedLanguage,
        profile,
        useCraftlingua,
      });
      setPreview((current) =>
        current && current.id === merged.id ? { ...current, front } : current,
      );
    }, AUTO_PREVIEW_DELAY_MS);

    return () => {
      clearTimeout(timer);
      setIsAutoUpdating(false);
    };
  }, [prompts, boardConfig, original, linkedLanguage, profile, useCraftlingua]);

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
    setIsDirty(true);
    setSaved(false);
  };

  const setArchetype = (archetype: Archetype) => {
    setPrompts((current) => current ? {
      ...current,
      archetype,
      style: resolveArchetypeStyle(archetype, current.style),
    } : current);
    setIsDirty(true);
    setSaved(false);
  };

  const handleBoardConfigChange = (config: BoardConfig) => {
    setBoardConfig(config);
    setIsDirty(true);
    setSaved(false);
  };

  const handleCardTextUpdate = (updates: { name?: string; age?: string; flavorText?: string }) => {
    setPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        identity: {
          ...current.identity,
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.age !== undefined ? { age: updates.age } : {}),
        },
        front: {
          ...current.front,
          ...(updates.flavorText !== undefined
            ? { flavorText: updates.flavorText, flavorTextEnglish: updates.flavorText }
            : {}),
        },
      } satisfies CardPayload;
    });
    if (updates.flavorText !== undefined) {
      const next = preview
        ? {
            ...preview,
            front: {
              ...preview.front,
              flavorText: updates.flavorText,
              flavorTextEnglish: updates.flavorText,
            },
          }
        : null;
      if (next) {
        void buildCraftlinguaFlavorFields({ card: next, linkedLanguage, profile, useCraftlingua })
          .then((front) =>
            setPreview((current) =>
              current && current.id === next.id ? { ...current, front } : current,
            ),
          );
      }
    }
    setIsDirty(true);
    setSaved(false);
  };

  const handleReset = () => {
    const resetPrompts: CardPrompts = {
      archetype: original.prompts.archetype,
      rarity: original.prompts.rarity as Rarity,
      style: resolveArchetypeStyle(original.prompts.archetype, original.prompts.style),
      district: original.prompts.district as District,
      accentColor: original.prompts.accentColor,
      gender: (original.prompts.gender as Gender) ?? "Non-binary",
      ageGroup: normalizeAgeGroup(original.prompts.ageGroup),
      bodyType: normalizeBodyType(original.prompts.bodyType),
      hairLength: normalizeHairLength(original.prompts.hairLength),
      skinTone: normalizeSkinTone(original.prompts.skinTone),
      faceCharacter: normalizeFaceCharacter(original.prompts.faceCharacter),
    };
    setPrompts(resetPrompts);
    setBoardConfig(normalizeBoardConfig({ ...DEFAULT_BOARD_CONFIG, ...original.board }));
    setPreview(original);
    setIsDirty(false);
    setSaved(false);
  };

  const handleSaveEdit = () => {
    if (!preview) return;
    updateCard(preview);
    updateCardInDecks(preview);
    setIsDirty(false);
    setSaved(true);
    setTimeout(() => navigate("/collection"), 800);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit Card</h1>
          <p className="page-sub">Tweak your courier — the preview updates automatically.</p>
        </div>
        <button className="btn-outline" onClick={() => { sfxClick(); navigate("/collection"); }}>← Back</button>
      </div>

      <div className="forge-layout">
        <div className="forge-form">

          {/* ── IDENTITY ─────────────────────────────────────────────────── */}
          <div className="edit-form-section-header">Identity</div>

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

          {/* ── APPEARANCE ───────────────────────────────────────────────── */}
          <div className="edit-form-section-header">Appearance</div>

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

          {/* ── STYLE ────────────────────────────────────────────────────── */}
          <div className="edit-form-section-header">Style</div>

          <div className="form-group">
            <label>Accent Color</label>
            <p className="form-hint" style={{ marginBottom: 12 }}>Accent color also drives hair color.</p>
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
            </div>
          </div>

          {/* ── BOARD ────────────────────────────────────────────────────── */}
          <div className="edit-form-section-header">Board Loadout</div>

          <div className="form-group">
            <p className="form-hint" style={{ marginBottom: 12 }}>
              Build your electric skateboard — your most important piece of gear.
            </p>
            <BoardBuilder
              value={boardConfig}
              onChange={handleBoardConfigChange}
              accentColor={prompts.accentColor}
              onSave={(config) => { handleBoardConfigChange(config); }}
            />
          </div>

          {/* ── ACTIONS (sticky bottom bar) ──────────────────────────────── */}
          <div className="edit-card-action-bar">
            {isAutoUpdating && (
              <p className="edit-card-status-hint">⏳ Updating preview…</p>
            )}
            {isDirty && !isAutoUpdating && !saved && (
              <p className="edit-card-status-hint edit-card-status-hint--dirty">● Unsaved changes</p>
            )}
            <button
              className="btn-primary btn-lg"
              onClick={() => { sfxClick(); handleSaveEdit(); }}
              disabled={saved || !isDirty || isAutoUpdating || !preview}
              style={isDirty && !isAutoUpdating && !saved ? { borderColor: "var(--accent2)", color: "var(--accent2)" } : undefined}
            >
              {saved ? "✓ Saved!" : "💾 Save Changes"}
            </button>
            {isDirty && (
              <button
                className="btn-outline btn-sm"
                style={{ width: "100%" }}
                onClick={() => { sfxClick(); handleReset(); }}
              >
                ↩ Reset to Original
              </button>
            )}
            <button className="btn-outline" style={{ width: "100%" }} onClick={() => { sfxClick(); openUpgradeModal(); }}>
              Manage Tier
            </button>
          </div>
        </div>

        <div className="forge-preview">
          {preview ? (
            <>
              <p className="form-hint edit-card-text-hint">
                ✎ Click the courier's name, age, or bio directly to edit them.
              </p>
              <CardDisplay
                card={preview}
                showShare={false}
                onUpdate={handleCardTextUpdate}
                initialEditField={searchParams.get("focus") === "name" ? "name" : undefined}
              />
            </>
          ) : (
            <div className="empty-preview">
              <span className="empty-icon">✎</span>
              <p>Loading card…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
