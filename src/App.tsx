import { Component, ReactNode, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TierProvider } from "./context/TierContext";
import { LanguageProvider } from "./context/LanguageContext";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import { ProtectedRoute } from "./components/ProtectedRoute";

const CardForge  = lazy(() => import("./pages/CardForge").then(m => ({ default: m.CardForge })));
const Collection = lazy(() => import("./pages/Collection").then(m => ({ default: m.Collection })));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder").then(m => ({ default: m.DeckBuilder })));
const EditCard   = lazy(() => import("./pages/EditCard").then(m => ({ default: m.EditCard })));
const Trades     = lazy(() => import("./pages/Trades").then(m => ({ default: m.Trades })));
const Login      = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Credits         = lazy(() => import("./pages/Credits").then(m => ({ default: m.Credits })));
const PrivacyPolicy   = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService  = lazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService })));

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
          <LanguageProvider>
            <ErrorBoundary>
              <div className="app">
                <Nav />
                <main className="main">
                  <Suspense fallback={<div className="page-loading">Loading…</div>}>
                    <Routes>
                      <Route path="/" element={<CardForge />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/credits" element={<Credits />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/terms" element={<TermsOfService />} />
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
