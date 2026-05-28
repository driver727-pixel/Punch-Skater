import { Component, type ReactNode, type ErrorInfo, lazy, Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TierProvider } from "./context/TierContext";
import { WalletProvider } from "./context/WalletContext";
import { LanguageProvider } from "./context/LanguageContext";
import { useTier } from "./context/TierContext";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { TerminalShell } from "./components/TerminalShell";
import {
  TerminalRouterProvider,
  isTerminalPath,
} from "./context/TerminalRouterContext";
import { firebaseUnavailableMessage, isFirebaseConfigured } from "./lib/firebase";
import { featureFlags, isEnabled } from "./lib/featureFlags";
import {
  applyDistrictTheme,
  getDistrictTransitionEyebrow,
  getDistrictTheme,
  getDistrictTransitionLine,
  getStoredActiveDistrict,
  subscribeToDistrictChanges,
} from "./lib/districtTheme";

/** Applies data-theme and data-time attributes to <html> for CSS theming. */
function ThemeApplier() {
  const { tier } = useTier();

  useEffect(() => {
    const applyTime = () => {
      const hour = new Date().getHours();
      const isDay = hour >= 6 && hour < 20;
      document.documentElement.setAttribute("data-time", isDay ? "day" : "night");
    };

    document.documentElement.setAttribute("data-theme", tier);
    applyTime();

    const interval = setInterval(applyTime, 60_000);
    return () => clearInterval(interval);
  }, [tier]);

  return null;
}

function PlayerRewardBanner() {
  const { playerRewards } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const rewardKey = `${playerRewards?.signupBonusGranted ? "signup:1" : "signup:0"};claim:${playerRewards?.dailyReward?.claimed ? playerRewards.dailyReward.lastClaimDate : "none"}`;

  useEffect(() => {
    setDismissed(false);
  }, [rewardKey]);

  if (!playerRewards || dismissed) return null;
  if (!playerRewards.signupBonusGranted && !playerRewards.dailyReward?.claimed) return null;
  const nextRewardXp = playerRewards.dailyReward?.nextRewardXp ?? 0;
  const nextRewardOzzies = playerRewards.dailyReward?.nextRewardOzzies ?? 0;
  const updates = [
    playerRewards.signupBonusGranted ? "🎁 Rare signup bonus added." : "",
    playerRewards.dailyReward?.claimed
      ? `🔥 ${playerRewards.dailyReward.currentStreak}-day streak claimed for +${playerRewards.dailyReward.rewardXp} XP and +${playerRewards.dailyReward.rewardOzzies} Ozzies.`
      : "",
    `Next login reward: +${nextRewardXp} XP and +${nextRewardOzzies} Ozzies.`,
  ].filter(Boolean).join(" ");

  return (
    <div className="player-reward-banner" role="status" aria-live="polite">
      <div className="player-reward-banner__copy">
        <strong>Daily ritual updated.</strong>
        <span>{updates}</span>
      </div>
      <button type="button" className="player-reward-banner__close" onClick={() => setDismissed(true)} aria-label="Dismiss reward update">
        ×
      </button>
    </div>
  );
}

const CardForge  = lazy(() => import("./pages/CardForge").then(m => ({ default: m.CardForge })));
const LandingPage = lazy(() => import("./pages/LandingPage").then(m => ({ default: m.LandingPage })));
const Collection = lazy(() => import("./pages/Collection").then(m => ({ default: m.Collection })));
const EditCard   = lazy(() => import("./pages/EditCard").then(m => ({ default: m.EditCard })));
const Trades     = lazy(() => import("./pages/Trades").then(m => ({ default: m.Trades })));
const Login      = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Credits         = lazy(() => import("./pages/Credits").then(m => ({ default: m.Credits })));
const Factions        = lazy(() => import("./pages/Factions").then(m => ({ default: m.Factions })));
const Lore            = lazy(() => import("./pages/Lore").then(m => ({ default: m.Lore })));
const PrivacyPolicy   = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService  = lazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService })));
const ResetPassword   = lazy(() => import("./pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const AccountSettings = lazy(() => import("./pages/AccountSettings").then(m => ({ default: m.AccountSettings })));
const Admin           = lazy(() => import("./pages/Admin").then(m => ({ default: m.Admin })));
const AssetGenerator  = lazy(() => import("./pages/AssetGenerator").then(m => ({ default: m.AssetGenerator })));
const BattleArena     = lazy(() => import("./pages/BattleArena").then(m => ({ default: m.BattleArena })));
const RaceTrack       = lazy(() => import("./pages/RaceTrack").then(m => ({ default: m.RaceTrack })));
const FramePreview    = lazy(() => import("./pages/FramePreview").then(m => ({ default: m.FramePreview })));
const Missions        = lazy(() => import("./pages/Missions").then(m => ({ default: m.Missions })));
const Workshop        = lazy(() => import("./pages/Workshop").then(m => ({ default: m.Workshop })));
const UserProfile     = lazy(() => import("./pages/UserProfile").then(m => ({ default: m.UserProfile })));
const Leaderboard     = lazy(() => import("./pages/Leaderboard").then(m => ({ default: m.Leaderboard })));
const Trash           = lazy(() => import("./pages/Trash").then(m => ({ default: m.Trash })));
const NotFound        = lazy(() => import("./pages/NotFound").then(m => ({ default: m.NotFound })));
const JousturHome     = lazy(() => import("./pages/joustur/JousturHome").then(m => ({ default: m.JousturHome })));
const JousturLineupBuilder = lazy(() => import("./pages/joustur/JousturLineupBuilder").then(m => ({ default: m.JousturLineupBuilder })));
const JousturBoard    = lazy(() => import("./pages/joustur/JousturBoard").then(m => ({ default: m.JousturBoard })));
const JousturResult   = lazy(() => import("./pages/joustur/JousturResult").then(m => ({ default: m.JousturResult })));
const JousturRules    = lazy(() => import("./pages/joustur/JousturRules").then(m => ({ default: m.JousturRules })));
const MAIN_CONTENT_SELECTOR = ".main";
const EYEBROW_SEED_OFFSET = 17;

/** P2-C: Redirects to "/" when the JOUSTUR_SKATUR feature flag is off. */
function JousturGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!isEnabled("JOUSTUR_SKATUR", user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function resolveScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "auto";
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page app-error-state" role="alert">
          <p className="app-status-eyebrow">System Alert</p>
          <h2 className="page-title">Runtime Fault</h2>
          <p className="page-sub">Something glitched while rendering this view.</p>
          <p className="app-error-state__copy">You can retry, return to the forge, or reload the page.</p>
          <div className="app-error-state__actions">
            <button type="button" className="btn-primary btn-sm" onClick={() => this.setState({ hasError: false })}>
              Retry View
            </button>
            <a href="/forge" className="btn-outline btn-sm">Go to Card Forge</a>
            <button type="button" className="btn-outline btn-sm" onClick={() => window.location.reload()}>
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppLoadingState() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading__glyph" aria-hidden="true">⚡</span>
      <div className="page-loading__copy">
        <strong>Booting district feed…</strong>
        <span>Syncing your latest neon run.</span>
      </div>
    </div>
  );
}

function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();

  useEffect(() => {
    // The Unified Terminal panels manage their own per-panel scroll memory,
    // so skip the global reset whenever the URL belongs to a terminal view.
    if (featureFlags.UNIFIED_TERMINAL && isTerminalPath(pathname)) return;
    const behavior = resolveScrollBehavior();
    const main = document.querySelector(MAIN_CONTENT_SELECTOR);
    if (main instanceof HTMLElement) {
      main.scrollTo({ top: 0, left: 0, behavior });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior });
    }
  }, [pathname]);

  return null;
}

function resolveDistrictForRoute(pathname: string, currentDistrict: string): string {
  // Hub and Forge are Airaway terminal surfaces; other routes keep the most
  // recent district until their page-level data announces a more specific one.
  if (pathname === "/" || pathname === "/forge") return "airaway";
  return currentDistrict;
}

/** Pages where lore background panels should not appear (active game sessions). */
const LORE_BG_EXCLUDED_PATHS = /^\/(race(\/|$)|joustur\/(match|result)(\/|$))/;

function pathLoreSeed(pathname: string): number {
  return pathname.split("").reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
}

function LoreBgPanel() {
  const { pathname } = useLocation();
  const [activeDistrict, setActiveDistrict] = useState(getStoredActiveDistrict);

  useEffect(() => subscribeToDistrictChanges(setActiveDistrict), []);

  if (LORE_BG_EXCLUDED_PATHS.test(pathname)) return null;

  const seed = pathLoreSeed(pathname);
  const theme = getDistrictTheme(activeDistrict);
  const eyebrow = getDistrictTransitionEyebrow(activeDistrict, seed + EYEBROW_SEED_OFFSET);
  const line = getDistrictTransitionLine(activeDistrict, seed);

  return (
    <div className="lore-bg-panel" aria-hidden="true">
      <div className="lore-bg-panel__card">
        <span className="lore-bg-panel__eyebrow">{eyebrow}</span>
        <strong>{theme.name}</strong>
        <p>{line}</p>
      </div>
    </div>
  );
}

function DistrictThemeApplier() {
  const { pathname } = useLocation();
  const [activeDistrict, setActiveDistrict] = useState(getStoredActiveDistrict);
  const activeDistrictRef = useRef(activeDistrict);

  useEffect(() => {
    activeDistrictRef.current = activeDistrict;
    applyDistrictTheme(activeDistrict);
  }, [activeDistrict]);

  useEffect(() => subscribeToDistrictChanges(setActiveDistrict), []);

  useEffect(() => {
    const nextDistrict = resolveDistrictForRoute(pathname, activeDistrictRef.current);
    applyDistrictTheme(nextDistrict);
  }, [pathname]);

  return null;
}

function AppParallaxBackdrop() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const main = document.querySelector(MAIN_CONTENT_SELECTOR);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rafId = 0;

    const writeScroll = () => {
      rafId = 0;
      const scrollTop = main instanceof HTMLElement ? main.scrollTop : window.scrollY;
      root.style.setProperty("--parallax-scroll", scrollTop.toFixed(2));
    };

    const requestScrollWrite = () => {
      if (reducedMotion.matches || rafId) return;
      rafId = window.requestAnimationFrame(writeScroll);
    };

    const writePointer = (event?: PointerEvent) => {
      if (reducedMotion.matches || !event) {
        root.style.setProperty("--parallax-pointer-x", "0");
        root.style.setProperty("--parallax-pointer-y", "0");
        return;
      }

      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      root.style.setProperty("--parallax-pointer-x", x.toFixed(3));
      root.style.setProperty("--parallax-pointer-y", y.toFixed(3));
    };

    const handleReducedMotionChange = () => {
      if (reducedMotion.matches) {
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      writeScroll();
      writePointer();
    };

    writeScroll();
    writePointer();

    if (main instanceof HTMLElement) {
      main.addEventListener("scroll", requestScrollWrite, { passive: true });
    } else {
      window.addEventListener("scroll", requestScrollWrite, { passive: true });
    }
    window.addEventListener("pointermove", writePointer, { passive: true });
    reducedMotion.addEventListener("change", handleReducedMotionChange);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (main instanceof HTMLElement) {
        main.removeEventListener("scroll", requestScrollWrite);
      } else {
        window.removeEventListener("scroll", requestScrollWrite);
      }
      window.removeEventListener("pointermove", writePointer);
      reducedMotion.removeEventListener("change", handleReducedMotionChange);
      root.style.setProperty("--parallax-scroll", "0");
      root.style.setProperty("--parallax-pointer-x", "0");
      root.style.setProperty("--parallax-pointer-y", "0");
    };
  }, []);

  return (
    <div className="app-parallax" aria-hidden="true">
      <div className="app-parallax__layer app-parallax__layer--nebula" />
      <div className="app-parallax__layer app-parallax__layer--grid" />
      <div className="app-parallax__layer app-parallax__layer--beams" />
      <div className="app-parallax__props app-parallax__props--left">
        <span className="app-parallax__prop app-parallax__prop--dish" />
        <span className="app-parallax__prop app-parallax__prop--cassette" />
        <span className="app-parallax__prop app-parallax__prop--cable" />
      </div>
      <div className="app-parallax__props app-parallax__props--right">
        <span className="app-parallax__prop app-parallax__prop--dish app-parallax__prop--dish-sm" />
        <span className="app-parallax__prop app-parallax__prop--antenna" />
        <span className="app-parallax__prop app-parallax__prop--laser" />
      </div>
    </div>
  );
}

function LegacyRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/forge" element={<CardForge />} />
      <Route path="/login" element={<Login />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="/factions" element={<Factions />} />
      <Route path="/lore" element={<Lore />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/account" element={
        <ProtectedRoute><AccountSettings /></ProtectedRoute>
      } />
      <Route path="/collection" element={
        <ProtectedRoute><Collection /></ProtectedRoute>
      } />
      <Route path="/decks" element={<Navigate to="/collection?tab=decks" replace />} />
      <Route path="/edit/:cardId" element={
        <ProtectedRoute><EditCard /></ProtectedRoute>
      } />
      <Route path="/trades" element={
        <ProtectedRoute><Trades /></ProtectedRoute>
      } />
      <Route path="/arena" element={
        <ProtectedRoute><BattleArena /></ProtectedRoute>
      } />
      <Route path="/race/:raceId" element={
        <ProtectedRoute><RaceTrack /></ProtectedRoute>
      } />
      <Route path="/missions" element={
        <ProtectedRoute><Missions /></ProtectedRoute>
      } />
      <Route path="/joustur" element={
        <ProtectedRoute><JousturGate><JousturHome /></JousturGate></ProtectedRoute>
      } />
      <Route path="/joustur/lineup" element={
        <ProtectedRoute><JousturGate><JousturLineupBuilder /></JousturGate></ProtectedRoute>
      } />
      <Route path="/joustur/match/:id" element={
        <ProtectedRoute><JousturGate><JousturBoard /></JousturGate></ProtectedRoute>
      } />
      <Route path="/joustur/result/:id" element={
        <ProtectedRoute><JousturGate><JousturResult /></JousturGate></ProtectedRoute>
      } />
      <Route path="/joustur/rules" element={<JousturRules />} />
      <Route path="/workshop" element={
        <ProtectedRoute><Workshop /></ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute><UserProfile /></ProtectedRoute>
      } />
      <Route path="/leaderboard" element={
        <ProtectedRoute><Leaderboard /></ProtectedRoute>
      } />
      <Route path="/trash" element={
        <ProtectedRoute><Trash /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute><Admin /></AdminRoute>
      } />
      <Route path="/dev/asset-generator" element={
        <AdminRoute><AssetGenerator /></AdminRoute>
      } />
      <Route path="/dev/frame-preview" element={<FramePreview />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/**
 * Routes URL → either the Unified Terminal SPA shell or the legacy `<Routes>`.
 *
 * When the `UNIFIED_TERMINAL` feature flag is on AND the current pathname
 * matches a registered terminal view (phase 1: `/` and `/forge`), the shell
 * stays mounted across navigation so panels slide in/out via CSS transforms
 * without unmounting page state. All other paths continue to render through
 * the legacy `<Routes>` tree, so unmigrated views are unaffected.
 */
function AppContent() {
  const { pathname } = useLocation();
  const isUnifiedTerminalRoute = featureFlags.UNIFIED_TERMINAL && isTerminalPath(pathname);

  if (isUnifiedTerminalRoute) {
    return (
      <TerminalRouterProvider>
        <TerminalShell />
      </TerminalRouterProvider>
    );
  }
  return <LegacyRoutes />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <TierProvider>
            <ThemeApplier />
            <LanguageProvider>
              <ErrorBoundary>
                <div className="app">
                  <AppParallaxBackdrop />
                  <a className="skip-link" href="#main-content">Skip to main content</a>
                  <ScrollToTopOnRouteChange />
                  <Nav />
                  {!isFirebaseConfigured && (
                    <div className="firebase-banner">{firebaseUnavailableMessage}</div>
                  )}
                  <PlayerRewardBanner />
                  <DistrictThemeApplier />
                  <LoreBgPanel />
                  <main id="main-content" className="main" tabIndex={-1}>
                    <Suspense fallback={<AppLoadingState />}>
                      <AppContent />
                    </Suspense>
                  </main>
                  <Footer />
                </div>
              </ErrorBoundary>
            </LanguageProvider>
          </TierProvider>
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
