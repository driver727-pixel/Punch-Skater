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
 */

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
  if (!deckUrl && !drivetrainUrl && !wheelsUrl && !batteryUrl) return null;

  const batteryZIndex = batteryIsTopMounted ? 40 : 25;

  return (
    <div className={`board-composite${className ? ` ${className}` : ""}`}>
      {/* Bottom layer — wheels */}
      {wheelsUrl && (
        <img
          src={wheelsUrl}
          alt="wheels"
          className="board-composite__layer board-composite__layer--wheels"
        />
      )}

      {/* Second layer — drivetrain / trucks */}
      {drivetrainUrl && (
        <img
          src={drivetrainUrl}
          alt="drivetrain"
          className="board-composite__layer board-composite__layer--drivetrain"
        />
      )}

      {/* Battery — z-index determined by mount position */}
      {batteryUrl && (
        <img
          src={batteryUrl}
          alt="battery"
          className="board-composite__layer"
          style={{ zIndex: batteryZIndex }}
        />
      )}

      {/* Deck layer */}
      {deckUrl && (
        <img
          src={deckUrl}
          alt="deck"
          className="board-composite__layer board-composite__layer--deck"
        />
      )}
    </div>
  );
}
