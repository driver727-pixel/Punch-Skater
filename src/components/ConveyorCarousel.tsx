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

import { useEffect, useRef, useCallback, useMemo, useState } from "react";

const SCROLL_SYNC_DEBOUNCE_MS = 120;
const MATTE_BRIGHTNESS_THRESHOLD = 218;
const MATTE_VARIANCE_THRESHOLD = 42;
const MATTE_FADE_RANGE = 37;
const conveyorImageCache = new Map<string, Promise<string>>();

function getPixelBrightness(data: Uint8ClampedArray, offset: number) {
  return (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
}

function isMatteBackgroundPixel(data: Uint8ClampedArray, offset: number) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = getPixelBrightness(data, offset);
  // Treat only bright, low-variance edge pixels as matte so the flood fill
  // removes the white studio backdrop without cutting into the product art.
  return a > 0
    && brightness >= MATTE_BRIGHTNESS_THRESHOLD
    && max - min <= MATTE_VARIANCE_THRESHOLD;
}

/**
 * Converts edge-connected white matte pixels in imported PNGs into transparency.
 *
 * The processed data URL is cached by source path so repeated renders across the
 * stacked conveyors reuse the same cleaned image instead of re-running canvas
 * work for every button.
 */
function stripImageMatte(src: string) {
  let pending = conveyorImageCache.get(src);
  if (pending) return pending;

  pending = new Promise<string>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(src);
        return;
      }

      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      const visited = new Uint8Array(width * height);
      const queue: number[] = [];
      let head = 0;

      const enqueue = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (visited[index]) return;
        const offset = index * 4;
        if (!isMatteBackgroundPixel(data, offset)) return;
        visited[index] = 1;
        queue.push(index);
      };

      for (let x = 0; x < width; x++) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }
      for (let y = 1; y < height - 1; y++) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }

      while (head < queue.length) {
        const index = queue[head++];
        const x = index % width;
        const y = Math.floor(index / width);
        const offset = index * 4;
        const brightness = getPixelBrightness(data, offset);
        // MATTE_FADE_RANGE softens anti-aliased edge pixels immediately above the
        // matte threshold instead of snapping the whole connected background to 0 alpha.
        const matteStrength = Math.max(
          0,
          Math.min(1, (brightness - MATTE_BRIGHTNESS_THRESHOLD) / MATTE_FADE_RANGE),
        );
        data[offset + 3] = Math.round(data[offset + 3] * (1 - matteStrength));

        enqueue(x - 1, y);
        enqueue(x + 1, y);
        enqueue(x, y - 1);
        enqueue(x, y + 1);
      }

      context.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });

  conveyorImageCache.set(src, pending);
  return pending;
}

export interface CarouselItem {
  value: string;
  label: string;
  icon: string;
  /** Optional PNG image that replaces the emoji icon on the button. */
  imageSrc?: string;
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
  const [transparentImages, setTransparentImages] = useState<Record<string, string>>({});
  const imageSources = useMemo(
    () => [...new Set(items.map((item) => item.imageSrc).filter((src): src is string => !!src))],
    [items],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      imageSources.map(async (src) => [src, await stripImageMatte(src)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setTransparentImages((current) => {
        const next = { ...current };
        let changed = false;
        for (const [src, processed] of entries) {
          if (next[src] === processed) continue;
          next[src] = processed;
          changed = true;
        }
        return changed ? next : current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [imageSources]);

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
              {item.imageSrc ? (
                <img
                  src={transparentImages[item.imageSrc] ?? item.imageSrc}
                  alt={item.label}
                  className="conveyor__item-media conveyor__item-img"
                />
              ) : (
                <span className="conveyor__item-media conveyor__item-icon">{item.icon}</span>
              )}
              <span className="conveyor__item-copy">
                <span className="conveyor__item-name">{item.label}</span>
                <span className="conveyor__item-tagline">{item.tagline}</span>
              </span>
            </button>
          );
        })}

        <div className="conveyor__edge-spacer" aria-hidden="true" />
      </div>
    </div>
  );
}
