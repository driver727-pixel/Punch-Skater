import { useEffect, useMemo, useState } from "react";
import {
  formatTimeRemaining,
  getCurrentHeatCard,
  getCurrentWeatherQuest,
  getHeatCardTimeRemaining,
  isHeatCardActive,
  type WeeklyHeatCard,
  type WeeklyWeatherQuest,
} from "../lib/weeklyHeat";
import { isEnabled } from "../lib/featureFlags";

const TICK_MS = 60_000;

export interface WeeklyHeatState {
  enabled: boolean;
  heatCard: WeeklyHeatCard;
  weatherQuest: WeeklyWeatherQuest;
  isActive: boolean;
  timeRemaining: string;
  msRemaining: number;
}

export function useWeeklyHeat(): WeeklyHeatState {
  const enabled = isEnabled("WEEKLY_HEAT");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, [enabled]);

  const heatCard = useMemo(() => getCurrentHeatCard(now), [now]);
  const weatherQuest = useMemo(() => getCurrentWeatherQuest(now), [now]);
  const isActive = isHeatCardActive(heatCard, now);
  const msRemaining = getHeatCardTimeRemaining(heatCard, now);
  const timeRemaining = formatTimeRemaining(msRemaining);

  return { enabled, heatCard, weatherQuest, isActive, timeRemaining, msRemaining };
}
