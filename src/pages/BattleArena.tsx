/**
 * Arena — game mode landing page.
 *
 * Core game modes (live):
 *   - Card Forge       (/forge)
 *   - Forge Clash      (/arena/forge-clash)
 *
 * Early access bonus mini-games (coming soon):
 *   - Joustur Skatur™  (feature-flagged)
 *   - Cyber Joust      (feature-flagged)
 *   - Classic Race     (/arena/classic)
 *   - Punch Skater Streets
 */
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isEnabled } from "../lib/featureFlags";

export function BattleArena() {
  const { user } = useAuth();
  const showJousturEntry = isEnabled("JOUSTUR_SKATUR", user);
  const showCyberJoust = isEnabled("CYBER_JOUST", user);
  const showStreets = isEnabled("STREETS", user);

  return (
    <div className="page race-arena-page">
      <header className="race-arena-header">
        <h1>Arena</h1>
        <p className="race-arena-subtitle">
          Forge your skaters, then drop into battle.
        </p>
      </header>

      {/* ── Core Game ─────────────────────────────────────────────────── */}
      <section className="arena-core-section" aria-label="Core game modes">
        <p className="app-status-eyebrow">Core Game</p>

        <div className="race-arena-featured-mode arena-featured--forge">
          <div>
            <p className="app-status-eyebrow">Step 1</p>
            <h2>Card Forge</h2>
            <p>
              Create your skater card with AI-generated art. Set your stats, pick your
              faction, and make your Crew.
            </p>
          </div>
          <Link to="/forge" className="btn-primary race-arena-featured-mode__cta">
            ⚡ Open Card Forge
          </Link>
        </div>

        <div className="race-arena-featured-mode arena-featured--clash">
          <div>
            <p className="app-status-eyebrow">Step 2 · Main Mode</p>
            <h2>Forge Clash</h2>
            <p>
              Draft forged cards, read rival intent, and chain animated combo strikes
              with the skaters you create.
            </p>
          </div>
          <Link to="/arena/forge-clash" className="btn-primary race-arena-featured-mode__cta">
            🃏 Enter Forge Clash
          </Link>
        </div>
      </section>

      {/* ── Early Access Bonus Mini-Games ─────────────────────────────── */}
      <section className="arena-early-access-section" aria-label="Early access mini-games">
        <div className="arena-early-access-header">
          <span className="arena-coming-soon-badge">🎮 Early Access Bonus</span>
          <h3 className="arena-early-access-title">Mini-Games</h3>
          <p className="arena-early-access-desc">
            Bonus experiences in early access. Play and give feedback — these are separate from the core game.
          </p>
        </div>

        <div className="race-arena-modes">
          {showJousturEntry && (
            <Link to="/joustur" className="btn-outline race-arena-mode-link arena-mode-link--early">
              <span className="arena-coming-soon-badge arena-coming-soon-badge--inline">Early Access</span>
              🛹 Joustur Skatur™
              <span className="arena-mode-link__desc">Based on the classic Royal Game of Ur</span>
            </Link>
          )}
          {!showJousturEntry && (
            <div className="btn-outline race-arena-mode-link arena-mode-link--early arena-mode-link--locked">
              <span className="arena-coming-soon-badge arena-coming-soon-badge--inline">Coming Soon</span>
              🛹 Joustur Skatur™
              <span className="arena-mode-link__desc">Based on the classic Royal Game of Ur</span>
            </div>
          )}

          {showCyberJoust && (
            <a href="https://rosebud.ai/play/neon-skater-clash" className="btn-outline race-arena-mode-link arena-mode-link--early">
              <span className="arena-coming-soon-badge arena-coming-soon-badge--inline">Early Access</span>
              ⚡ Cyber Joust
              <span className="arena-mode-link__desc">Fast neon joust action</span>
            </a>
          )}

          <Link to="/arena/classic" className="btn-outline race-arena-mode-link arena-mode-link--early">
            <span className="arena-coming-soon-badge arena-coming-soon-badge--inline">Early Access</span>
            🏁 Classic Race
            <span className="arena-mode-link__desc">Stat-based race vs. CPU or online rivals</span>
          </Link>

          {showStreets && (
            <a href="/streets/" className="btn-outline race-arena-mode-link arena-mode-link--early">
              <span className="arena-coming-soon-badge arena-coming-soon-badge--inline">Early Access</span>
              🛹 Punch Skater™ Streets
              <span className="arena-mode-link__desc">Side-scrolling arcade beat-em-up</span>
            </a>
          )}
          {!showStreets && (
            <div className="btn-outline race-arena-mode-link arena-mode-link--early arena-mode-link--locked">
              <span className="arena-coming-soon-badge arena-coming-soon-badge--inline">Coming Soon</span>
              🛹 Punch Skater™ Streets
              <span className="arena-mode-link__desc">Side-scrolling arcade beat-em-up</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
