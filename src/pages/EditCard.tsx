import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  Archetype,
  BoardPlacement,
  CardPayload,
  CardPrompts,
  CharacterPlacement,
  CompositeLayerOrder,
  District,
  Gender,
  AgeGroup,
  BodyType,
  HairLength,
  SkinTone,
  FaceCharacter,
  Rarity,
} from "../lib/types";
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
import {
  BOARD_PLACEMENT_MAX_SCALE,
  BOARD_PLACEMENT_MIN_SCALE,
  BOARD_PLACEMENT_SCALE_STEP,
  CHARACTER_PLACEMENT_MAX_SCALE,
  CHARACTER_PLACEMENT_MIN_SCALE,
  CHARACTER_PLACEMENT_SCALE_STEP,
  normalizeBoardPlacement,
  normalizeCharacterPlacement,
  resolveBoardLayerOrder,
} from "../lib/boardPlacement";
import { resolveBoardPoseScene } from "../lib/boardPoseScenes";

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
const LEGACY_AGE_GROUP_MAP: Record<string, AgeGroup> = {};
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
const APPEARANCE_ART_KEYS: Array<keyof CardPrompts> = [
  "archetype",
  "gender",
  "ageGroup",
  "bodyType",
  "hairLength",
  "skinTone",
  "faceCharacter",
  "accentColor",
];

type EditMode = "identity" | "appearance" | "board" | "layout" | "art";
type ArtOverrideKey = "background" | "character" | "frame" | "board";

const EDIT_MODE_META: Record<EditMode, {
  title: string;
  description: string;
  impact: string[];
}> = {
  identity: {
    title: "Identity & metadata",
    description: "Rename the courier, tune the public-facing role, and adjust bio copy without leaving the saved-card editor.",
    impact: ["Changes save directly to collection + decks", "No art reset for text-only edits"],
  },
  appearance: {
    title: "Appearance & build inputs",
    description: "Change the courier’s look and class inputs here. Matching saved generated art automatically falls back to the live card render when those inputs diverge.",
    impact: ["Changes stats/class data immediately", "Clears stale character, background, or frame art as needed"],
  },
  board: {
    title: "Board loadout",
    description: "Adjust the deck hardware here, then use Workshop only when you want to bind a saved spare board from the floor.",
    impact: ["Updates board stats + access profile", "Clears stale board art when the loadout changes"],
  },
  layout: {
    title: "Layout & gameplay tuning",
    description: "Reposition layers and tune card stats in the same screen instead of hopping back to Forge or Workshop.",
    impact: ["Layout updates keep existing art", "Stat edits save directly to decks"],
  },
  art: {
    title: "Art consistency",
    description: "See which generated layers are stale, then reset them to the live render so the saved card always matches its current build.",
    impact: ["Lets you clear saved generated art per layer", "Board replacement still lives in Workshop"],
  },
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

function buildPromptsFromCard(card: CardPayload): CardPrompts {
  return {
    archetype: card.prompts.archetype,
    rarity: card.prompts.rarity as Rarity,
    style: resolveArchetypeStyle(card.prompts.archetype, card.prompts.style),
    district: card.prompts.district as District,
    accentColor: card.prompts.accentColor,
    gender: (card.prompts.gender as Gender) ?? "Non-binary",
    ageGroup: normalizeAgeGroup(card.prompts.ageGroup),
    bodyType: normalizeBodyType(card.prompts.bodyType),
    hairLength: normalizeHairLength(card.prompts.hairLength),
    skinTone: normalizeSkinTone(card.prompts.skinTone),
    faceCharacter: normalizeFaceCharacter(card.prompts.faceCharacter),
  };
}

function getOriginalBoardConfig(card: CardPayload): BoardConfig {
  return normalizeBoardConfig({ ...DEFAULT_BOARD_CONFIG, ...card.board.config });
}

function areBoardConfigsEqual(left: BoardConfig, right: BoardConfig): boolean {
  return JSON.stringify(normalizeBoardConfig(left)) === JSON.stringify(normalizeBoardConfig(right));
}

function clampStatValue(value: number): number {
  return Math.max(0, Math.min(10, Number.isFinite(value) ? value : 0));
}

function resolveInitialEditMode(searchParams: URLSearchParams): EditMode {
  const raw = searchParams.get("mode");
  if (raw === "rename") return "identity";
  if (raw === "refresh") return "art";
  if (raw === "identity" || raw === "appearance" || raw === "board" || raw === "layout" || raw === "art") {
    return raw;
  }
  return "identity";
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
  const [activeMode, setActiveMode] = useState<EditMode>(() => resolveInitialEditMode(searchParams));
  const [artOverrides, setArtOverrides] = useState<Record<ArtOverrideKey, boolean>>({
    background: false,
    character: false,
    frame: false,
    board: false,
  });

  const latestPreviewRef = useRef<CardPayload | null>(null);
  const identitySectionRef = useRef<HTMLDivElement | null>(null);
  const appearanceSectionRef = useRef<HTMLDivElement | null>(null);
  const boardSectionRef = useRef<HTMLDivElement | null>(null);
  const layoutSectionRef = useRef<HTMLDivElement | null>(null);
  const artSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    latestPreviewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    if (!original || prompts) return;
    setPrompts(buildPromptsFromCard(original));
    setBoardConfig(getOriginalBoardConfig(original));
    setPreview(original);
    setArtOverrides({ background: false, character: false, frame: false, board: false });
  }, [original, prompts]);

  const originalPrompts = useMemo(
    () => (original ? buildPromptsFromCard(original) : null),
    [original],
  );
  const originalBoardConfig = useMemo(
    () => (original ? getOriginalBoardConfig(original) : DEFAULT_BOARD_CONFIG),
    [original],
  );

  const artRefreshState = useMemo(() => {
    if (!original || !prompts) {
      return {
        background: false,
        character: false,
        frame: false,
        board: false,
        any: false,
      };
    }

    const districtChanged = prompts.district !== originalPrompts?.district;
    const frameChanged = prompts.rarity !== originalPrompts?.rarity;
    const characterChanged = APPEARANCE_ART_KEYS.some((key) => prompts[key] !== originalPrompts?.[key]);
    const boardChanged = !areBoardConfigsEqual(boardConfig, originalBoardConfig);
    const state = {
      background: districtChanged || artOverrides.background,
      character: characterChanged || artOverrides.character,
      frame: frameChanged || artOverrides.frame,
      board: boardChanged || artOverrides.board,
    };

    return {
      ...state,
      any: state.background || state.character || state.frame || state.board,
    };
  }, [artOverrides, boardConfig, original, originalBoardConfig, originalPrompts, prompts]);

  const changeSummary = useMemo(() => {
    if (!original || !preview || !prompts) {
      return {
        metadata: false,
        gameplay: false,
        layout: false,
        board: false,
      };
    }

    const metadata =
      preview.identity.name !== original.identity.name ||
      (preview.identity.age ?? "") !== (original.identity.age ?? "") ||
      (preview.front.flavorTextEnglish ?? preview.front.flavorText ?? "") !==
        (original.front.flavorTextEnglish ?? original.front.flavorText ?? "");

    const gameplay = JSON.stringify(preview.stats) !== JSON.stringify(original.stats);
    const layout =
      JSON.stringify(preview.characterPlacement) !== JSON.stringify(original.characterPlacement) ||
      JSON.stringify(preview.board.placement) !== JSON.stringify(original.board.placement) ||
      resolveBoardLayerOrder(preview.board.layerOrder) !== resolveBoardLayerOrder(original.board.layerOrder);
    const board = !areBoardConfigsEqual(boardConfig, originalBoardConfig);

    return { metadata, gameplay, layout, board };
  }, [boardConfig, original, originalBoardConfig, preview, prompts]);

  const boardPlacement = useMemo(() => {
    if (!preview) return null;
    const scene = resolveBoardPoseScene(preview.characterSeed);
    return normalizeBoardPlacement(scene.key, preview.board.placement);
  }, [preview]);

  const characterPlacement = useMemo(
    () => (preview ? normalizeCharacterPlacement(preview.characterPlacement) : null),
    [preview],
  );

  const boardLayerOrder = useMemo(
    () => (preview ? resolveBoardLayerOrder(preview.board.layerOrder) : "behind-character"),
    [preview],
  );

  useEffect(() => {
    if (!prompts) return;
    const sectionMap = {
      identity: identitySectionRef,
      appearance: appearanceSectionRef,
      board: boardSectionRef,
      layout: layoutSectionRef,
      art: artSectionRef,
    };
    sectionMap[activeMode].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeMode, prompts]);

  useEffect(() => {
    if (!prompts || !original) return;
    setIsAutoUpdating(true);
    const timer = setTimeout(async () => {
      const currentPreview = latestPreviewRef.current;
      const previewPrompts = { ...prompts, style: resolveArchetypeStyle(prompts.archetype, prompts.style) };
      const normalizedBoard = normalizeBoardConfig(boardConfig);
      const newCard = generateCard(previewPrompts);
      const buildInputsChanged = currentPreview == null
        || JSON.stringify(currentPreview.prompts) !== JSON.stringify(newCard.prompts)
        || !areBoardConfigsEqual(currentPreview.board.config, normalizedBoard);
      const preservedName = currentPreview?.identity.name ?? original.identity.name;
      const preservedAge = currentPreview?.identity.age ?? original.identity.age ?? "";
      const preservedFlavorText =
        currentPreview?.front?.flavorTextEnglish ??
        currentPreview?.front?.flavorText ??
        original.front?.flavorTextEnglish ??
        original.front?.flavorText;
      const preservedStats = !buildInputsChanged && currentPreview ? currentPreview.stats : newCard.stats;
      const preservedBoardPlacement =
        currentPreview?.board?.placement ?? original.board.placement;
      const preservedBoardLayerOrder =
        currentPreview?.board?.layerOrder ?? original.board.layerOrder;
      const preservedCharacterPlacement =
        currentPreview?.characterPlacement ?? original.characterPlacement;

      const merged: CardPayload = {
        ...newCard,
        id: original.id,
        createdAt: original.createdAt,
        identity: {
          ...newCard.identity,
          name: preservedName,
          age: preservedAge,
        },
        stats: preservedStats,
        backgroundImageUrl: artRefreshState.background ? undefined : original.backgroundImageUrl,
        characterImageUrl: artRefreshState.character ? undefined : original.characterImageUrl,
        frameImageUrl: artRefreshState.frame ? undefined : original.frameImageUrl,
        front: {
          ...newCard.front,
          ...(preservedFlavorText !== undefined
            ? { flavorText: preservedFlavorText, flavorTextEnglish: preservedFlavorText }
            : {}),
        },
        board: {
          ...original.board,
          ...newCard.board,
          imageUrl: artRefreshState.board ? undefined : original.board.imageUrl,
          config: normalizedBoard,
          loadout: calculateBoardStats(normalizedBoard),
          placement: preservedBoardPlacement,
          layerOrder: preservedBoardLayerOrder,
        },
        characterPlacement: preservedCharacterPlacement,
      };

      setPreview(merged);
      setIsAutoUpdating(false);

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
  }, [artRefreshState.background, artRefreshState.board, artRefreshState.character, artRefreshState.frame, boardConfig, linkedLanguage, original, profile, prompts, useCraftlingua]);

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
    setPrompts((current) => (current ? { ...current, [key]: val } : current));
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

  const handleStatChange = (key: keyof CardPayload["stats"], value: number) => {
    setPreview((current) => current ? {
      ...current,
      stats: {
        ...current.stats,
        [key]: clampStatValue(value),
      },
    } : current);
    setIsDirty(true);
    setSaved(false);
  };

  const updateBoardPlacement = (updates: Partial<BoardPlacement>) => {
    setPreview((current) => {
      if (!current) return current;
      const scene = resolveBoardPoseScene(current.characterSeed);
      const nextPlacement = normalizeBoardPlacement(scene.key, {
        ...normalizeBoardPlacement(scene.key, current.board.placement),
        ...updates,
      });
      return {
        ...current,
        board: {
          ...current.board,
          placement: nextPlacement,
        },
      };
    });
    setIsDirty(true);
    setSaved(false);
  };

  const updateCharacterPlacement = (updates: Partial<CharacterPlacement>) => {
    setPreview((current) => {
      if (!current) return current;
      const nextPlacement = normalizeCharacterPlacement({
        ...normalizeCharacterPlacement(current.characterPlacement),
        ...updates,
      });
      return {
        ...current,
        characterPlacement: nextPlacement,
      };
    });
    setIsDirty(true);
    setSaved(false);
  };

  const handleBoardLayerOrderChange = (layerOrder: CompositeLayerOrder) => {
    setPreview((current) => current ? {
      ...current,
      board: {
        ...current.board,
        layerOrder: resolveBoardLayerOrder(layerOrder),
      },
    } : current);
    setIsDirty(true);
    setSaved(false);
  };

  const handleResetSavedArt = (scope: ArtOverrideKey | "all") => {
    setArtOverrides((current) => ({
      background: scope === "all" ? true : current.background || scope === "background",
      character: scope === "all" ? true : current.character || scope === "character",
      frame: scope === "all" ? true : current.frame || scope === "frame",
      board: scope === "all" ? true : current.board || scope === "board",
    }));
    setIsDirty(true);
    setSaved(false);
  };

  const handleReset = () => {
    setPrompts(buildPromptsFromCard(original));
    setBoardConfig(getOriginalBoardConfig(original));
    setPreview(original);
    setArtOverrides({ background: false, character: false, frame: false, board: false });
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

  const isSaveDisabled = saved || !isDirty || isAutoUpdating || !preview;
  const saveButtonStyle = isDirty && !isAutoUpdating && !saved
    ? { borderColor: "var(--accent2)", color: "var(--accent2)" }
    : undefined;
  const initialEditField = searchParams.get("focus") === "name"
    ? "name"
    : searchParams.get("focus") === "age"
      ? "age"
      : searchParams.get("focus") === "bio"
        ? "bio"
        : undefined;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customize Card</h1>
          <p className="page-sub">One hub for identity, build, board, layout, stats, and art consistency.</p>
        </div>
        <button className="btn-outline" onClick={() => { sfxClick(); navigate("/collection"); }}>← Back</button>
      </div>

      <section className="edit-card-mode-bar" aria-label="Customize card modes">
        {(Object.keys(EDIT_MODE_META) as EditMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`pill${activeMode === mode ? " selected" : ""}`}
            onClick={() => {
              sfxClick();
              setActiveMode(mode);
            }}
          >
            {EDIT_MODE_META[mode].title}
          </button>
        ))}
      </section>

      <section className="edit-card-mode-callout" aria-live="polite">
        <div>
          <p className="eyebrow">Active edit domain</p>
          <h2>{EDIT_MODE_META[activeMode].title}</h2>
          <p>{EDIT_MODE_META[activeMode].description}</p>
        </div>
        <div className="edit-card-impact-chips">
          {EDIT_MODE_META[activeMode].impact.map((impact) => (
            <span key={impact} className="edit-card-impact-chip">{impact}</span>
          ))}
        </div>
      </section>

      <div className="forge-layout">
        <div className="forge-form">
          <div ref={identitySectionRef}>
            <div className="edit-form-section-header">Identity & Metadata</div>

            <div className="form-group">
              <label>Cover Identity</label>
              <div className="pill-group">
                {FORGE_ARCHETYPE_OPTIONS.map((opt) => (
                  <button key={opt.value} className={`pill ${prompts.archetype === opt.value ? "selected" : ""}`} onClick={() => { sfxClick(); setArchetype(opt.value); }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="form-hint">Pick the public-facing role your courier presents to the city.</p>
            </div>

            <div className="form-group">
              <label>Class</label>
              <div className="pill-group">
                {RARITIES.map((r) => (
                  <button key={r} className={`pill ${prompts.rarity === r ? "selected" : ""}`} onClick={() => { sfxClick(); set("rarity", r); }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>District</label>
              <div className="pill-group">
                {DISTRICTS.map((d) => (
                  <button key={d} className={`pill ${prompts.district === d ? "selected" : ""}`} onClick={() => { sfxClick(); set("district", d); }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={appearanceSectionRef}>
            <div className="edit-form-section-header">Appearance</div>

            <div className="form-group">
              <label>Gender</label>
              <div className="pill-group">
                {GENDERS.map((g) => (
                  <button key={g} className={`pill${prompts.gender === g ? " selected" : ""}`} onClick={() => { sfxClick(); set("gender", g); }}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Age Group</label>
              <div className="pill-group">
                {AGE_GROUPS.map((ageGroup) => (
                  <button key={ageGroup} className={`pill${prompts.ageGroup === ageGroup ? " selected" : ""}`} onClick={() => { sfxClick(); set("ageGroup", ageGroup); }}>
                    {ageGroup}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Body Type</label>
              <div className="pill-group">
                {BODY_TYPES.map((bodyType) => (
                  <button key={bodyType} className={`pill${prompts.bodyType === bodyType ? " selected" : ""}`} onClick={() => { sfxClick(); set("bodyType", bodyType); }}>
                    {bodyType}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Hair Length</label>
              <div className="pill-group">
                {HAIR_LENGTHS.map((opt) => (
                  <button key={opt} className={`pill${prompts.hairLength === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("hairLength", opt); }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Skin Tone</label>
              <div className="pill-group">
                {SKIN_TONES.map((opt) => (
                  <button key={opt} className={`pill${prompts.skinTone === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("skinTone", opt); }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Face Character</label>
              <div className="pill-group">
                {FACE_CHARACTERS.map((opt) => (
                  <button key={opt} className={`pill${prompts.faceCharacter === opt ? " selected" : ""}`} onClick={() => { sfxClick(); set("faceCharacter", opt); }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

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
          </div>

          <div ref={boardSectionRef}>
            <div className="edit-form-section-header">Board Loadout</div>

            <div className="form-group">
              <p className="form-hint" style={{ marginBottom: 12 }}>
                Build your electric skateboard here. If the hardware changes, saved board art is cleared so the card stays accurate.
              </p>
              <BoardBuilder
                value={boardConfig}
                onChange={handleBoardConfigChange}
                accentColor={prompts.accentColor}
                onSave={(config) => { handleBoardConfigChange(config); }}
              />
            </div>
          </div>

          <div ref={layoutSectionRef}>
            <div className="edit-form-section-header">Gameplay & Layout</div>

            <div className="form-group">
              <label>Card Stats</label>
              <div className="edit-card-stat-grid">
                {(["speed", "range", "stealth", "grit"] as const).map((key) => (
                  <label key={key} className="edit-card-stat-field">
                    <span>{key[0].toUpperCase() + key.slice(1)}</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={10}
                      value={preview?.stats[key] ?? 0}
                      onChange={(event) => handleStatChange(key, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
              <p className="form-hint">These changes save directly to any deck containing this card.</p>
            </div>

            {boardPlacement && characterPlacement && (
              <div className="edit-card-layout-grid">
                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Board X</span>
                    <span>{Math.round(boardPlacement.xPercent)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={boardPlacement.xPercent}
                    onChange={(event) => updateBoardPlacement({ xPercent: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Board Y</span>
                    <span>{Math.round(boardPlacement.yPercent)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={boardPlacement.yPercent}
                    onChange={(event) => updateBoardPlacement({ yPercent: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Board Size</span>
                    <span>{Math.round(boardPlacement.scale * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={BOARD_PLACEMENT_MIN_SCALE}
                    max={BOARD_PLACEMENT_MAX_SCALE}
                    step={BOARD_PLACEMENT_SCALE_STEP}
                    value={boardPlacement.scale}
                    onChange={(event) => updateBoardPlacement({ scale: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Board Rotation</span>
                    <span>{Math.round(boardPlacement.rotationDeg)}°</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={-180}
                    max={180}
                    step={1}
                    value={boardPlacement.rotationDeg}
                    onChange={(event) => updateBoardPlacement({ rotationDeg: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Board Layer</span>
                    <span>{boardLayerOrder === "behind-character" ? "Behind Character" : "In Front"}</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={0}
                    max={1}
                    step={1}
                    value={boardLayerOrder === "behind-character" ? 0 : 1}
                    onChange={(event) => handleBoardLayerOrderChange(Number(event.target.value) === 0 ? "behind-character" : "in-front")}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Character X</span>
                    <span>{Math.round(characterPlacement.xPercent)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={characterPlacement.xPercent}
                    onChange={(event) => updateCharacterPlacement({ xPercent: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Character Y</span>
                    <span>{Math.round(characterPlacement.yPercent)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={characterPlacement.yPercent}
                    onChange={(event) => updateCharacterPlacement({ yPercent: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Character Size</span>
                    <span>{Math.round(characterPlacement.scale * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={CHARACTER_PLACEMENT_MIN_SCALE}
                    max={CHARACTER_PLACEMENT_MAX_SCALE}
                    step={CHARACTER_PLACEMENT_SCALE_STEP}
                    value={characterPlacement.scale}
                    onChange={(event) => updateCharacterPlacement({ scale: Number(event.target.value) })}
                  />
                </div>

                <div className="blend-control">
                  <label className="blend-control__label">
                    <span>Character Rotation</span>
                    <span>{Math.round(characterPlacement.rotationDeg)}°</span>
                  </label>
                  <input
                    type="range"
                    className="range-slider"
                    min={-180}
                    max={180}
                    step={1}
                    value={characterPlacement.rotationDeg}
                    onChange={(event) => updateCharacterPlacement({ rotationDeg: Number(event.target.value) })}
                  />
                </div>
              </div>
            )}

            <p className="form-hint">Use these sliders for precise saved-card layout changes. Workshop is now optional for board placement, not required.</p>
          </div>

          <div ref={artSectionRef}>
            <div className="edit-form-section-header">Art Consistency</div>

            <div className="edit-card-art-panel">
              <p className="form-hint">
                Matching generated layers stay only while the saved build still matches them. When prompts or hardware change, the editor falls back to the live render so the card stays honest.
              </p>
              <div className="edit-card-impact-chips">
                <span className={`edit-card-impact-chip${artRefreshState.background ? " edit-card-impact-chip--warn" : ""}`}>
                  Background: {artRefreshState.background ? "refreshing to live render" : "saved art still valid"}
                </span>
                <span className={`edit-card-impact-chip${artRefreshState.character ? " edit-card-impact-chip--warn" : ""}`}>
                  Character: {artRefreshState.character ? "refreshing to live render" : "saved art still valid"}
                </span>
                <span className={`edit-card-impact-chip${artRefreshState.frame ? " edit-card-impact-chip--warn" : ""}`}>
                  Frame: {artRefreshState.frame ? "refreshing to live render" : "saved art still valid"}
                </span>
                <span className={`edit-card-impact-chip${artRefreshState.board ? " edit-card-impact-chip--warn" : ""}`}>
                  Board: {artRefreshState.board ? "refreshing to live render" : "saved art still valid"}
                </span>
              </div>
              <div className="edit-card-art-actions">
                <button className="btn-outline btn-sm" type="button" onClick={() => { sfxClick(); handleResetSavedArt("all"); }}>
                  Reset All Saved Art
                </button>
                <button className="btn-outline btn-sm" type="button" onClick={() => { sfxClick(); handleResetSavedArt("character"); }}>
                  Reset Character Art
                </button>
                <button className="btn-outline btn-sm" type="button" onClick={() => { sfxClick(); handleResetSavedArt("board"); }}>
                  Reset Board Art
                </button>
                <button className="btn-outline btn-sm" type="button" onClick={() => { sfxClick(); navigate(`/workshop?card=${original.id}`); }}>
                  Open Workshop Board Bay
                </button>
              </div>
            </div>
          </div>

          <div className="edit-card-action-bar">
            {isAutoUpdating && (
              <p className="edit-card-status-hint">⏳ Updating preview…</p>
            )}
            {isDirty && !isAutoUpdating && !saved && (
              <p className="edit-card-status-hint edit-card-status-hint--dirty">● Unsaved changes</p>
            )}
            {!isAutoUpdating && (
              <p className="edit-card-status-hint">
                {artRefreshState.any
                  ? "Saved generated art will fall back to the live render for any stale layers listed above."
                  : "Preview and saved art are currently aligned."}
              </p>
            )}
            <button
              className="btn-primary btn-lg"
              onClick={() => { sfxClick(); handleSaveEdit(); }}
              disabled={isSaveDisabled}
              style={saveButtonStyle}
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
              <div className="edit-card-preview-summary">
                <span className={`edit-card-preview-chip${changeSummary.metadata ? " edit-card-preview-chip--active" : ""}`}>
                  Metadata {changeSummary.metadata ? "changed" : "stable"}
                </span>
                <span className={`edit-card-preview-chip${changeSummary.gameplay ? " edit-card-preview-chip--active" : ""}`}>
                  Stats {changeSummary.gameplay ? "changed" : "stable"}
                </span>
                <span className={`edit-card-preview-chip${changeSummary.layout ? " edit-card-preview-chip--active" : ""}`}>
                  Layout {changeSummary.layout ? "changed" : "stable"}
                </span>
                <span className={`edit-card-preview-chip${changeSummary.board ? " edit-card-preview-chip--active" : ""}`}>
                  Board build {changeSummary.board ? "changed" : "stable"}
                </span>
              </div>
              <p className="form-hint edit-card-text-hint">
                ✎ Click the courier&apos;s name, age, or bio directly to edit them. All other saved-card controls live in the left column.
              </p>
              <CardDisplay
                card={preview}
                showShare={false}
                onUpdate={handleCardTextUpdate}
                initialEditField={initialEditField}
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
