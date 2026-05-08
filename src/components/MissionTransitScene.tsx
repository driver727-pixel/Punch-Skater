import type { WorldLocation } from "../lib/types";

interface MissionTransitSceneProps {
  missionId: string;
  locale: WorldLocation;
  localeSummary: string;
  sceneEyebrow: string;
  sceneTitle: string;
  sceneBody: string;
  sceneTags: string[];
  controlledBy: string;
  crewPressure: string;
}

export function MissionTransitScene({
  missionId,
  locale,
  localeSummary,
  sceneEyebrow,
  sceneTitle,
  sceneBody,
  sceneTags,
  controlledBy,
  crewPressure,
}: MissionTransitSceneProps) {
  const uniqueSceneTags = [...new Set(sceneTags)];

  return (
    <section className="mission-transit mission-panel">
      <div className="mission-transit__header">
        <div className="mission-transit__copy">
          <span className="mission-stage__eyebrow">{sceneEyebrow}</span>
          <h4 className="mission-stage__title">{sceneTitle}</h4>
          <p className="mission-stage__summary">{sceneBody}</p>
          <div className="mission-intel-tags">
            {uniqueSceneTags.map((tag) => (
              <span key={`${missionId}-${tag}`} className="mission-intel-tag">{tag}</span>
            ))}
          </div>
        </div>
        <div className="mission-transit__meta">
          <span className="mission-cinematic__metric-label">Operation locale</span>
          <strong>{locale}</strong>
          <span className="mission-transit__meta-copy">{localeSummary}</span>
          <span className="mission-cinematic__metric-label">Controlled by</span>
          <strong>{controlledBy}</strong>
          <span className="mission-cinematic__metric-label">Crew pressure</span>
          <span>{crewPressure}</span>
        </div>
      </div>
    </section>
  );
}
