import { useCallback, useEffect, useMemo, useState } from "react";
import {
  consumeCharge,
  formatCountdown,
  getChargeStatus,
  isChargeAllowedRarity,
} from "../lib/chargeUp";
import { isEnabled } from "../lib/featureFlags";
import type { Rarity } from "../lib/types";

const TICK_INTERVAL_MS = 1000;

export interface ChargeUpState {
  enabled: boolean;
  available: boolean;
  countdown: string;
  msUntilReady: number;
  useCharge: () => void;
  isRarityAllowed: (rarity: Rarity) => boolean;
}

export function useChargeUp(): ChargeUpState {
  const enabled = isEnabled("CHARGE_UP");
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  const status = useMemo(() => getChargeStatus(now), [now]);

  const useCharge = useCallback(() => {
    consumeCharge();
    setNow(Date.now());
  }, []);

  const isRarityAllowed = useCallback(
    (rarity: Rarity) => isChargeAllowedRarity(rarity),
    [],
  );

  return {
    enabled,
    available: enabled && status.available,
    countdown: formatCountdown(status.msUntilReady),
    msUntilReady: status.msUntilReady,
    useCharge,
    isRarityAllowed,
  };
}
