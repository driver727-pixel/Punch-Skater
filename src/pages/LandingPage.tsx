import { useEffect } from "react";
import { AuthCard } from "../components/AuthCard";
import { ForgeStartHere } from "../components/ForgeStartHere";
import { useAuth } from "../context/AuthContext";
import { warmRoutes, warmRoutesOnIdle } from "../lib/routePrefetch";

export function LandingPage() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      warmRoutes(["forge", "arena", "collection"]);
      return warmRoutesOnIdle(["missions", "leaderboard"]);
    }

    warmRoutes(["forge", "login"]);
    return warmRoutesOnIdle(["arena"]);
  }, [user]);

  return (
    <div className="page landing-page">
      <section className="landing-grid">
        <ForgeStartHere
          className="landing-start-here"
          title="Start Here"
        />

        <div className="landing-auth-shell">
          <AuthCard
            className="landing-auth-card"
            hint="Sign up free — forge your first skater card and drop into Forge Clash. Save your Crew, earn daily rewards, and trade cards across the districts."
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
