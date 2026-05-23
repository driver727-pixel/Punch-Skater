export type RoutePrefetchKey =
  | "forge"
  | "login"
  | "arena"
  | "collection"
  | "missions"
  | "leaderboard"
  | "workshop"
  | "trades"
  | "profile"
  | "account"
  | "joustur";

const warmedRoutes = new Set<RoutePrefetchKey>();

const routeWarmers: Record<RoutePrefetchKey, () => Promise<unknown>> = {
  forge: () => import("../pages/CardForge"),
  login: () => import("../pages/Login"),
  arena: () => import("../pages/BattleArena"),
  collection: () => import("../pages/Collection"),
  missions: () => import("../pages/Missions"),
  leaderboard: () => import("../pages/Leaderboard"),
  workshop: () => import("../pages/Workshop"),
  trades: () => import("../pages/Trades"),
  profile: () => import("../pages/UserProfile"),
  account: () => import("../pages/AccountSettings"),
  joustur: () => Promise.all([
    import("../pages/joustur/JousturHome"),
    import("../pages/joustur/JousturLineupBuilder"),
    import("../pages/joustur/JousturRules"),
  ]),
};

export function warmRoute(key: RoutePrefetchKey) {
  if (warmedRoutes.has(key)) return;
  warmedRoutes.add(key);
  void routeWarmers[key]().catch(() => {
    warmedRoutes.delete(key);
  });
}

export function warmRoutes(keys: RoutePrefetchKey[]) {
  keys.forEach(warmRoute);
}

export function warmRoutesOnIdle(keys: RoutePrefetchKey[], timeout = 1500) {
  if (typeof window === "undefined") return () => undefined;

  const callback = () => warmRoutes(keys);
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timerId = window.setTimeout(callback, Math.min(timeout, 400));
  return () => window.clearTimeout(timerId);
}
