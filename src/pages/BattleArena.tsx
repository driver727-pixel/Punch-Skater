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

  return (
    <div className="page race-arena-page">
      <header className="race-arena-header">
        <h1>Arena</h1>
        <p className="race-arena-subtitle">
          Pick a game mode to earn rewards for your collection.
        </p>
      </header>

      <div className="race-arena-modes">
        {showJousturEntry && (
          <Link to="/joustur" className="btn-outline">
            🛹 Joustur Skatur™ - based on the classic Royal Game of Ur
          </Link>
        )}
        {showCyberJoust && (
          <a href="/cyber-joust/" className="btn-outline">
            ⚡ Cyber Joust - based on the classic video game Joust
          </a>
        )}
        <Link to="/arena/classic" className="btn-outline">
          🏁 Classic Race - stat based race against computer, or online opponents
        </Link>
      </div>
    </div>
  );
}
