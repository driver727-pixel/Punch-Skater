import { Component, type ReactNode, type ErrorInfo, lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { TierProvider } from "./context/TierContext";
import { LanguageProvider } from "./context/LanguageContext";
import { useTier } from "./context/TierContext";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { firebaseUnavailableMessage, isFirebaseConfigured } from "./lib/firebase";

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
const MAIN_CONTENT_SELECTOR = ".main";

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
        <div style={{ padding: "2rem", textAlign: "center", color: "#ff4466" }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page and try again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();

  useEffect(() => {
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TierProvider>
          <ThemeApplier />
          <LanguageProvider>
            <ErrorBoundary>
              <div className="app">
                <ScrollToTopOnRouteChange />
                <Nav />
                {!isFirebaseConfigured && (
                  <div className="firebase-banner">{firebaseUnavailableMessage}</div>
                )}
                <PlayerRewardBanner />
                <main className="main">
                  <Suspense fallback={<div className="page-loading">Loading…</div>}>
                    <Routes>
                      <Route path="/" element={<CardForge />} />
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
                  </Suspense>
                </main>
                <Footer />
              </div>
            </ErrorBoundary>
          </LanguageProvider>
        </TierProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
