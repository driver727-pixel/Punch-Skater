/**
 * PowerSwitchButton.tsx
 *
 * The "Lock It In" button for the Board Builder.  Styled with an industrial,
 * heavy-duty aesthetic — dark metals, neon accents, and hazard stripes.
 *
 * The component handles its own deep-depress animation. The parent is
 * responsible for orchestrating the broader sequence (builder surge +
 * builder shake) via the `onAnimate` callback.
 */
import { useState, useCallback } from "react";
import { sfxLockItIn } from "../lib/sfx";

interface PowerSwitchButtonProps {
  /** Fired when the button is clicked; parent sequences the full animation. */
  onAnimate: () => void;
  /** When true, the button is non-interactive and visually dimmed. */
  disabled?: boolean;
}

export function PowerSwitchButton({ onAnimate, disabled }: PowerSwitchButtonProps) {
  const [depressed, setDepressed] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled || depressed) return;
    setDepressed(true);
    sfxLockItIn();
    // Release the button press after the depress animation completes
    setTimeout(() => setDepressed(false), 220);
    // Notify the parent to start the full animation sequence
    onAnimate();
  }, [disabled, depressed, onAnimate]);

  return (
    <button
      className={`psb${depressed ? " psb--depressed" : ""}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label="Lock In Board Configuration"
    >
      {/* Left hazard stripe accent */}
      <span className="psb__hazard" aria-hidden="true" />

      {/* Core label */}
      <span className="psb__inner">
        <span className="psb__icon" aria-hidden="true">⚡</span>
        <span className="psb__label">LOCK IT IN</span>
      </span>

      {/* Right hazard stripe accent */}
      <span className="psb__hazard" aria-hidden="true" />
    </button>
  );
}
