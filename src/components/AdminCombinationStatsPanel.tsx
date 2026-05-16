import { useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebase";

// ── Totals derived from the compatibility rules in boardBuilderCompatibility.ts ─
//
// Street:    3 drivetrains (Belt, Hub, Gear) × 2 orientations × 4 motors × 4 wheels × 2 batteries  = 192
// Mountain:  1 drivetrain (4WD)             × 1 orientation  × 1 motor  × 1 wheel  × 1 battery    =   1
// Surf:      1 drivetrain (Hub)             × 2 orientations × 2 motors × 2 wheels × 1 battery    =   8
// AT:        3 drivetrains (Belt, Hub, Gear) × 2 orientations × 3 motors × 4 wheels × 2 batteries  = 144
const TOTAL_BOARD_COMBOS = 345;

// Total from required CardPrompts categorical fields:
// 10 archetypes × 5 rarities × 8 styles × 6 districts × 3 genders × 4 age groups × 5 body types
const TOTAL_CHAR_COMBOS = 144_000;

interface CombinationGroup {
  boardCombos: number;
  charCombos: number;
}

interface CombinationStats {
  admin: CombinationGroup;
  users: CombinationGroup;
  combined: CombinationGroup;
}

function resolveAdminActionUrl(pathname: string): string {
  const configuredUrl = (import.meta.env.VITE_ADMIN_API_URL as string | undefined)?.trim();
  if (!configuredUrl) return pathname;
  try {
    return new URL(pathname, configuredUrl).toString();
  } catch {
    return pathname;
  }
}

function pct(count: number, total: number): string {
  if (total === 0) return "0.00%";
  return ((count / total) * 100).toFixed(2) + "%";
}

export function AdminCombinationStatsPanel() {
  const [stats, setStats] = useState<CombinationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    if (!auth?.currentUser) return;
    setLoading(true);
    setError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(resolveAdminActionUrl("/api/admin/combination-stats"), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load combination stats.");
      setStats(data as CombinationStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load combination stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="admin-combo-panel">
      <div className="admin-combo-header">
        <h2 className="admin-section-title">Combination Coverage</h2>
        <button className="btn-outline" onClick={loadStats} disabled={loading}>
          {loading ? "⏳ Loading…" : "↺ Refresh"}
        </button>
      </div>
      <p className="admin-combo-desc">
        Running percentage of unique board configs ({TOTAL_BOARD_COMBOS} valid) and character
        profiles ({TOTAL_CHAR_COMBOS.toLocaleString()} possible) that have been created and saved.
      </p>

      {error && <p className="admin-error">{error}</p>}

      {stats && (
        <div className="admin-combo-grid">
          {/* ── Board Configurations ── */}
          <div className="admin-combo-section">
            <h3 className="admin-combo-section-title">🛹 Board Configurations</h3>
            <div className="admin-combo-rows">
              <div className="admin-combo-row">
                <span className="admin-combo-label">Admin collection</span>
                <span className="admin-combo-count">{stats.admin.boardCombos}</span>
                <span className="admin-combo-pct">{pct(stats.admin.boardCombos, TOTAL_BOARD_COMBOS)}</span>
                <div className="admin-combo-bar-wrap">
                  <div
                    className="admin-combo-bar admin-combo-bar--admin"
                    style={{ width: pct(stats.admin.boardCombos, TOTAL_BOARD_COMBOS) }}
                  />
                </div>
              </div>
              <div className="admin-combo-row">
                <span className="admin-combo-label">All users (excl. admin)</span>
                <span className="admin-combo-count">{stats.users.boardCombos}</span>
                <span className="admin-combo-pct">{pct(stats.users.boardCombos, TOTAL_BOARD_COMBOS)}</span>
                <div className="admin-combo-bar-wrap">
                  <div
                    className="admin-combo-bar admin-combo-bar--users"
                    style={{ width: pct(stats.users.boardCombos, TOTAL_BOARD_COMBOS) }}
                  />
                </div>
              </div>
              <div className="admin-combo-row admin-combo-row--combined">
                <span className="admin-combo-label">Combined unique</span>
                <span className="admin-combo-count">{stats.combined.boardCombos}</span>
                <span className="admin-combo-pct">{pct(stats.combined.boardCombos, TOTAL_BOARD_COMBOS)}</span>
                <div className="admin-combo-bar-wrap">
                  <div
                    className="admin-combo-bar admin-combo-bar--combined"
                    style={{ width: pct(stats.combined.boardCombos, TOTAL_BOARD_COMBOS) }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Character Profiles ── */}
          <div className="admin-combo-section">
            <h3 className="admin-combo-section-title">🧑 Character Profiles</h3>
            <div className="admin-combo-rows">
              <div className="admin-combo-row">
                <span className="admin-combo-label">Admin collection</span>
                <span className="admin-combo-count">{stats.admin.charCombos.toLocaleString()}</span>
                <span className="admin-combo-pct">{pct(stats.admin.charCombos, TOTAL_CHAR_COMBOS)}</span>
                <div className="admin-combo-bar-wrap">
                  <div
                    className="admin-combo-bar admin-combo-bar--admin"
                    style={{ width: pct(stats.admin.charCombos, TOTAL_CHAR_COMBOS) }}
                  />
                </div>
              </div>
              <div className="admin-combo-row">
                <span className="admin-combo-label">All users (excl. admin)</span>
                <span className="admin-combo-count">{stats.users.charCombos.toLocaleString()}</span>
                <span className="admin-combo-pct">{pct(stats.users.charCombos, TOTAL_CHAR_COMBOS)}</span>
                <div className="admin-combo-bar-wrap">
                  <div
                    className="admin-combo-bar admin-combo-bar--users"
                    style={{ width: pct(stats.users.charCombos, TOTAL_CHAR_COMBOS) }}
                  />
                </div>
              </div>
              <div className="admin-combo-row admin-combo-row--combined">
                <span className="admin-combo-label">Combined unique</span>
                <span className="admin-combo-count">{stats.combined.charCombos.toLocaleString()}</span>
                <span className="admin-combo-pct">{pct(stats.combined.charCombos, TOTAL_CHAR_COMBOS)}</span>
                <div className="admin-combo-bar-wrap">
                  <div
                    className="admin-combo-bar admin-combo-bar--combined"
                    style={{ width: pct(stats.combined.charCombos, TOTAL_CHAR_COMBOS) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!stats && !loading && !error && (
        <p className="admin-loading">No data yet.</p>
      )}
    </div>
  );
}
