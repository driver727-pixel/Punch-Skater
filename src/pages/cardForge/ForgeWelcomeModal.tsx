import { useEffect, useMemo, useState } from "react";
import { ForgeStartHere } from "../../components/ForgeStartHere";
import { CardDisplay } from "../../components/CardDisplay";
import {
  fetchCrewFaceoff,
  loadCachedCrewFaceoff,
  preloadCrewFaceoffImages,
  type CrewFaceoffPayload,
} from "../../services/hypeFaceoff";

interface ForgeWelcomeModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

const FACE_OFF_ROTATION_MS = 7000;

function CrewFaceoffSpotlight({ payload }: { payload: CrewFaceoffPayload }) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / FACE_OFF_ROTATION_MS));
  const cassidyCards = payload.crews.cassidy.cards;
  const garibaldiCards = payload.crews.garibaldi.cards;
  const pairCount = Math.min(cassidyCards.length, garibaldiCards.length);
  const pairIndex = pairCount > 0 ? tick % pairCount : 0;
  const garibaldiRotationOffset = pairCount > 0 ? Math.floor(tick / pairCount) : 0;
  const cassidyCard = cassidyCards[pairIndex];
  const garibaldiCard = pairCount > 0
    ? garibaldiCards[(pairIndex + garibaldiRotationOffset) % garibaldiCards.length]
    : undefined;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Math.floor(Date.now() / FACE_OFF_ROTATION_MS));
    }, FACE_OFF_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (pairCount === 0 || !cassidyCard || !garibaldiCard) return null;

  return (
    <section className="forge-welcome-faceoff" aria-label="Featured crew face-off">
      <div className="forge-welcome-faceoff__flare" aria-hidden="true" />
      <div className="forge-welcome-faceoff__header">
        <span className="forge-welcome-faceoff__eyebrow">Tonight&apos;s Hype Match</span>
        <h3>Cassidy&apos;s Crew vs Garibaldi&apos;s Crew</h3>
      </div>
      <div className="forge-welcome-faceoff__stage">
        <article className="forge-welcome-faceoff__card forge-welcome-faceoff__card--cassidy">
          <span className="forge-welcome-faceoff__crew">{payload.crews.cassidy.deckName}</span>
          <CardDisplay card={cassidyCard} hideAllActions hideToolButtons />
        </article>
        <div className="forge-welcome-faceoff__versus" aria-hidden="true">
          <span>VS</span>
        </div>
        <article className="forge-welcome-faceoff__card forge-welcome-faceoff__card--garibaldi">
          <span className="forge-welcome-faceoff__crew">{payload.crews.garibaldi.deckName}</span>
          <CardDisplay card={garibaldiCard} hideAllActions hideToolButtons />
        </article>
      </div>
    </section>
  );
}

export function ForgeWelcomeModal({ open, onClose, title }: ForgeWelcomeModalProps) {
  const [faceoffPayload, setFaceoffPayload] = useState<CrewFaceoffPayload | null>(() => loadCachedCrewFaceoff());
  const spotlight = useMemo(
    () => faceoffPayload ? <CrewFaceoffSpotlight payload={faceoffPayload} /> : null,
    [faceoffPayload],
  );

  useEffect(() => {
    let cancelled = false;
    fetchCrewFaceoff()
      .then((payload) => {
        if (!payload || cancelled) return;
        setFaceoffPayload(payload);
        preloadCrewFaceoffImages(payload);
      })
      .catch(() => {
        // The welcome copy still works if the hype cards are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="modal-overlay forge-welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-welcome-title"
      onClick={onClose}
    >
      <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="close-btn modal-close"
          aria-label="Close welcome"
          onClick={onClose}
        >
          ✕
        </button>
        <ForgeStartHere
          titleId="forge-welcome-title"
          title={title}
          spotlight={spotlight}
          actions={(
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
            >
              Got it — let's forge
            </button>
          )}
        />
      </div>
    </div>
  );
}
