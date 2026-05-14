import type { CardPayload } from "../lib/types";
import type { WorldLocation } from "../lib/types";
import { CardThumbnail } from "./CardThumbnail";

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
  crewCards?: CardPayload[];
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
  crewCards = [],
}: MissionTransitSceneProps) {
  const uniqueSceneTags = [...new Set(sceneTags)];
  const displayCards = crewCards.slice(0, 3);

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
      {displayCards.length > 0 && (
        <div className="mission-transit__crew" aria-label="Crew sending on this mission">
          <span className="mission-cinematic__metric-label">Crew up</span>
          <div className="mission-transit__crew-cards">
            {displayCards.map((card) => (
              <div key={card.id} className="mission-transit__crew-card">
                <CardThumbnail card={card} width={64} height={90} />
                <span className="mission-transit__crew-name">{card.identity.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
