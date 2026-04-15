/**
 * ConveyorCarousel.tsx
 *
 * An industrial assembly-line carousel for selecting skateboard components.
 *
 * - Horizontally scrollable with scroll-snap-type: x mandatory (items snap to center).
 * - Belt background uses a repeating CSS gradient animated to simulate a running belt.
 * - Items are square "parts" with a rugged industrial border.
 * - The item snapped to the center viewport receives a "selected" state:
 *     scale 1.1× + neon glow + CSS ::before/::after pseudo-element clamps.
 */

import { useEffect, useRef, useCallback } from "react";

const SCROLL_SYNC_DEBOUNCE_MS = 120;

export interface CarouselItem {
  value: string;
  label: string;
  icon: string;
  tagline: string;
  /** When true the item is visually dimmed and cannot be selected. */
  disabled?: boolean;
}

interface ConveyorCarouselProps {
  /** Belt heading shown above the track (e.g. "DECKS"). */
  label: string;
  /** List of selectable items. */
  items: CarouselItem[];
  /** Currently selected item value. */
  selected: string;
  /** Called when the user snaps a new item to center. */
  onSelect: (value: string) => void;
}

export function ConveyorCarousel({
  label,
  items,
  selected,
  onSelect,
}: ConveyorCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Track which item is visually centered (may differ from `selected` mid-scroll).
  const selectionFrameRef = useRef<number | null>(null);
  const initialSyncDoneRef = useRef(false);
  const syncingScrollRef = useRef(false);
  const scrollSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseScrollSync = useCallback(() => {
    if (scrollSyncTimeoutRef.current !== null) clearTimeout(scrollSyncTimeoutRef.current);
    scrollSyncTimeoutRef.current = setTimeout(() => {
      syncingScrollRef.current = false;
      scrollSyncTimeoutRef.current = null;
    }, SCROLL_SYNC_DEBOUNCE_MS);
  }, []);

  /** Derive which item index is closest to the center of the scroll container. */
  const getCenteredIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return -1;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    // Children layout: [spacer, item0, item1, ..., itemN, spacer]
    // Skip index 0 (leading spacer) and last index (trailing spacer).
    const children = Array.from(track.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    for (let i = 1; i < children.length - 1; i++) {
      const child = children[i];
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(trackCenter - childCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = i - 1; // offset by 1 to map back to items array
      }
    }
    return best;
  }, []);

  /** When the container scrolls, debounce and fire onSelect for the centered item. */
  const handleScroll = useCallback(() => {
    if (syncingScrollRef.current) {
      releaseScrollSync();
      return;
    }

    if (selectionFrameRef.current !== null) cancelAnimationFrame(selectionFrameRef.current);
    selectionFrameRef.current = requestAnimationFrame(() => {
      selectionFrameRef.current = null;
      const idx = getCenteredIndex();
      if (idx >= 0 && idx < items.length) {
        const centeredItem = items[idx];
        if (!centeredItem.disabled && centeredItem.value !== selected) {
          onSelect(centeredItem.value);
        }
      }
    });
  }, [getCenteredIndex, items, onSelect, releaseScrollSync, selected]);

  /** Scroll a specific item into the snap position (center). */
  const scrollToIndex = useCallback((idx: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    if (!track) return;
    // Children layout: [spacer, item0, item1, ..., itemN, spacer]
    // Item at items[idx] lives at DOM child index idx + 1.
    const child = track.children[idx + 1] as HTMLElement | undefined;
    if (!child) return;
    const targetScrollLeft =
      child.offsetLeft - track.clientWidth / 2 + child.offsetWidth / 2;
    if (Math.abs(track.scrollLeft - targetScrollLeft) < 1) return;
    syncingScrollRef.current = true;
    releaseScrollSync();
    track.scrollTo({ left: targetScrollLeft, behavior });
  }, [releaseScrollSync]);

  /** On mount / whenever `selected` changes externally, scroll to match. */
  useEffect(() => {
    const idx = items.findIndex((it) => it.value === selected);
    if (idx >= 0) {
      scrollToIndex(idx, initialSyncDoneRef.current ? "smooth" : "auto");
      initialSyncDoneRef.current = true;
    }
  }, [selected, items, scrollToIndex]);

  useEffect(() => () => {
    if (selectionFrameRef.current !== null) cancelAnimationFrame(selectionFrameRef.current);
    if (scrollSyncTimeoutRef.current !== null) clearTimeout(scrollSyncTimeoutRef.current);
  }, []);

  return (
    <div className="conveyor">
      {/* Belt label */}
      <div className="conveyor__header">
        <span className="conveyor__label">{label}</span>
        <span className="conveyor__selected-name">
          {items.find((it) => it.value === selected)?.label ?? ""}
        </span>
      </div>

      {/* Animated belt track */}
      <div
        className="conveyor__track"
        ref={trackRef}
        onScroll={handleScroll}
      >
        {/* Spacer so the first/last item can be snapped to the center */}
        <div className="conveyor__edge-spacer" aria-hidden="true" />

        {items.map((item) => {
          const isSelected = item.value === selected;
          const isDisabled = !!item.disabled;
          return (
            <button
              key={item.value}
              type="button"
              className={`conveyor__item${isSelected ? " conveyor__item--selected" : ""}${isDisabled ? " conveyor__item--disabled" : ""}`}
              onClick={() => {
                if (isDisabled) return;
                const idx = items.findIndex((it) => it.value === item.value);
                scrollToIndex(idx);
                onSelect(item.value);
              }}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
            >
              <span className="conveyor__item-icon">{item.icon}</span>
              <span className="conveyor__item-name">{item.label}</span>
              <span className="conveyor__item-tagline">{item.tagline}</span>
            </button>
          );
        })}

        <div className="conveyor__edge-spacer" aria-hidden="true" />
      </div>
    </div>
  );
}
