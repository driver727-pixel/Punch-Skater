/**
 * BoardBuilder.tsx
 *
 * A 3-step selection wizard for building an electric-skateboard loadout.
 * Step 1 → Board Type, Step 2 → Drivetrain, Step 3 → Wheels
 *
 * Designed as an inline section inside the Card Forge form, with a
 * step-by-step reveal similar to the Faction overlay animations.
 */
import { useState } from "react";
import type {
  BoardConfig,
  BoardType,
  Drivetrain,
  WheelType,
} from "../lib/boardBuilder";
import {
  BOARD_TYPE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  WHEEL_OPTIONS,
  DEFAULT_BOARD_CONFIG,
} from "../lib/boardBuilder";

interface BoardBuilderProps {
  value: BoardConfig;
  onChange: (config: BoardConfig) => void;
}

const STEPS = ["Board Type", "Drivetrain", "Wheels"] as const;

export function BoardBuilder({ value, onChange }: BoardBuilderProps) {
  const [activeStep, setActiveStep] = useState<0 | 1 | 2>(0);

  function selectBoardType(boardType: BoardType) {
    onChange({ ...value, boardType });
    setActiveStep(1);
  }

  function selectDrivetrain(drivetrain: Drivetrain) {
    onChange({ ...value, drivetrain });
    setActiveStep(2);
  }

  function selectWheels(wheels: WheelType) {
    onChange({ ...value, wheels });
    // Stay on step 2 — user can revisit any step
  }

  return (
    <div className="board-builder">
      {/* Step progress tabs */}
      <div className="board-builder__steps">
        {STEPS.map((label, idx) => (
          <button
            key={label}
            className={`board-builder__step-tab${activeStep === idx ? " board-builder__step-tab--active" : ""}`}
            onClick={() => setActiveStep(idx as 0 | 1 | 2)}
            type="button"
          >
            <span className="board-builder__step-num">{idx + 1}</span>
            <span className="board-builder__step-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Step 0 — Board Type */}
      {activeStep === 0 && (
        <div className="board-builder__panel">
          <p className="board-builder__intro">Choose the style of deck that defines your riding profile.</p>
          <div className="board-options">
            {BOARD_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`board-option${value.boardType === opt.value ? " board-option--selected" : ""}`}
                onClick={() => selectBoardType(opt.value)}
              >
                <span className="board-option__icon">{opt.icon}</span>
                <span className="board-option__name">{opt.label}</span>
                <span className="board-option__tagline">{opt.tagline}</span>
                <p className="board-option__desc">{opt.description}</p>
                <StatBonusList bonuses={opt.statBonuses} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1 — Drivetrain */}
      {activeStep === 1 && (
        <div className="board-builder__panel">
          <p className="board-builder__intro">Select the power-delivery system that drives your board.</p>
          <div className="board-options">
            {DRIVETRAIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`board-option${value.drivetrain === opt.value ? " board-option--selected" : ""}`}
                onClick={() => selectDrivetrain(opt.value)}
              >
                <span className="board-option__icon">{opt.icon}</span>
                <span className="board-option__name">{opt.label}</span>
                <span className="board-option__tagline">{opt.tagline}</span>
                <p className="board-option__desc">{opt.description}</p>
                <StatBonusList bonuses={opt.statBonuses} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Wheels */}
      {activeStep === 2 && (
        <div className="board-builder__panel">
          <p className="board-builder__intro">Pick the contact surface that determines how you grip the world.</p>
          <div className="board-options">
            {WHEEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`board-option${value.wheels === opt.value ? " board-option--selected" : ""}`}
                onClick={() => selectWheels(opt.value)}
              >
                <span className="board-option__icon">{opt.icon}</span>
                <span className="board-option__name">{opt.label}</span>
                <span className="board-option__tagline">{opt.tagline}</span>
                <p className="board-option__desc">{opt.description}</p>
                <StatBonusList bonuses={opt.statBonuses} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected config summary */}
      <BoardSummaryRow config={value} onEdit={setActiveStep} />
    </div>
  );
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function StatBonusList({
  bonuses,
}: {
  bonuses: Partial<Record<string, number>>;
}) {
  const entries = Object.entries(bonuses).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return (
    <ul className="board-option__bonuses">
      {entries.map(([stat, bonus]) => (
        <li key={stat} className="board-option__bonus">
          +{bonus} {stat.toUpperCase()}
        </li>
      ))}
    </ul>
  );
}

function BoardSummaryRow({
  config,
  onEdit,
}: {
  config: BoardConfig;
  onEdit: (step: 0 | 1 | 2) => void;
}) {
  const type = BOARD_TYPE_OPTIONS.find((o) => o.value === config.boardType);
  const drive = DRIVETRAIN_OPTIONS.find((o) => o.value === config.drivetrain);
  const wheel = WHEEL_OPTIONS.find((o) => o.value === config.wheels);

  return (
    <div className="board-summary">
      <span className="board-summary__label">LOADOUT</span>
      <div className="board-summary__chips">
        <button
          type="button"
          className="board-summary__chip"
          onClick={() => onEdit(0)}
          title="Change board type"
        >
          {type?.icon ?? "🛹"} {config.boardType}
        </button>
        <span className="board-summary__sep">·</span>
        <button
          type="button"
          className="board-summary__chip"
          onClick={() => onEdit(1)}
          title="Change drivetrain"
        >
          {drive?.icon ?? "⚙️"} {drive?.label ?? config.drivetrain}
        </button>
        <span className="board-summary__sep">·</span>
        <button
          type="button"
          className="board-summary__chip"
          onClick={() => onEdit(2)}
          title="Change wheels"
        >
          {wheel?.icon ?? "⚫"} {config.wheels}
        </button>
      </div>
    </div>
  );
}

export { DEFAULT_BOARD_CONFIG };
