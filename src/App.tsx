import { Component, ReactNode, lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
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

const CardForge  = lazy(() => import("./pages/CardForge").then(m => ({ default: m.CardForge })));
const Collection = lazy(() => import("./pages/Collection").then(m => ({ default: m.Collection })));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder").then(m => ({ default: m.DeckBuilder })));
const EditCard   = lazy(() => import("./pages/EditCard").then(m => ({ default: m.EditCard })));
const Trades     = lazy(() => import("./pages/Trades").then(m => ({ default: m.Trades })));
const Login      = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Credits         = lazy(() => import("./pages/Credits").then(m => ({ default: m.Credits })));
const Factions        = lazy(() => import("./pages/Factions").then(m => ({ default: m.Factions })));
const Lore            = lazy(() => import("./pages/Lore").then(m => ({ default: m.Lore })));
const PrivacyPolicy   = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService  = lazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService })));
const ResetPassword   = lazy(() => import("./pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const Admin           = lazy(() => import("./pages/Admin").then(m => ({ default: m.Admin })));
const AssetGenerator  = lazy(() => import("./pages/AssetGenerator").then(m => ({ default: m.AssetGenerator })));

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TierProvider>
          <ThemeApplier />
          <LanguageProvider>
            <ErrorBoundary>
              <div className="app">
                <Nav />
                {!isFirebaseConfigured && (
                  <div className="firebase-banner">{firebaseUnavailableMessage}</div>
                )}
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
                      <Route path="/collection" element={
                        <ProtectedRoute><Collection /></ProtectedRoute>
                      } />
                      <Route path="/decks" element={
                        <ProtectedRoute><DeckBuilder /></ProtectedRoute>
                      } />
                      <Route path="/edit/:cardId" element={
                        <ProtectedRoute><EditCard /></ProtectedRoute>
                      } />
                      <Route path="/trades" element={
                        <ProtectedRoute><Trades /></ProtectedRoute>
                      } />
                      <Route path="/admin" element={
                        <AdminRoute><Admin /></AdminRoute>
                      } />
                      <Route path="/dev/asset-generator" element={
                        <AdminRoute><AssetGenerator /></AdminRoute>
                      } />
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
