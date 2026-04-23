import { useCallback, useState } from "react";
import {
  advanceMissionsByType,
  getDailyMissions,
  type DailyMission,
  type MissionTemplate,
} from "../lib/dailyMissions";
import { isEnabled } from "../lib/featureFlags";

export interface DailyMissionsState {
  enabled: boolean;
  missions: DailyMission[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
  trackProgress: (type: MissionTemplate["type"], increment?: number) => DailyMission[];
  refresh: () => void;
}

export function useDailyMissions(): DailyMissionsState {
  const enabled = isEnabled("MISSIONS");
  const [missions, setMissions] = useState<DailyMission[]>(() =>
    enabled ? getDailyMissions() : [],
  );

  const completedCount = missions.filter((m) => m.status === "completed").length;
  const totalCount = missions.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const trackProgress = useCallback(
    (type: MissionTemplate["type"], increment: number = 1) => {
      if (!enabled) return [];
      const updated = advanceMissionsByType(type, increment);
      if (updated.length > 0) {
        setMissions(getDailyMissions());
      }
      return updated;
    },
    [enabled],
  );

  const refresh = useCallback(() => {
    if (enabled) {
      setMissions(getDailyMissions());
    }
  }, [enabled]);

  return {
    enabled,
    missions,
    completedCount,
    totalCount,
    allComplete,
    trackProgress,
    refresh,
  };
}
