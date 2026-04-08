import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdminEmail } from "../lib/adminUtils";

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: "80px" }}>
        <span style={{ color: "var(--text-dim)", fontSize: "13px" }}>⏳ Loading…</span>
      </div>
    );
  }

  if (!user || !isAdminEmail(user.email ?? "")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
