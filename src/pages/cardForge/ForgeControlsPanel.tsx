import { useMemo, useState } from "react";
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
import ozziesConfig from "../../lib/ozziesConfig.json";
import type { BoardConfig } from "../../lib/boardBuilder";
import { FORGE_CLASS_ODDS } from "../../lib/cardClassProgression";
import { formatDurationClock, getRemainingDurationMs } from "../../lib/dailyRewards";
import { FORGE_ARCHETYPE_OPTIONS, getForgeArchetypeLabel } from "../../lib/factionDiscovery";
import { sfxClick } from "../../lib/sfx";
import tabletopForgeBackdrop from "../../../tabletopforge.png";

type ForgeWizardStepId = "identity" | "appearance" | "board-build" | "final-polish" | "review";

const FORGE_WIZARD_STEPS: Array<{
  id: ForgeWizardStepId;
  shortLabel: string;
  title: string;
  description: string;
}> = [
  {
    id: "identity",
    shortLabel: "Identity",
    title: "Set your identity",
    description: "Lock in the courier cover story and district vibe first.",
  },
  {
    id: "appearance",
    shortLabel: "Appearance",
    title: "Shape the look",
    description: "Dial in the body details and color palette for the card.",
  },
  {
    id: "board-build",
    shortLabel: "Board Build",
    title: "Build the skateboard",
    description: "Tune the ride so the card’s gear matches the mission fantasy.",
  },
  {
    id: "final-polish",
    shortLabel: "Final Polish",
    title: "Add the finishing touches",
    description: "Choose optional gear before you head to the final review.",
  },
  {
    id: "review",
    shortLabel: "Review",
    title: "Review the full build",
    description: "Check the summary, jump back to any step, then forge when ready.",
  },
];

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
      type="button"
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
  const [activeStepId, setActiveStepId] = useState<ForgeWizardStepId>("identity");
  const isFreeTier = tier === "free";
  const freeForgeRemainingMs = getRemainingDurationMs(freeForgeReadyAt);
  const isFreeForgeCoolingDown = isFreeTier && !requiresOzzies && freeForgeRemainingMs > 0 && generateCredits === 0;
  const activeStepIndex = FORGE_WIZARD_STEPS.findIndex((step) => step.id === activeStepId);
  const activeStep = FORGE_WIZARD_STEPS[activeStepIndex] ?? FORGE_WIZARD_STEPS[0];
  const selectedWeaponName = selectedWeaponUrl
    ? weaponAssets?.find((weapon) => weapon.url === selectedWeaponUrl)?.name ?? "Unknown weapon"
    : "None equipped";
  const reviewItems = useMemo(
    () => [
      {
        stepId: "identity" as const,
        label: "Cover setup",
        value: `${getForgeArchetypeLabel(prompts.archetype)} • ${prompts.district}`,
      },
      {
        stepId: "appearance" as const,
        label: "Body profile",
        value: `${prompts.gender} • ${prompts.ageGroup} • ${prompts.bodyType}`,
      },
      {
        stepId: "appearance" as const,
        label: "Visual style",
        value: `${prompts.hairLength} hair • ${prompts.skinTone} • ${prompts.faceCharacter}`,
      },
      {
        stepId: "appearance" as const,
        label: "Accent color",
        value: prompts.accentColor,
      },
      {
        stepId: "board-build" as const,
        label: "Skateboard build",
        value: `${boardConfig.boardType} • ${boardConfig.drivetrain} • ${boardConfig.motor}`,
      },
      {
        stepId: "board-build" as const,
        label: "Ride tuning",
        value: `${boardConfig.driveOrientation} • ${boardConfig.wheels} wheels • ${boardConfig.battery} battery`,
      },
      {
        stepId: "final-polish" as const,
        label: "Weapon",
        value: selectedWeaponName,
      },
    ],
    [boardConfig, prompts, selectedWeaponName],
  );

  const goToStep = (stepId: ForgeWizardStepId) => {
    sfxClick();
    setActiveStepId(stepId);
  };

  const goToRelativeStep = (delta: -1 | 1) => {
    sfxClick();
    const nextStep = FORGE_WIZARD_STEPS[activeStepIndex + delta];
    if (!nextStep) return;
    setActiveStepId(nextStep.id);
  };

  return (
    <div className="forge-form forge-form--wizard">
      <div className="forge-wizard__header">
        <div className="forge-wizard__eyebrow-row">
          <p className="forge-wizard__eyebrow">Forge Wizard</p>
          <p className="forge-wizard__step-count">
            Step {activeStepIndex + 1} of {FORGE_WIZARD_STEPS.length}
          </p>
        </div>
        <div className="forge-wizard__progress" role="tablist" aria-label="Card Forge steps">
          {FORGE_WIZARD_STEPS.map((step, index) => {
            const isActive = step.id === activeStepId;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`forge-wizard__tab${isActive ? " forge-wizard__tab--active" : ""}`}
                onClick={() => goToStep(step.id)}
              >
                <span className="forge-wizard__tab-index">{index + 1}</span>
                <span className="forge-wizard__tab-label">{step.shortLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="forge-wizard__intro">
          <h2 className="forge-wizard__title">{activeStep.title}</h2>
          <p className="forge-wizard__description">{activeStep.description}</p>
        </div>
      </div>

      <div className="forge-wizard__body">
        {activeStepId === "identity" && (
          <>
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
          </>
        )}

        {activeStepId === "appearance" && (
          <>
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
                    type="button"
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
          </>
        )}

        {activeStepId === "board-build" && (
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
        )}

        {activeStepId === "final-polish" && (
          <>
            {weaponAssets && weaponAssets.length > 0 && onWeaponSelect ? (
              <div className="form-group">
                <label>Weapon</label>
                <p className="form-hint" style={{ marginBottom: 6 }}>
                  {weaponsUnlocked
                    ? "Equip a weapon to your card — drag it into position on the preview."
                    : `Weapons unlock at ${weaponUnlockXp.toLocaleString()} XP. Until then, they appear locked.`}
                </p>
                <div className="forge-weapon-picker">
                  <button
                    type="button"
                    className={`forge-weapon-none-option${!selectedWeaponUrl ? " selected" : ""}`}
                    onClick={() => onWeaponSelect(undefined)}
                    aria-pressed={!selectedWeaponUrl}
                  >
                    None
                  </button>
                  <div className="forge-tabletop-backdrop forge-tabletop-backdrop--weapons">
                    <img src={tabletopForgeBackdrop} alt="Tabletop forge backdrop" className="forge-tabletop-backdrop__img" />
                    <div className="forge-tabletop-weapons" aria-label="Weapon choices">
                      {weaponAssets.map((weapon, index) => (
                        <button
                          key={weapon.url}
                          type="button"
                          className={`forge-weapon-option forge-weapon-table-item forge-weapon-table-item--${index}${selectedWeaponUrl === weapon.url ? " selected" : ""}${!weaponsUnlocked ? " forge-weapon-option--locked" : ""}`}
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
                </div>
              </div>
            ) : (
              <div className="forge-wizard__empty-step">
                <strong>Final checks complete.</strong>
                <p className="form-hint">No extra gear options are available for this build, so you can jump straight to review.</p>
              </div>
            )}
          </>
        )}

        {activeStepId === "review" && (
          <>
            <div className="forge-review-grid">
              {reviewItems.map((item) => (
                <button
                  key={`${item.stepId}-${item.label}`}
                  type="button"
                  className="forge-review-card"
                  onClick={() => goToStep(item.stepId)}
                >
                  <span className="forge-review-card__label">{item.label}</span>
                  <strong className="forge-review-card__value">{item.value}</strong>
                  <span className="forge-review-card__cta">Edit step</span>
                </button>
              ))}
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

          </>
        )}
      </div>

      <div className="forge-wizard__footer">
        <button
          type="button"
          className="btn-outline"
          onClick={() => goToRelativeStep(-1)}
          disabled={activeStepIndex === 0}
        >
          ← Back
        </button>
        {activeStepId === "review" ? (
          <p className="forge-wizard__footer-note">Tap any review card to jump back into that step instantly.</p>
        ) : (
          <button type="button" className="btn-primary" onClick={() => goToRelativeStep(1)}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
