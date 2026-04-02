import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TierProvider } from "./context/TierContext";
import { Nav } from "./components/Nav";
import { CardForge } from "./pages/CardForge";
import { Collection } from "./pages/Collection";
import { DeckBuilder } from "./pages/DeckBuilder";

function App() {
  return (
    <BrowserRouter>
      <TierProvider>
        <div className="app">
          <Nav />
          <main className="main">
            <Routes>
              <Route path="/" element={<CardForge />} />
              <Route path="/collection" element={<Collection />} />
              <Route path="/decks" element={<DeckBuilder />} />
            </Routes>
          </main>
        </div>
      </TierProvider>
    </BrowserRouter>
  );
}

export default App;
