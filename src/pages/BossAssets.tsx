import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CardPayload } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { CardThumbnail } from "../components/CardThumbnail";
import { CardViewer3D } from "../components/CardViewer3D";
import { PrintModal } from "../components/PrintModal";
import { PrintedCardPreviewPair } from "../components/PrintedCardFaces";
import { CardContainer } from "../components/CardContainer";
import { buildCardVars } from "../lib/cardVars";
import { sfxClick, sfxRemove } from "../lib/sfx";
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { AdminPageBadge } from "../components/AdminPageBadge";

const BOSS_ASSETS_COLLECTION = "adminBossAssets";

/**
 * Admin-only Boss Assets collection page.
 * Displays all cards saved to the admin Boss Assets collection for easy access.
 */
export function BossAssets() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState<CardPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CardPayload | null>(null);
  const [viewing3D, setViewing3D] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user?.uid || userProfile?.isAdmin !== true) return;

    const collRef = collection(db, BOSS_ASSETS_COLLECTION);
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const bossCards = snapshot.docs.map((d) => d.data() as CardPayload);
      bossCards.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setCards(bossCards);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, userProfile?.isAdmin]);

  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards;
    const query = searchQuery.toLowerCase();
    return cards.filter(
      (card) =>
        card.identity.name.toLowerCase().includes(query) ||
        card.identity.crew.toLowerCase().includes(query) ||
        card.class.rarity.toLowerCase().includes(query),
    );
  }, [cards, searchQuery]);

  const handleSelect = useCallback((card: CardPayload) => {
    sfxClick();
    setSelected(card);
  }, []);

  const handleRemove = useCallback(async (card: CardPayload) => {
    if (!confirm(`Remove "${card.identity.name}" from Boss Assets?`)) return;
    sfxRemove();
    try {
      await deleteDoc(doc(db, BOSS_ASSETS_COLLECTION, card.id));
      setSelected((prev) => (prev?.id === card.id ? null : prev));
    } catch (error) {
      console.error("Failed to remove boss asset:", error);
    }
  }, []);

  if (userProfile?.isAdmin !== true) {
    return (
      <div className="page-container">
        <p className="empty-state">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="page-container boss-assets-page">
      <header className="collection-header">
        <h1>🛡 Boss Assets<AdminPageBadge /></h1>
        <p className="form-hint">
          Admin-only collection of Boss cards. Previously created Bosses are stored here for easy access during game management.
        </p>
      </header>

      <div className="collection-toolbar">
        <input
          type="search"
          className="collection-search"
          placeholder="Search boss cards…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Search boss assets"
        />
        <span className="collection-count">{filteredCards.length} boss card{filteredCards.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <p className="empty-state">Loading boss assets…</p>
      ) : filteredCards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🛡</span>
          <p>No boss assets yet. Save cards from the Card Forge using &ldquo;Save to Admin Assets&rdquo;.</p>
          <button className="btn-primary" onClick={() => navigate("/forge")}>
            Open Card Forge
          </button>
        </div>
      ) : (
        <div className="collection-grid">
          {filteredCards.map((card) => (
            <div key={card.id} className="collection-grid__item">
              <CardThumbnail
                card={card}
                onClick={() => handleSelect(card)}
                selected={selected?.id === card.id}
              />
              <button
                className="btn-outline btn-sm btn-danger"
                onClick={() => handleRemove(card)}
                title="Remove from Boss Assets"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <section className="collection-detail">
          <h2>{selected.identity.name}</h2>
          <CardContainer cardVars={buildCardVars(selected, "collection")}>
            <PrintedCardPreviewPair
              card={selected}
              backgroundImageUrl={selected.backgroundImageUrl}
              characterImageUrl={selected.characterImageUrl}
              frameImageUrl={selected.frameImageUrl}
              weaponImageUrl={selected.weaponImageUrl}
              characterBlend={1}
            />
          </CardContainer>
          <div className="collection-detail__actions">
            <button className="btn-outline" onClick={() => setViewing3D(true)}>◈ 3D</button>
            <button className="btn-outline" onClick={() => setPrinting(true)}>🖨 Print</button>
          </div>
        </section>
      )}

      {viewing3D && selected && (
        <CardViewer3D card={selected} onClose={() => setViewing3D(false)} />
      )}
      {printing && selected && (
        <PrintModal card={selected} onClose={() => setPrinting(false)} />
      )}
    </div>
  );
}
