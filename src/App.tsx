import { Component, ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TierProvider } from "./context/TierContext";
import { Nav } from "./components/Nav";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CardForge } from "./pages/CardForge";
import { Collection } from "./pages/Collection";
import { DeckBuilder } from "./pages/DeckBuilder";
import { EditCard } from "./pages/EditCard";
import { Trades } from "./pages/Trades";
import { Login } from "./pages/Login";

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
          <ErrorBoundary>
            <div className="app">
              <Nav />
              <main className="main">
                <Routes>
                  <Route path="/" element={<CardForge />} />
                  <Route path="/login" element={<Login />} />
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
              </main>
            </div>
          </ErrorBoundary>
        </TierProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
