import type { ChargeUpState } from "../hooks/useChargeUp";

interface ChargeUpIndicatorProps {
  chargeUp: ChargeUpState;
  compact?: boolean;
}

export function ChargeUpIndicator({ chargeUp, compact }: ChargeUpIndicatorProps) {
  if (!chargeUp.enabled) return null;

  return (
    <div
      className={`charge-up-indicator${chargeUp.available ? " charge-up-indicator--ready" : ""}${compact ? " charge-up-indicator--compact" : ""}`}
      role="status"
      aria-live="polite"
      title={
        chargeUp.available
          ? "Free Charge Up forge available! Punch Skater and Apprentice rarities only."
          : `Charge Up recharging: ${chargeUp.countdown}`
      }
    >
      <span className="charge-up-indicator__icon" aria-hidden="true">
        {chargeUp.available ? "\u26A1" : "\u{1F50B}"}
      </span>
      <span className="charge-up-indicator__label">
        {chargeUp.available ? "Charge Up Ready" : chargeUp.countdown}
      </span>
      {chargeUp.available && !compact && (
        <span className="charge-up-indicator__hint">Free forge (capped rarity)</span>
      )}
    </div>
  );
}
