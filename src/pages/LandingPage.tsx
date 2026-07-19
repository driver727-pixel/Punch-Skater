import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { ForgeStartHere } from "../components/ForgeStartHere";
import { useAuth } from "../context/AuthContext";
import { warmRoutes, warmRoutesOnIdle } from "../lib/routePrefetch";
import {
  fetchCrewFaceoff,
  loadCachedCrewFaceoff,
  preloadCrewFaceoffImages,
  type CrewFaceoffPayload,
} from "../services/hypeFaceoff";
import { CrewFaceoffSpotlight } from "./cardForge/ForgeWelcomeModal";

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [faceoffPayload, setFaceoffPayload] = useState<CrewFaceoffPayload | null>(() => loadCachedCrewFaceoff());

  useEffect(() => {
    if (faceoffPayload) {
      preloadCrewFaceoffImages(faceoffPayload);
    }
  }, [faceoffPayload]);

  useEffect(() => {
    let cancelled = false;
    fetchCrewFaceoff()
      .then((payload) => {
        if (!payload || cancelled) return;
        setFaceoffPayload(payload);
        preloadCrewFaceoffImages(payload);
      })
      .catch(() => {
        // The landing hero still works if the face-off payload is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) {
      warmRoutes(["forge", "arena", "collection"]);
      return warmRoutesOnIdle(["missions", "leaderboard"]);
    }

    warmRoutes(["forge", "login"]);
    return warmRoutesOnIdle(["arena"]);
  }, [user]);

  const handleForgeIntent = () => warmRoutes(["forge"]);
  const handleArenaIntent = () => warmRoutes(["arena", "joustur"]);

  return (
    <div className="page landing-page">
      <section className="landing-hero">
        <div className="landing-hero__copy">
          <h1 className="landing-hero__title">Punch Skater™</h1>
          <p className="landing-hero__subtitle">a Sk8r Punk™ Card Game!</p>
          <p className="landing-hero__lede">
            A pocket arcade deck-builder where rooftop gardens, cassette tech, and neon rivals collide.
            Forge a skater, build a crew, then drop into fast taps, bold choices, and district runs.
          </p>
          <div className="landing-hero__mode-strip" aria-label="Punch Skater experience pillars">
            <span>Solar punk streets</span>
            <span>Cyber punk rivals</span>
            <span>Mobile-first runs</span>
          </div>
          <div className="landing-hero__hud" role="list" aria-label="Punch Skater game flow">
            <div className="landing-hero__hud-track" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="landing-hero__hud-step" role="listitem">
              <span>01</span>
              <strong>Forge Card</strong>
            </div>
            <div className="landing-hero__hud-step" role="listitem">
              <span>02</span>
              <strong>Build Crew</strong>
            </div>
            <div className="landing-hero__hud-step" role="listitem">
              <span>03</span>
              <strong>Drop In</strong>
            </div>
          </div>
          <div className="landing-hero__quick-stats" aria-label="Mobile game loop highlights">
            <span><strong>Tap</strong> to forge</span>
            <span><strong>Swipe</strong> the districts</span>
            <span><strong>Claim</strong> daily hype</span>
          </div>
          <div className="landing-hero__actions">
            <button
              type="button"
              className="btn-primary landing-cta-button landing-cta-button--forge"
              onMouseEnter={handleForgeIntent}
              onFocus={handleForgeIntent}
              onClick={() => navigate("/forge")}
            >
              Card Forge
            </button>
            <button
              type="button"
              className="btn-outline landing-cta-button landing-cta-button--arena"
              onMouseEnter={handleArenaIntent}
              onFocus={handleArenaIntent}
              onClick={() => navigate("/arena")}
            >
              Arena
            </button>
          </div>
        </div>
        <div className="landing-hero__spotlight">
          {faceoffPayload ? (
            <CrewFaceoffSpotlight payload={faceoffPayload} />
          ) : (
            <section className="landing-hero__spotlight-placeholder" aria-label="Featured crew face-off loading">
              <p className="landing-hero__spotlight-eyebrow">Tonight&apos;s Hype Match</p>
              <h2 className="landing-hero__spotlight-title">Cassidy&apos;s Crew vs Garibaldi&apos;s Crew</h2>
              <p className="landing-hero__spotlight-copy">
                Pulling the featured face-off from cache so the landing page stays hot on every visit.
              </p>
            </section>
          )}
        </div>
      </section>

      <section className="landing-grid">
        <ForgeStartHere
          className="landing-start-here"
          title="Start Here"
        />

        <div className="landing-auth-shell">
          <AuthCard
            className="landing-auth-card"
            hint="Sign up free to try solo Arena and Joustur Skatur™ runs with house cards, then save cards, build a Crew, run Missions, race rivals, and trade across the districts."
            panelEyebrow="Login"
            panelTitle="Sign in or create your free Punch Skater™ account"
            panelSubtitle="Email, Google, and phone login all work here."
            showBranding={false}
            showGuestLink={false}
          />
        </div>
      </section>

    </div>
  );
}
