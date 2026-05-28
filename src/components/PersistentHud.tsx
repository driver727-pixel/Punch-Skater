/**
 * PersistentHud — sticky strip anchored above the terminal stage that keeps
 * the user's core profile readout (avatar, display name, Mission XP, Ozzies,
 * tier) visible while sub-panels slide over the viewport.
 *
 * Designed to coexist with <Nav> rather than replace it: Nav stays the global
 * chrome; this HUD is the always-on player readout the Unified Terminal plan
 * calls for. Collapses to a slim chip row on mobile breakpoints.
 */
import { useAuth } from "../context/AuthContext";
import { useTier } from "../context/TierContext";
import { TIERS } from "../lib/tiers";
import { resolveUserDisplayName, resolveUserInitial } from "../lib/userIdentity";
import { useTerminalRouter } from "../context/TerminalRouterContext";

export function PersistentHud() {
  const { user, userProfile } = useAuth();
  const { tier } = useTier();
  const { activeView, navigate, views } = useTerminalRouter();

  const displayName = resolveUserDisplayName({
    profileDisplayName: userProfile?.displayName,
    authDisplayName: user?.displayName,
    email: user?.email,
  });
  const initial = resolveUserInitial(displayName);
  const tierData = TIERS[tier];
  const missionXp = userProfile?.missionXp ?? 0;
  const ozzies = userProfile?.ozziesBalance ?? 0;
  const onHub = activeView === "hub";

  return (
    <aside className="terminal-hud" aria-label="Player status">
      <div className="terminal-hud__identity">
        <div className="terminal-hud__avatar" aria-hidden="true">{initial}</div>
        <div className="terminal-hud__identity-text">
          <span className="terminal-hud__name">{displayName}</span>
          <span className="terminal-hud__tier" data-tier={tier}>{tierData.name}</span>
        </div>
      </div>
      <div className="terminal-hud__stats" role="group" aria-label="Player resources">
        <span className="terminal-hud__stat terminal-hud__stat--xp" title="Mission XP">
          <span className="terminal-hud__stat-glyph" aria-hidden="true">⚡</span>
          <span className="terminal-hud__stat-value">{missionXp.toLocaleString()}</span>
          <span className="terminal-hud__stat-label">XP</span>
        </span>
        <span className="terminal-hud__stat terminal-hud__stat--ozzies" title="Ozzies balance">
          <span className="terminal-hud__stat-glyph" aria-hidden="true">💰</span>
          <span className="terminal-hud__stat-value">{ozzies.toLocaleString()}</span>
          <span className="terminal-hud__stat-label">Ozzies</span>
        </span>
      </div>
      <nav className="terminal-hud__quick-nav" aria-label="Terminal quick jump">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={
              view.id === activeView
                ? "terminal-hud__nav-btn terminal-hud__nav-btn--active"
                : "terminal-hud__nav-btn"
            }
            onClick={() => navigate(view.id)}
            aria-current={view.id === activeView ? "page" : undefined}
          >
            {view.label}
          </button>
        ))}
        {!onHub && (
          <button
            type="button"
            className="terminal-hud__nav-btn terminal-hud__nav-btn--return"
            onClick={() => navigate("hub")}
          >
            ⤺ Hub
          </button>
        )}
      </nav>
    </aside>
  );
}
