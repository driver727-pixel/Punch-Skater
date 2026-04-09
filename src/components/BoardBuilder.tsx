/**
 * BoardBuilder.tsx
 *
 * Assembly-line board loadout builder powered by three stacked ConveyorCarousel
 * belts:  Decks (top) → Drivetrains (middle) → Wheels (bottom).
 *
 * The live BoardComposite preview updates instantly as the user scrolls each belt.
 */
import type { BoardConfig } from "../lib/boardBuilder";
import {
  BOARD_TYPE_OPTIONS,
  DRIVETRAIN_OPTIONS,
  WHEEL_OPTIONS,
  DEFAULT_BOARD_CONFIG,
  getBoardAssetUrls,
} from "../lib/boardBuilder";
import { BoardComposite } from "./BoardComposite";
import { ConveyorCarousel } from "./ConveyorCarousel";
import type { CarouselItem } from "./ConveyorCarousel";

interface BoardBuilderProps {
  value: BoardConfig;
  onChange: (config: BoardConfig) => void;
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

export function BoardBuilder({ value, onChange }: BoardBuilderProps) {
  return (
    <div className="board-builder">
      {/* Live board composite preview — updates in real time */}
      <BoardComposite
        {...getBoardAssetUrls(value)}
        className="board-builder__preview"
      />

      {/* Belt 1 — Decks */}
      <ConveyorCarousel
        label="Decks"
        items={DECK_ITEMS}
        selected={value.boardType}
        onSelect={(v) => onChange({ ...value, boardType: v as typeof value.boardType })}
      />

      {/* Belt 2 — Drivetrains */}
      <ConveyorCarousel
        label="Drivetrains"
        items={DRIVETRAIN_ITEMS}
        selected={value.drivetrain}
        onSelect={(v) => onChange({ ...value, drivetrain: v as typeof value.drivetrain })}
      />

      {/* Belt 3 — Wheels */}
      <ConveyorCarousel
        label="Wheels"
        items={WHEEL_ITEMS}
        selected={value.wheels}
        onSelect={(v) => onChange({ ...value, wheels: v as typeof value.wheels })}
      />
    </div>
  );
}

export { DEFAULT_BOARD_CONFIG };
