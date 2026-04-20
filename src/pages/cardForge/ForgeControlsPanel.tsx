import type {
  AgeGroup,
  Archetype,
  BodyType,
  CardPayload,
  CardPrompts,
  District,
  FaceCharacter,
  Gender,
  HairLength,
  Rarity,
  SkinTone,
} from "../../lib/types";
import { BoardBuilder } from "../../components/BoardBuilder";
import { ReferralPanel } from "../../components/ReferralPanel";
import type { BoardConfig } from "../../lib/boardBuilder";
import { FORGE_ARCHETYPE_OPTIONS } from "../../lib/factionDiscovery";
import { sfxClick } from "../../lib/sfx";

function ForgeLockBadge({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="form-group-lock-badge" onClick={onClick} aria-label={label}>
      🔒 Upgrade
    </button>
  );
}

function PillButton({
  active,
  label,
  disabled = false,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`pill${active ? " selected" : ""}`}
      onClick={() => {
        sfxClick();
        onClick();
      }}
      aria-pressed={active}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

interface ForgeControlsPanelProps {
  accentPresets: string[];
  bodyTypes: BodyType[];
  boardConfig: BoardConfig;
  canForge: boolean;
  canSaveToCollection: boolean;
  characterBlend: number;
  districts: District[];
  downloading: boolean;
  faceCharacters: FaceCharacter[];
  forging: boolean;
  freeCardUsed: boolean;
  genders: Gender[];
  generateCredits: number;
  generated: CardPayload | null;
  hairLengths: HairLength[];
  hasAnyLayerUrl: boolean;
  isAnyLayerLoading: boolean;
  onArchetypeChange: (archetype: Archetype) => void;
  onBlendChange: (value: number) => void;
  onBoardConfigChange: (config: BoardConfig) => void;
  onDownloadJpg: () => void;
  onForge: () => void;
  onOpen3D: () => void;
  onOpenPrint: () => void;
  onOpenUpgradeModal: () => void;
  onPromptChange: <K extends keyof CardPrompts>(key: K, value: CardPrompts[K]) => void;
  onSaveToCollection: () => void;
  prompts: CardPrompts;
  rarities: Rarity[];
  saveError: string | null;
  saving: boolean;
  skinTones: SkinTone[];
  tier: string;
  ageGroups: AgeGroup[];
}

export function ForgeControlsPanel({
  accentPresets,
  bodyTypes,
  boardConfig,
  canForge,
  canSaveToCollection,
  characterBlend,
  districts,
  downloading,
  faceCharacters,
  forging,
  freeCardUsed,
  genders,
  generateCredits,
  generated,
  hairLengths,
  hasAnyLayerUrl,
  isAnyLayerLoading,
  onArchetypeChange,
  onBlendChange,
  onBoardConfigChange,
  onDownloadJpg,
  onForge,
  onOpen3D,
  onOpenPrint,
  onOpenUpgradeModal,
  onPromptChange,
  onSaveToCollection,
  prompts,
  rarities,
  saveError,
  saving,
  skinTones,
  tier,
  ageGroups,
}: ForgeControlsPanelProps) {
  const isFreeTier = tier === "free";

  return (
    <div className="forge-form">
      <div className={`form-group${isFreeTier ? " form-group--locked" : ""}`}>
        <label>
          Cover Identity
          {isFreeTier && (
            <ForgeLockBadge onClick={onOpenUpgradeModal} label="Upgrade to unlock Cover Identity" />
          )}
        </label>
        <div className="pill-group">
          {FORGE_ARCHETYPE_OPTIONS.map((option) => (
            <PillButton
              key={option.value}
              active={prompts.archetype === option.value}
              label={option.label}
              disabled={isFreeTier}
              onClick={() => onArchetypeChange(option.value)}
            />
          ))}
        </div>
        <p className="form-hint">Pick the public-facing role your courier presents to the city.</p>
      </div>

      <div className={`form-group${isFreeTier ? " form-group--locked" : ""}`}>
        <label>
          Class
          {isFreeTier && (
            <ForgeLockBadge onClick={onOpenUpgradeModal} label="Upgrade to unlock Class" />
          )}
        </label>
        <div className="pill-group">
          {rarities.map((option) => (
            <PillButton
              key={option}
              active={prompts.rarity === option}
              label={option}
              disabled={isFreeTier}
              onClick={() => onPromptChange("rarity", option)}
            />
          ))}
        </div>
      </div>

      <div className={`form-group${isFreeTier ? " form-group--locked" : ""}`}>
        <label>
          District
          {isFreeTier && (
            <ForgeLockBadge onClick={onOpenUpgradeModal} label="Upgrade to unlock District" />
          )}
        </label>
        <div className="pill-group">
          {districts.map((option) => (
            <PillButton
              key={option}
              active={prompts.district === option}
              label={option}
              disabled={isFreeTier}
              onClick={() => onPromptChange("district", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Gender</label>
        <div className="pill-group">
          {genders.map((option) => (
            <PillButton
              key={option}
              active={prompts.gender === option}
              label={option}
              onClick={() => onPromptChange("gender", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Age Group</label>
        <div className="pill-group">
          {ageGroups.map((option) => (
            <PillButton
              key={option}
              active={prompts.ageGroup === option}
              label={option}
              onClick={() => onPromptChange("ageGroup", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Body Type</label>
        <div className="pill-group">
          {bodyTypes.map((option) => (
            <PillButton
              key={option}
              active={prompts.bodyType === option}
              label={option}
              onClick={() => onPromptChange("bodyType", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Hair Length</label>
        <div className="pill-group">
          {hairLengths.map((option) => (
            <PillButton
              key={option}
              active={prompts.hairLength === option}
              label={option}
              onClick={() => onPromptChange("hairLength", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Skin Tone</label>
        <div className="pill-group">
          {skinTones.map((option) => (
            <PillButton
              key={option}
              active={prompts.skinTone === option}
              label={option}
              onClick={() => onPromptChange("skinTone", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Face Character</label>
        <div className="pill-group">
          {faceCharacters.map((option) => (
            <PillButton
              key={option}
              active={prompts.faceCharacter === option}
              label={option}
              onClick={() => onPromptChange("faceCharacter", option)}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Accent Color</label>
        <p className="form-hint">Accent color also drives hair color.</p>
        <div className="color-group">
          {accentPresets.map((color) => (
            <button
              key={color}
              className={`color-swatch${prompts.accentColor === color ? " selected" : ""}`}
              style={{ background: color }}
              onClick={() => {
                sfxClick();
                onPromptChange("accentColor", color);
              }}
              aria-pressed={prompts.accentColor === color}
              aria-label={`Accent color ${color}`}
              title={color}
            />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Board Loadout</label>
        <p className="form-hint" style={{ marginBottom: 6 }}>
          Build your electric skateboard — your most important piece of gear.
        </p>
        <BoardBuilder
          value={boardConfig}
          onChange={onBoardConfigChange}
          accentColor={prompts.accentColor}
          onSave={onBoardConfigChange}
        />
      </div>

      <button
        className="btn-primary btn-lg btn-forge"
        onClick={onForge}
        disabled={forging || isAnyLayerLoading}
        data-testid="forge-button"
      >
        {isAnyLayerLoading
          ? "✨ Generating…"
          : !canForge
            ? "🔒 FORGE YOUR CARD — Upgrade to Unlock"
            : tier === "free" && !freeCardUsed
              ? "⚡ FORGE YOUR CARD (1 free card)"
              : generateCredits > 0
                ? `⚡ FORGE YOUR CARD (${generateCredits} credit${generateCredits === 1 ? "" : "s"} left)`
                : "⚡ FORGE YOUR CARD"}
      </button>

      <ReferralPanel />

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
                className="range-slider"
                min={0}
                max={1}
                step={0.05}
                value={characterBlend}
                onChange={(event) => onBlendChange(Number(event.target.value))}
              />
            </div>
          )}
          <div className="forge-generated-buttons">
            <button className="btn-outline btn-3d" onClick={onOpen3D} title="View card in 3D">
              ◈ 3D
            </button>
            <button className="btn-outline" onClick={onOpenPrint} title="Print this card">
              🖨 Print
            </button>
            {canSaveToCollection ? (
              <button
                className="btn-primary"
                onClick={onSaveToCollection}
                disabled={saving}
                title="Save card to your Collection"
              >
                {saving ? "💾 Saving…" : "💾 Save to Collection"}
              </button>
            ) : (
              <button
                className="btn-outline"
                onClick={onOpenUpgradeModal}
                title="Upgrade to save cards to your Collection"
              >
                🔒 Save to Collection
              </button>
            )}
            <button
              className="btn-outline"
              onClick={onDownloadJpg}
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
  );
}
