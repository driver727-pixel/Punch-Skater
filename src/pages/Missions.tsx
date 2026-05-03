import { useAuth } from "../context/AuthContext";
import { MissionsPanel } from "../components/MissionsPanel";

export function Missions() {
  const { user } = useAuth();
  if (!user) return null;
  return <MissionsPanel uid={user.uid} />;
}
