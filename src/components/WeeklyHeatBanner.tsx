import type { WeeklyHeatState } from "../hooks/useWeeklyHeat";

interface WeeklyHeatBannerProps {
  weeklyHeat: WeeklyHeatState;
}

export function WeeklyHeatBanner({ weeklyHeat }: WeeklyHeatBannerProps) {
  if (!weeklyHeat.enabled || !weeklyHeat.isActive) return null;

  const { heatCard, weatherQuest, timeRemaining } = weeklyHeat;

  return (
    <div className="weekly-heat-banner" style={{ "--heat-accent": heatCard.accentColor } as React.CSSProperties}>
      <div className="weekly-heat-banner__heat">
        <div className="weekly-heat-banner__heat-badge">WEEKLY HEAT</div>
        <div className="weekly-heat-banner__heat-info">
          <span className="weekly-heat-banner__heat-name">{heatCard.name}</span>
          <span className="weekly-heat-banner__heat-desc">{heatCard.description}</span>
          <span className="weekly-heat-banner__heat-meta">
            {heatCard.district} &middot; {heatCard.rarity} &middot; {timeRemaining} left
          </span>
        </div>
      </div>
      <div className="weekly-heat-banner__quest">
        <div className="weekly-heat-banner__quest-badge">WEATHER QUEST</div>
        <div className="weekly-heat-banner__quest-info">
          <span className="weekly-heat-banner__quest-title">{weatherQuest.title}</span>
          <span className="weekly-heat-banner__quest-desc">{weatherQuest.description}</span>
          <span className="weekly-heat-banner__quest-reward">
            {weatherQuest.rewardLabel} &middot; +{weatherQuest.rewardXp} XP
          </span>
        </div>
      </div>
    </div>
  );
}
