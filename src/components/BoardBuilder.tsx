/**
 * BoardBuilder.tsx
 *
 * Assembly-line board loadout builder powered by five stacked ConveyorCarousel
 * belts:  Decks (top) → Drivetrains → Motors → Wheels → Batteries (bottom).
 *
 * Each conveyor belt item displays the real product PNG directly on the button,
 * replacing the old emoji icon and the separate composite preview grid.
 *
 * A PowerSwitchButton at the bottom triggers a satisfying animation sequence
 * before firing the onSave callback to commit the board config and loadout
 * stats to the character state.
 *
 * Compatibility rules are enforced: when the deck type changes, incompatible
 * selections are automatically snapped to the first allowed value, and
 * disallowed carousel items are marked as disabled.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type { BoardConfig, BoardLoadout } from "../lib/boardBuilder";
import {
  BOARD_TYPE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  MOTOR_OPTIONS,
  WHEEL_OPTIONS,
  BATTERY_OPTIONS,
  DEFAULT_BOARD_CONFIG,
  calculateBoardStats,
  enforceCompatibility,
  getAllowedComponents,
  validateBoardCompatibility,
} from "../lib/boardBuilder";
import { ConveyorCarousel } from "./ConveyorCarousel";
import { PowerSwitchButton } from "./PowerSwitchButton";
import type { CarouselItem } from "./ConveyorCarousel";

// ── Board part PNG imports ─────────────────────────────────────────────────────
// Deck
import imgStreetCarbon    from "../assets/boards/deck/street-carbon.png";
import imgAtBamboo        from "../assets/boards/deck/at-bamboo.png";
import imgMtBoard         from "../assets/boards/deck/mt-board.png";
import imgSurfSkate       from "../assets/boards/deck/surf-skate.png";
// Drivetrain
import imgBeltDrive       from "../assets/boards/drivetrain/drivetrain-dual-belt-drive.png";
import imgHubDrive        from "../assets/boards/drivetrain/hub-drive.png";
import imgGearDrive       from "../assets/boards/drivetrain/gear-drive.png";
import img4wdDrive        from "../assets/boards/drivetrain/4wd-drive.png";
// Motor
import imgMotor5055       from "../assets/boards/motor/5055-motor.png";
import imgMotor6354       from "../assets/boards/motor/6354-motor.png";
import imgMotor6374       from "../assets/boards/motor/6374-motor.png";
import imgMotor6396       from "../assets/boards/motor/6396-motor.png";
// Wheels
import imgPolyWheels      from "../assets/boards/wheels/poly-wheels.png";
import imgPneumaticWheels from "../assets/boards/wheels/pneumatic-wheels.png";
import imgSolidRubber     from "../assets/boards/wheels/solid-rubber.png";
import imgCloudWheels     from "../assets/boards/wheels/cloud-wheels.png";
// Battery
import imgSlimStealth     from "../assets/boards/battery/battery-slim-stealth-pack.png";
import imgDoubleStack     from "../assets/boards/battery/double-battery.png";
import imgTopMountPeli    from "../assets/boards/battery/top-mount-battery.png";

interface BoardBuilderProps {
  value: BoardConfig;
  onChange: (config: BoardConfig) => void;
  /** Called after the lock-in animation finishes (~1 s) to persist the board config and loadout. */
  onSave?: (config: BoardConfig, loadout: BoardLoadout) => void;
  /** Accent background color used in the live board preview. */
  accentColor?: string;
}

// Map each option array into the slim shape ConveyorCarousel expects.
const DECK_IMAGES: Record<string, string> = {
  Street:   imgStreetCarbon,
  AT:       imgAtBamboo,
  Mountain: imgMtBoard,
  Surf:     imgSurfSkate,
};

const DRIVETRAIN_IMAGES: Record<string, string> = {
  Belt: imgBeltDrive,
  Hub:  imgHubDrive,
  Gear: imgGearDrive,
  "4WD": img4wdDrive,
};

const MOTOR_IMAGES: Record<string, string> = {
  Micro:     imgMotor5055,
  Standard:  imgMotor6354,
  Torque:    imgMotor6374,
  Outrunner: imgMotor6396,
};

const WHEEL_IMAGES: Record<string, string> = {
  Urethane:  imgPolyWheels,
  Pneumatic: imgPneumaticWheels,
  Rubber:    imgSolidRubber,
  Cloud:     imgCloudWheels,
};

const BATTERY_IMAGES: Record<string, string> = {
  SlimStealth: imgSlimStealth,
  DoubleStack: imgDoubleStack,
  TopPeli:     imgTopMountPeli,
};

const DECK_ITEMS: CarouselItem[] = BOARD_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  imageSrc: DECK_IMAGES[o.value],
  tagline: o.tagline,
}));

const DRIVETRAIN_ITEMS: CarouselItem[] = DRIVETRAIN_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  imageSrc: DRIVETRAIN_IMAGES[o.value],
  tagline: o.tagline,
}));

const MOTOR_ITEMS: CarouselItem[] = MOTOR_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  imageSrc: MOTOR_IMAGES[o.value],
  tagline: o.tagline,
}));

const WHEEL_ITEMS: CarouselItem[] = WHEEL_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  imageSrc: WHEEL_IMAGES[o.value],
  tagline: o.tagline,
}));

const BATTERY_ITEMS: CarouselItem[] = BATTERY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  imageSrc: BATTERY_IMAGES[o.value],
  tagline: o.tagline,
}))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BoardBuilder({ value, onChange, onSave, accentColor: _accentColor }: BoardBuilderProps) {
  // Animation phase flags — toggled in sequence on lock-in
  const [shaking, setShaking]   = useState(false);
  const [locked,  setLocked]    = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all pending timers on unmount to avoid setState on an unmounted component
  useEffect(() => () => { timerRefs.current.forEach(clearTimeout); }, []);

  // Derive allowed component sets and compatibility errors from the current deck type
  const allowed      = getAllowedComponents(value.boardType);
  const compatErrors = validateBoardCompatibility(value);

  /**
   * Full lock-in animation sequence:
   *   t=0    – PowerSwitchButton depresses (handled inside the component)
   *   t=100  – Builder neon drop-shadow surge
   *   t=400  – Builder container heavy screen-shake
   *   t=1000 – Animations clear; onSave callback fires
   */
  const handleAnimate = useCallback(() => {
    // Clear any leftover timers from a rapid double-click
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    setShaking(false);

    timerRefs.current.push(
      setTimeout(() => setShaking(true),  400),
      setTimeout(() => setShaking(false), 750),
      setTimeout(() => {
        setLocked(true);
        onSave?.(value, calculateBoardStats(value));
      }, 1000),
    );
  }, [value, onSave]);

  /** Reset the locked flag, enforce compatibility, and propagate a carousel selection change. */
  const handleCarouselChange = useCallback((next: BoardConfig) => {
    setLocked(false);
    onChange(enforceCompatibility(next));
  }, [onChange]);

  // Mark disallowed carousel items so the UI can render them as disabled
  const drivetrainSet = new Set(allowed.drivetrains);
  const motorSet      = new Set(allowed.motors);
  const wheelSet      = new Set(allowed.wheels);
  const batterySet    = new Set(allowed.batteries);

  const filteredDrivetrainItems = DRIVETRAIN_ITEMS.map((i) => ({ ...i, disabled: !drivetrainSet.has(i.value as typeof value.drivetrain) }));
  const filteredMotorItems      = MOTOR_ITEMS.map((i) => ({ ...i, disabled: !motorSet.has(i.value as typeof value.motor) }));
  const filteredWheelItems      = WHEEL_ITEMS.map((i) => ({ ...i, disabled: !wheelSet.has(i.value as typeof value.wheels) }));
  const filteredBatteryItems    = BATTERY_ITEMS.map((i) => ({ ...i, disabled: !batterySet.has(i.value as typeof value.battery) }));

  return (
    <div className={`board-builder${shaking ? " board-builder--shake" : ""}`}>
      {/* Belt 1 — Decks */}
      <ConveyorCarousel
        label="Decks"
        items={DECK_ITEMS}
        selected={value.boardType}
        onSelect={(v) => handleCarouselChange({ ...value, boardType: v as typeof value.boardType })}
      />

      {/* Belt 2 — Drivetrains (determines Top Speed) */}
      <ConveyorCarousel
        label="Drivetrains"
        items={filteredDrivetrainItems}
        selected={value.drivetrain}
        onSelect={(v) => handleCarouselChange({ ...value, drivetrain: v as typeof value.drivetrain })}
      />

      {/* Belt 3 — Motors (determines Acceleration) */}
      <ConveyorCarousel
        label="Motors"
        items={filteredMotorItems}
        selected={value.motor}
        onSelect={(v) => handleCarouselChange({ ...value, motor: v as typeof value.motor })}
      />

      {/* Belt 4 — Wheels (determines access profile) */}
      <ConveyorCarousel
        label="Wheels"
        items={filteredWheelItems}
        selected={value.wheels}
        onSelect={(v) => handleCarouselChange({ ...value, wheels: v as typeof value.wheels })}
      />

      {/* Belt 5 — Batteries (determines Range) */}
      <ConveyorCarousel
        label="Batteries"
        items={filteredBatteryItems}
        selected={value.battery}
        onSelect={(v) => handleCarouselChange({ ...value, battery: v as typeof value.battery })}
      />

      {/* Compatibility warnings */}
      {compatErrors.length > 0 && (
        <div className="board-builder__compat-errors" role="alert">
          {compatErrors.map((err, i) => (
            <p key={i} className="board-builder__compat-error">⚠️ {err.message}</p>
          ))}
        </div>
      )}

      {/* Finalization — PowerSwitchButton */}
      <div className="board-builder__lock-row">
        <PowerSwitchButton onAnimate={handleAnimate} disabled={locked || compatErrors.length > 0} />
        {locked && (
          <span className="board-builder__locked-badge" aria-live="polite">
            ✔ LOCKED IN
          </span>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_BOARD_CONFIG };
