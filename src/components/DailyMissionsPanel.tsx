import type { DailyMissionsState } from "../hooks/useDailyMissions";

interface DailyMissionsPanelProps {
  dailyMissions: DailyMissionsState;
}

const TYPE_ICONS: Record<string, string> = {
  forge: "\u{1F3B4}",
  battle: "\u2694\uFE0F",
  trade: "\u{1F91D}",
  mission: "\u{1F6F9}",
  collection: "\u{1F4E6}",
};

export function DailyMissionsPanel({ dailyMissions }: DailyMissionsPanelProps) {
  if (!dailyMissions.enabled || dailyMissions.missions.length === 0) return null;

  return (
    <div className="daily-missions-panel">
      <div className="daily-missions-panel__header">
        <h3 className="daily-missions-panel__title">Daily Missions</h3>
        <span className="daily-missions-panel__progress">
          {dailyMissions.completedCount}/{dailyMissions.totalCount}
          {dailyMissions.allComplete && " \u2728"}
        </span>
      </div>

      <div className="daily-missions-panel__list">
        {dailyMissions.missions.map((mission) => {
          const pct = mission.target > 0 ? (mission.progress / mission.target) * 100 : 0;
          const isComplete = mission.status === "completed";

          return (
            <div
              key={mission.id}
              className={`daily-mission-card${isComplete ? " daily-mission-card--complete" : ""}`}
            >
              <div className="daily-mission-card__icon">
                {TYPE_ICONS[mission.type] ?? "\u{1F3AF}"}
              </div>
              <div className="daily-mission-card__content">
                <span className="daily-mission-card__title">{mission.title}</span>
                <span className="daily-mission-card__desc">{mission.description}</span>
                <div className="daily-mission-card__bar-track">
                  <div
                    className="daily-mission-card__bar-fill"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <div className="daily-mission-card__reward">
                <span className="daily-mission-card__xp">+{mission.rewardXp} XP</span>
                <span className="daily-mission-card__ozzies">+{mission.rewardOzzies}</span>
              </div>
              {isComplete && (
                <span className="daily-mission-card__check" aria-label="Completed">{"\u2713"}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
