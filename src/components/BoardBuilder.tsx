/**
 * BoardBuilder.tsx
 *
 * Assembly-line board loadout builder powered by five stacked ConveyorCarousel
 * belts:  Decks (top) → Drivetrains → Motors → Wheels → Batteries (bottom).
 *
 * The live BoardPreviewGrid shows real product photos for each selected
 * component from per-category folders under src/assets/boards/ (discovered
 * at build time via Vite import.meta.glob).  Images are matched to the active
 * selection by filename keyword — e.g. `carbon-fiber.png` maps to the Street
 * deck because the filename contains "carbon", a known Street keyword.  Add
 * images to `src/assets/boards/<category>/` with a keyword in the name and
 * they will be picked up automatically on the next build.  A named PNG at
 * `public/assets/boards/<category>/<value>.png` serves as a final fallback.
 *
 * A PowerSwitchButton at the bottom triggers a satisfying animation sequence
 * before firing the onSave callback to commit the board config and loadout
 * stats to the character state.
 *
 * Compatibility rules are enforced: when the deck type changes, incompatible
 * selections are automatically snapped to the first allowed value, and
 * disallowed carousel items are marked as disabled.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { BoardConfig, BoardLoadout } from "../lib/boardBuilder";
import {
  BOARD_TYPE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  MOTOR_OPTIONS,
  WHEEL_OPTIONS,
  BATTERY_OPTIONS,
  DEFAULT_BOARD_CONFIG,
  calculateBoardStats,
  getBoardComponentImageUrls,
  enforceCompatibility,
  getAllowedComponents,
  validateBoardCompatibility,
} from "../lib/boardBuilder";
import { getMatchingCategoryImage } from "../lib/boardCategoryImages";
import { BoardPreviewGrid } from "./BoardPreviewGrid";
import { ConveyorCarousel } from "./ConveyorCarousel";
import { PowerSwitchButton } from "./PowerSwitchButton";
import type { CarouselItem } from "./ConveyorCarousel";

interface BoardBuilderProps {
  value: BoardConfig;
  onChange: (config: BoardConfig) => void;
  /** Called after the lock-in animation finishes (~1 s) to persist the board config and loadout. */
  onSave?: (config: BoardConfig, loadout: BoardLoadout) => void;
}

// Map each option array into the slim shape ConveyorCarousel expects.
const DECK_ITEMS: CarouselItem[] = BOARD_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  tagline: o.tagline,
}));

const DRIVETRAIN_ITEMS: CarouselItem[] = DRIVETRAIN_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  tagline: o.tagline,
}));

const MOTOR_ITEMS: CarouselItem[] = MOTOR_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  tagline: o.tagline,
}));

const WHEEL_ITEMS: CarouselItem[] = WHEEL_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  tagline: o.tagline,
}));

const BATTERY_ITEMS: CarouselItem[] = BATTERY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  icon: o.icon,
  tagline: o.tagline,
}));

export function BoardBuilder({ value, onChange, onSave }: BoardBuilderProps) {
  // Animation phase flags — toggled in sequence on lock-in
  const [surging, setSurging]   = useState(false);
  const [shaking, setShaking]   = useState(false);
  const [locked,  setLocked]    = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all pending timers on unmount to avoid setState on an unmounted component
  useEffect(() => () => { timerRefs.current.forEach(clearTimeout); }, []);

  // Derive allowed component sets and compatibility errors from the current deck type
  const allowed = useMemo(() => getAllowedComponents(value.boardType), [value.boardType]);
  const compatErrors = useMemo(() => validateBoardCompatibility(value), [value]);

  /**
   * Full lock-in animation sequence:
   *   t=0    – PowerSwitchButton depresses (handled inside the component)
   *   t=100  – BoardComposite neon drop-shadow surge
   *   t=400  – Builder container heavy screen-shake
   *   t=1000 – Animations clear; onSave callback fires
   */
  const handleAnimate = useCallback(() => {
    // Clear any leftover timers from a rapid double-click
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    setSurging(false);
    setShaking(false);

    timerRefs.current.push(
      setTimeout(() => setSurging(true),  100),
      setTimeout(() => setSurging(false), 650),
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

  /**
   * Builds the set of preview image URLs for the composition box.
   *
   * For each component slot we look for a PNG in `src/assets/boards/<category>/`
   * (discovered at build time via import.meta.glob) whose filename contains a
   * keyword matching the selected component value — e.g. `carbon-fiber.png`
   * for the Street deck, `5055-motor.png` for the Micro motor.  If no keyword
   * match is found inside the folder a random image from that folder is used as
   * a fallback, and if the folder is empty we fall back to the named static URL
   * `public/assets/boards/<category>/<value>.png`.
   */
  const buildPreviewUrls = useCallback((cfg: BoardConfig) => {
    const named = getBoardComponentImageUrls(cfg);
    return {
      deckUrl:       getMatchingCategoryImage("deck",       cfg.boardType)  ?? named.deckUrl,
      drivetrainUrl: getMatchingCategoryImage("drivetrain", cfg.drivetrain) ?? named.drivetrainUrl,
      motorUrl:      getMatchingCategoryImage("motor",      cfg.motor)      ?? named.motorUrl,
      wheelsUrl:     getMatchingCategoryImage("wheels",     cfg.wheels)     ?? named.wheelsUrl,
      batteryUrl:    getMatchingCategoryImage("battery",    cfg.battery)    ?? named.batteryUrl,
    };
  }, []);

  const [previewUrls, setPreviewUrls] = useState(() => buildPreviewUrls(value));

  // Re-pick a random image whenever a carousel selection changes.
  // Destructure so each slot's primitive value is the dep, not the object reference.
  const { boardType, drivetrain, motor, wheels, battery } = value;
  useEffect(() => {
    setPreviewUrls(buildPreviewUrls({ boardType, drivetrain, motor, wheels, battery }));
  }, [boardType, drivetrain, motor, wheels, battery, buildPreviewUrls]);

  const previewLabels = {
    deck:       BOARD_TYPE_OPTIONS.find((o) => o.value === value.boardType)?.label ?? value.boardType,
    drivetrain: DRIVETRAIN_OPTIONS.find((o) => o.value === value.drivetrain)?.label ?? value.drivetrain,
    motor:      MOTOR_OPTIONS.find((o) => o.value === value.motor)?.label ?? value.motor,
    wheels:     WHEEL_OPTIONS.find((o) => o.value === value.wheels)?.label ?? value.wheels,
    battery:    BATTERY_OPTIONS.find((o) => o.value === value.battery)?.label ?? value.battery,
  };

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
      {/* Live board component preview — updates in real time */}
      <BoardPreviewGrid
        urls={previewUrls}
        labels={previewLabels}
        className={`board-builder__preview${surging ? " board-preview-grid--surge" : ""}`}
      />

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

      {/* Belt 4 — Wheels (determines District access) */}
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
