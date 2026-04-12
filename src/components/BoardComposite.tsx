/**
 * BoardComposite.tsx
 *
 * Visually stacks four pre-generated skateboard component PNGs into a single
 * composite image. Layers are ordered from bottom to top:
 *
 *   Wheels (z-index: 10) → Drivetrain / Trucks (z-index: 20)
 *   → Under-mounted Battery (z-index: 25) → Deck (z-index: 30)
 *   → Top-mounted Battery (z-index: 40)
 *
 * The battery layer z-index is driven by the `batteryIsTopMounted` prop:
 *   - false → z-index 25 (slides under the deck)
 *   - true  → z-index 40 (sits on top of the deck)
 *
 * All URLs are optional — missing layers are simply not rendered.  The
 * component returns null when none of the four URLs are provided.
 *
 * While any provided layer image is still loading the component overlays a
 * looping loading GIF (with a shimmer sweep on top) so the partially-assembled
 * board is never visible mid-paint.  The overlay is removed once every
 * provided layer has fired its onLoad event.
 */

import { useState, useEffect, useCallback, useMemo } from "react";

interface BoardCompositeProps {
  /** URL of the deck layer PNG (z-index 30). */
  deckUrl?: string | null;
  /** URL of the drivetrain / trucks layer PNG (z-index 20). */
  drivetrainUrl?: string | null;
  /** URL of the wheels layer PNG (z-index 10). */
  wheelsUrl?: string | null;
  /** URL of the battery layer PNG (z-index 25 or 40 depending on mount position). */
  batteryUrl?: string | null;
  /** When true the battery renders above the deck (z-index 40). Defaults to false (z-index 25). */
  batteryIsTopMounted?: boolean;
  /** Extra CSS class applied to the outer container. */
  className?: string;
}

export function BoardComposite({
  deckUrl,
  drivetrainUrl,
  wheelsUrl,
  batteryUrl,
  batteryIsTopMounted = false,
  className,
}: BoardCompositeProps) {
  // Track which provided layer URLs have finished loading.
  // Using a Set of URL strings means the overlay is removed as soon as every
  // provided URL has fired onLoad — even when URLs change between renders.
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());

  // Memoised list of currently-provided (non-null) URLs.
  const providedUrls = useMemo(
    () => [deckUrl, drivetrainUrl, wheelsUrl, batteryUrl].filter((u): u is string => !!u),
    [deckUrl, drivetrainUrl, wheelsUrl, batteryUrl],
  );

  // When a URL is removed or replaced, drop stale entries from the loaded Set
  // so the overlay correctly reappears for any new or changed layer.
  useEffect(() => {
    const current = new Set(providedUrls);
    setLoadedUrls((prev) => {
      const filtered = new Set<string>();
      for (const url of prev) { if (current.has(url)) filtered.add(url); }
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [providedUrls]);

  // Stable callback — does not close over any changing value.
  const handleLoad = useCallback((url: string) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  if (providedUrls.length === 0) return null;

  const batteryZIndex = batteryIsTopMounted ? 40 : 25;
  const isLoading = providedUrls.some((url) => !loadedUrls.has(url));

  return (
    <div className={`board-composite${className ? ` ${className}` : ""}`}>
      {/* Bottom layer — wheels */}
      {wheelsUrl && (
        <img
          src={wheelsUrl}
          alt="wheels"
          className="board-composite__layer board-composite__layer--wheels"
          onLoad={() => handleLoad(wheelsUrl)}
        />
      )}

      {/* Second layer — drivetrain / trucks */}
      {drivetrainUrl && (
        <img
          src={drivetrainUrl}
          alt="drivetrain"
          className="board-composite__layer board-composite__layer--drivetrain"
          onLoad={() => handleLoad(drivetrainUrl)}
        />
      )}

      {/* Battery — z-index determined by mount position */}
      {batteryUrl && (
        <img
          src={batteryUrl}
          alt="battery"
          className="board-composite__layer"
          style={{ zIndex: batteryZIndex }}
          onLoad={() => handleLoad(batteryUrl)}
        />
      )}

      {/* Deck layer */}
      {deckUrl && (
        <img
          src={deckUrl}
          alt="deck"
          className="board-composite__layer board-composite__layer--deck"
          onLoad={() => handleLoad(deckUrl)}
        />
      )}

      {/* Loading overlay — visible until every provided layer has loaded */}
      {isLoading && (
        <div className="board-composite__loading-overlay">
          <img src="/assets/loading.apng" alt="Loading…" className="card-art-loading-gif" />
        </div>
      )}
    </div>
  );
}
