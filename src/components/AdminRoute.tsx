import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, userProfile, loading } = useAuth();

  if (loading || (user && !userProfile)) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "80px" }}>
        <span style={{ color: "var(--text-dim)", fontSize: "13px" }}>⏳ Loading…</span>
      </div>
    );
  }

  if (!user || userProfile?.isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
