/**
 * Arena — game mode landing page.
 *
 * Links to the three game modes:
 *   - Joustur Skatur™  (feature-flagged)
 *   - Cyber Joust      (feature-flagged)
 *   - Classic Race     (/arena/classic)
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
          Pick a game mode to earn rewards for your collection.
        </p>
      </header>

      <div className="race-arena-featured-mode">
        <div>
          <p className="app-status-eyebrow">Featured Core Mode</p>
          <h2>Forge Clash</h2>
          <p>
            The main arena experience: draft forged cards, read rival intent, and chain
            animated combo strikes with the skaters you create.
          </p>
        </div>
        <Link to="/arena/forge-clash" className="btn-primary race-arena-featured-mode__cta">
          🃏 Enter Forge Clash
        </Link>
      </div>

      <div className="race-arena-modes">
        <Link to="/arena/forge-clash" className="btn-outline race-arena-mode-link race-arena-mode-link--forge-clash">
          🃏 Forge Clash - featured animated card duel using the cards you forge
        </Link>
        {showJousturEntry && (
          <Link to="/joustur" className="btn-outline race-arena-mode-link">
            🛹 Joustur Skatur™ - based on the classic Royal Game of Ur
          </Link>
        )}
        {showCyberJoust && (
          <a href="https://rosebud.ai/play/neon-skater-clash" className="btn-outline race-arena-mode-link">
            ⚡ Cyber Joust
          </a>
        )}
        {showStreets && (
          <a href="/streets/" className="btn-outline race-arena-mode-link">
            🛹 Punch Skater™ Streets - side-scrolling arcade beat-em-up
          </a>
        )}
        <Link to="/arena/classic" className="btn-outline race-arena-mode-link">
          🏁 Classic Race - stat based race against computer, or online opponents
        </Link>
      </div>
    </div>
  );
}
