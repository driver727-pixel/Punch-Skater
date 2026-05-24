import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

function getFeatureLabel(pathname: string): string {
  if (pathname.startsWith("/collection")) return "Collection and Crews";
  if (pathname.startsWith("/edit/")) return "card editing";
  if (pathname.startsWith("/trades")) return "Trades and seasonal leaderboard";
  if (pathname.startsWith("/leaderboard")) return "Leaderboard";
  if (pathname.startsWith("/profile")) return "Your Profile";
  if (pathname.startsWith("/trash")) return "Trash bin";
  if (pathname.startsWith("/arena")) return "Race Arena";
  if (pathname.startsWith("/joustur")) return "Joustur Skatur™";
  if (pathname.startsWith("/race/")) return "race replays";
  if (pathname.startsWith("/missions")) return "Missions";
  if (pathname.startsWith("/workshop")) return "Workshop";
  if (pathname.startsWith("/account")) return "Account Settings";
  if (pathname.startsWith("/admin")) return "Admin";
  if (pathname.startsWith("/dev/asset-generator")) return "Image Assets";
  return "this area";
}

function getGateMessage(pathname: string, gateLabel: string): string {
  if (pathname.startsWith("/arena") || pathname.startsWith("/joustur")) {
    return `Sign in free to try ${gateLabel} solo with house cards from the admin account. Guest mode only covers the Card Forge preview in this browser.`;
  }
  return `Sign in to access ${gateLabel}. Guest mode only covers the Card Forge preview in this browser.`;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "80px" }}>
        <span style={{ color: "var(--text-dim)", fontSize: "13px" }}>⏳ Loading…</span>
      </div>
    );
  }

  if (!user) {
    const gateLabel = getFeatureLabel(location.pathname);
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          gateLabel,
          gateMessage: getGateMessage(location.pathname, gateLabel),
        }}
        replace
      />
    );
  }

  return <>{children}</>;
}
