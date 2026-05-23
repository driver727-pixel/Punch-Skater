import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthCard } from "../components/AuthCard";
import { ForgeStartHere } from "../components/ForgeStartHere";
import { useAuth } from "../context/AuthContext";
import { warmRoutes, warmRoutesOnIdle } from "../lib/routePrefetch";
import { resolveUserDisplayName } from "../lib/userIdentity";

export function LandingPage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

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
  const userDisplayName = resolveUserDisplayName({
    profileDisplayName: userProfile?.displayName,
    authDisplayName: user?.displayName,
    email: user?.email,
  });

  return (
    <div className="page landing-page">
      <section className="landing-hero">
        <div className="landing-hero__copy">
          <p className="landing-hero__eyebrow">Welcome Landing</p>
          <h1 className="landing-hero__title">Punch Skater™</h1>
          <p className="landing-hero__subtitle">CARD GAME</p>
          <p className="landing-hero__badge">A Sk8r Punk™ Game</p>
          <p className="landing-hero__lede">
            Start in the forge, build a crew, sign in when you are ready to save progress, and race into the neon districts.
          </p>
        </div>
        <div className="landing-hero__glow" aria-hidden="true">
          <span className="landing-hero__glow-orb landing-hero__glow-orb--primary" />
          <span className="landing-hero__glow-orb landing-hero__glow-orb--secondary" />
          <span className="landing-hero__grid" />
        </div>
      </section>

      <section className="landing-grid">
        <ForgeStartHere
          className="landing-start-here"
          title="Start Here"
          actions={(
            <>
              <button
                type="button"
                className="btn-primary btn-lg"
                onMouseEnter={handleForgeIntent}
                onFocus={handleForgeIntent}
                onClick={() => navigate("/forge")}
              >
                Card Forge
              </button>
              <button
                type="button"
                className="btn-outline btn-lg"
                onMouseEnter={handleArenaIntent}
                onFocus={handleArenaIntent}
                onClick={() => navigate("/arena")}
              >
                Arena
              </button>
            </>
          )}
        />

        {user ? (
          <aside className="landing-account-card">
            <p className="landing-account-card__eyebrow">Signed In</p>
            <h2 className="landing-account-card__title">Welcome back, {userDisplayName}.</h2>
            <p className="landing-account-card__copy">
              Your account is live. Jump back into the forge, open your collection, or head straight to the arena.
            </p>
            <div className="landing-account-card__actions">
              <button type="button" className="btn-primary" onClick={() => navigate("/forge")}>Open Card Forge</button>
              <button type="button" className="btn-outline" onClick={() => navigate("/collection")}>Open Collection</button>
              <button type="button" className="btn-outline" onClick={() => navigate("/arena")}>Enter Arena</button>
            </div>
          </aside>
        ) : (
          <div className="landing-auth-shell">
            <AuthCard
              className="landing-auth-card"
              hint="Sign in to save cards, build a Crew, run Missions, race rivals, and trade across the districts."
              panelEyebrow="Login"
              panelTitle="Use your existing Punch Skater™ sign-in"
              panelSubtitle="Email, Google, and phone login all work here."
              showBranding={false}
              showGuestLink={false}
            />
          </div>
        )}
      </section>
    </div>
  );
}
