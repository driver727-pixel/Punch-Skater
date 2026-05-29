import type {
  AgeGroup,
  Archetype,
  BodyType,
  CardPrompts,
  District,
  FaceCharacter,
  Gender,
  HairLength,
  SkinTone,
} from "../../lib/types";
import { BoardBuilder } from "../../components/BoardBuilder";
import { LanguageProfilePanel } from "../../components/LanguageProfilePanel";
import { ReferralPanel } from "../../components/ReferralPanel";
import ozziesConfig from "../../lib/ozziesConfig.json";
import type { BoardConfig } from "../../lib/boardBuilder";
import { FORGE_CLASS_ODDS } from "../../lib/cardClassProgression";
import { formatDurationClock, getRemainingDurationMs } from "../../lib/dailyRewards";
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
  districts: District[];
  faceCharacters: FaceCharacter[];
  forging: boolean;
  freeCardUsed: boolean;
  freeForgeReadyAt: number | null;
  genders: Gender[];
  generateCredits: number;
  hairLengths: HairLength[];
  isAnyLayerLoading: boolean;
  isAdmin?: boolean;
  onArchetypeChange: (archetype: Archetype) => void;
  onBoardConfigChange: (config: BoardConfig) => void;
  onForge: () => void;
  onOpenUpgradeModal: () => void;
  onPromptChange: <K extends keyof CardPrompts>(key: K, value: CardPrompts[K]) => void;
  onWeaponSelect?: (weaponUrl: string | undefined) => void;
  ozziesBalance: number;
  prompts: CardPrompts;
  requiresOzzies: boolean;
  selectedWeaponUrl?: string;
  skinTones: SkinTone[];
  spendingOzzies: boolean;
  tier: string;
  walletMessage: string | null;
  walletMessageTone: "info" | "error";
  ageGroups: AgeGroup[];
  weaponAssets?: Array<{ url: string; name: string }>;
  weaponUnlockXp?: number;
  weaponsUnlocked?: boolean;
}

export function ForgeControlsPanel({
  accentPresets,
  bodyTypes,
  boardConfig,
  canForge,
  districts,
  faceCharacters,
  forging,
  freeCardUsed,
  freeForgeReadyAt,
  genders,
  generateCredits,
  hairLengths,
  isAnyLayerLoading,
  onArchetypeChange,
  onBoardConfigChange,
  onForge,
  onOpenUpgradeModal,
  onPromptChange,
  onWeaponSelect,
  ozziesBalance,
  prompts,
  requiresOzzies,
  selectedWeaponUrl,
  skinTones,
  spendingOzzies,
  tier,
  walletMessage,
  walletMessageTone,
  ageGroups,
  weaponAssets,
  weaponUnlockXp = 0,
  weaponsUnlocked = true,
}: ForgeControlsPanelProps) {
  const isFreeTier = tier === "free";
  const freeForgeRemainingMs = getRemainingDurationMs(freeForgeReadyAt);
  const isFreeForgeCoolingDown = isFreeTier && !requiresOzzies && freeForgeRemainingMs > 0 && generateCredits === 0;

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

      <div className="form-group">
        <label>District</label>
        <div className="pill-group">
          {districts.map((option) => (
            <PillButton
              key={option}
              active={prompts.district === option}
              label={option}
              onClick={() => onPromptChange("district", option)}
            />
          ))}
        </div>
      </div>

      <LanguageProfilePanel />

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

      {weaponAssets && weaponAssets.length > 0 && onWeaponSelect && (
        <div className="form-group">
          <label>Weapon</label>
          <p className="form-hint" style={{ marginBottom: 6 }}>
            {weaponsUnlocked
              ? "Equip a weapon to your card — drag it into position on the preview."
              : `Weapons unlock at ${weaponUnlockXp.toLocaleString()} XP. Until then, they are shown as unavailable.`}
          </p>
          <div className="forge-weapon-grid">
            <button
              type="button"
              className={`forge-weapon-option${!selectedWeaponUrl ? " selected" : ""}`}
              onClick={() => onWeaponSelect(undefined)}
              aria-pressed={!selectedWeaponUrl}
              disabled={!weaponsUnlocked}
            >
              None
            </button>
            {weaponAssets.map((weapon) => (
              <button
                key={weapon.url}
                type="button"
                className={`forge-weapon-option${selectedWeaponUrl === weapon.url ? " selected" : ""}${!weaponsUnlocked ? " forge-weapon-option--locked" : ""}`}
                onClick={() => {
                  if (!weaponsUnlocked) return;
                  onWeaponSelect(weapon.url);
                }}
                aria-pressed={selectedWeaponUrl === weapon.url}
                disabled={!weaponsUnlocked}
                title={weapon.name}
              >
                <img src={weapon.url} alt={weapon.name} className="forge-weapon-thumb" />
                <span className="forge-weapon-name">{weapon.name}</span>
                {!weaponsUnlocked && (
                  <span className="forge-weapon-lock">
                    <span aria-hidden="true">🔒 {weaponUnlockXp.toLocaleString()} XP</span>
                    <span className="visually-hidden">
                      Weapon locked. Requires {weaponUnlockXp.toLocaleString()} mission XP to unlock.
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="forge-class-odds">
        <button type="button" className="forge-class-odds__trigger btn-outline btn-glass btn-sm">
          Forge Class Odds
        </button>
        <div className="forge-class-odds__popup" aria-label="Forge class odds">
          <p className="forge-class-odds__title">Forge Class Odds</p>
          <ul className="forge-class-odds__list">
            {FORGE_CLASS_ODDS.map((tier) => (
              <li key={tier.label} className="forge-class-odds__row">
                <span className="forge-class-odds__label">{tier.label}</span>
                <span className="forge-class-odds__chance">{tier.chance}</span>
                <span className="forge-class-odds__note">{tier.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="btn-primary btn-lg btn-forge"
        onClick={onForge}
        disabled={forging || isAnyLayerLoading || spendingOzzies || isFreeForgeCoolingDown}
        data-testid="forge-button"
      >
        {isAnyLayerLoading
          ? "✨ Generating…"
          : spendingOzzies
            ? "💰 Spending Ozzies…"
          : isFreeForgeCoolingDown
            ? `⚡ Forge Card (ready in ${formatDurationClock(freeForgeRemainingMs)})`
          : !canForge
            ? requiresOzzies
              ? `💰 Need ${ozziesConfig.cardForgeCost} Ozzies to Forge`
              : "🔒 Forge Card — Upgrade to Unlock"
          : tier === "free" && !freeCardUsed
              ? "⚡ Forge Card (1 free card)"
              : generateCredits > 0
                ? `⚡ Forge Card (${generateCredits} credit${generateCredits === 1 ? "" : "s"} left)`
                : requiresOzzies
                  ? `💰 Forge Card (${ozziesConfig.cardForgeCost} Ozzies)`
                  : "⚡ Forge Card"}
      </button>
      {isFreeTier && generateCredits === 0 && !requiresOzzies && (
        <p className="form-hint">
          {freeForgeRemainingMs > 0
            ? `Your next free forge unlocks in ${formatDurationClock(freeForgeRemainingMs)}.`
            : freeCardUsed
              ? "Your daily free forge is ready."
              : "Your first free forge is ready right now."}
        </p>
      )}
      {requiresOzzies && (
        <p className="forge-wallet-note">
          Wallet balance: <strong>{ozziesBalance}</strong> Ozzies. Card Forge costs {ozziesConfig.cardForgeCost} Ozzies once free/referral credits are spent.
        </p>
      )}
      {walletMessage && (
        <p className={`forge-wallet-status${walletMessageTone === "error" ? " forge-wallet-status--error" : ""}`} role="alert">
          {walletMessage}
        </p>
      )}

      <ReferralPanel />
    </div>
  );
}
