/**
 * BoardBuilder.tsx
 *
 * Assembly-line board loadout builder powered by four stacked ConveyorCarousel
 * belts:  Decks (top) → Drivetrains → Wheels → Batteries (bottom).
 *
 * The live BoardComposite preview updates instantly as the user scrolls each belt.
 * A PowerSwitchButton at the bottom triggers a satisfying animation sequence before
 * firing the onSave callback to commit the board config and loadout stats to the
 * character state.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type { BoardConfig, BoardLoadout } from "../lib/boardBuilder";
import {
  BOARD_TYPE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  WHEEL_OPTIONS,
  BATTERY_OPTIONS,
  DEFAULT_BOARD_CONFIG,
  getBoardAssetUrls,
  calculateBoardStats,
} from "../lib/boardBuilder";
import { BoardComposite } from "./BoardComposite";
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

  /** Reset the locked flag and propagate a carousel selection change. */
  const handleCarouselChange = useCallback((next: BoardConfig) => {
    setLocked(false);
    onChange(next);
  }, [onChange]);

  const assetUrls = getBoardAssetUrls(value);

  return (
    <div className={`board-builder${shaking ? " board-builder--shake" : ""}`}>
      {/* Live board composite preview — updates in real time */}
      <BoardComposite
        {...assetUrls}
        className={`board-builder__preview${surging ? " board-composite--surge" : ""}`}
      />

      {/* Belt 1 — Decks */}
      <ConveyorCarousel
        label="Decks"
        items={DECK_ITEMS}
        selected={value.boardType}
        onSelect={(v) => handleCarouselChange({ ...value, boardType: v as typeof value.boardType })}
      />

      {/* Belt 2 — Drivetrains */}
      <ConveyorCarousel
        label="Drivetrains"
        items={DRIVETRAIN_ITEMS}
        selected={value.drivetrain}
        onSelect={(v) => handleCarouselChange({ ...value, drivetrain: v as typeof value.drivetrain })}
      />

      {/* Belt 3 — Wheels */}
      <ConveyorCarousel
        label="Wheels"
        items={WHEEL_ITEMS}
        selected={value.wheels}
        onSelect={(v) => handleCarouselChange({ ...value, wheels: v as typeof value.wheels })}
      />

      {/* Belt 4 — Batteries */}
      <ConveyorCarousel
        label="Batteries"
        items={BATTERY_ITEMS}
        selected={value.battery}
        onSelect={(v) => handleCarouselChange({ ...value, battery: v as typeof value.battery })}
      />

      {/* Finalization — PowerSwitchButton */}
      <div className="board-builder__lock-row">
        <PowerSwitchButton onAnimate={handleAnimate} disabled={locked} />
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
