import { useCallback, useEffect, useState } from "react";
import { type DocumentSnapshot } from "firebase/firestore";
import { deleteCachedImage, listCachedImages, type CacheEntry } from "../services/imageCache";

const LAYER_LABELS: Record<string, string> = {
  background: "🌆 Background",
  character: "🧍 Character",
  frame: "🖼 Frame",
  "board-img": "🛹 Board",
};

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString();
}

export function AdminImageCachePanel() {
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [cacheLastDoc, setCacheLastDoc] = useState<DocumentSnapshot | null>(null);
  const [cacheHasMore, setCacheHasMore] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheError, setCacheError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCacheEntries = useCallback(async (after?: DocumentSnapshot) => {
    setCacheLoading(true);
    setCacheError("");
    try {
      const result = await listCachedImages(after);
      setCacheEntries((prev) => (after ? [...prev, ...result.entries] : result.entries));
      setCacheLastDoc(result.lastDoc);
      setCacheHasMore(result.hasMore);
    } catch (err) {
      setCacheError("Failed to load cache entries. Make sure you have admin access.");
      console.error(err);
    } finally {
      setCacheLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCacheEntries();
  }, [loadCacheEntries]);

  const handleDeleteCache = async (id: string) => {
    if (!window.confirm("Delete this cache entry? The image will be regenerated next time this card is forged.")) return;
    setDeletingId(id);
    try {
      await deleteCachedImage(id);
      setCacheEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      console.error("Failed to delete cache entry:", err);
      setCacheError("Failed to delete entry. Check you have admin permissions.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="admin-cache-header">
        <h2 className="admin-section-title">Image Cache</h2>
        <p className="admin-cache-desc">
          These are the Fal.ai-generated images stored in Firestore. When a card with
          matching parameters is forged, the cached image is reused so no new credits
          are consumed. Delete an entry to force regeneration next time.
        </p>
        <div className="admin-cache-toolbar">
          <span className="admin-cache-count">
            {cacheEntries.length} entr{cacheEntries.length === 1 ? "y" : "ies"} loaded
          </span>
          <button
            className="btn-outline"
            disabled={cacheLoading}
            onClick={() => {
              setCacheEntries([]);
              setCacheLastDoc(null);
              loadCacheEntries();
            }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {cacheError && <p className="admin-error">{cacheError}</p>}

      {cacheLoading && cacheEntries.length === 0 && (
        <div className="admin-loading">⏳ Loading cache entries…</div>
      )}

      {!cacheLoading && cacheEntries.length === 0 && (
        <p className="admin-empty" style={{ padding: "32px 0" }}>
          No cache entries found.
        </p>
      )}

      <div className="admin-cache-grid">
        {cacheEntries.map((entry) => (
          <div key={entry.id} className="admin-cache-card">
            <div className="admin-cache-thumb-wrap">
              {entry.imageUrl ? (
                <img
                  className="admin-cache-thumb"
                  src={entry.imageUrl}
                  alt={entry.id}
                  loading="lazy"
                />
              ) : (
                <div className="admin-cache-thumb admin-cache-thumb--missing">?</div>
              )}
              {entry.layer && (
                <span className="admin-cache-layer-badge">
                  {LAYER_LABELS[entry.layer] ?? entry.layer}
                </span>
              )}
            </div>
            <div className="admin-cache-info">
              <div className="admin-cache-key" title={entry.id}>{entry.id}</div>
              {entry.seed && (
                <div className="admin-cache-meta">
                  <span className="admin-cache-meta-label">Seed</span>
                  <span className="admin-cache-meta-value" title={entry.seed}>{entry.seed}</span>
                </div>
              )}
              {entry.prompt && (
                <details className="admin-cache-prompt-details">
                  <summary className="admin-cache-prompt-summary">Prompt</summary>
                  <p className="admin-cache-prompt-text">{entry.prompt}</p>
                </details>
              )}
              <div className="admin-cache-meta">
                <span className="admin-cache-meta-label">Cached</span>
                <span className="admin-cache-meta-value">{formatDate(entry.createdAt as { seconds: number } | null)}</span>
              </div>
              <div className="admin-cache-actions">
                <a
                  className="btn-outline admin-cache-view-btn"
                  href={entry.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View
                </a>
                <button
                  className="btn-outline admin-cache-delete-btn"
                  disabled={deletingId === entry.id}
                  onClick={() => handleDeleteCache(entry.id)}
                >
                  {deletingId === entry.id ? "⏳" : "🗑 Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cacheHasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            className="btn-outline"
            disabled={cacheLoading}
            onClick={() => cacheLastDoc && loadCacheEntries(cacheLastDoc)}
          >
            {cacheLoading ? "⏳ Loading…" : "Load More"}
          </button>
        </div>
      )}
    </>
  );
}
