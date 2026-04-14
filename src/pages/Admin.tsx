import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  query,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { TIERS, type TierLevel } from "../lib/tiers";
import { resolveApiUrl } from "../lib/apiUrls";
import { listCachedImages, deleteCachedImage, type CacheEntry } from "../services/imageCache";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  tier?: TierLevel;
  isAdmin?: boolean;
  updatedAt?: { seconds: number };
}

const PAGE_SIZE = 20;

const ADMIN_API_URL = resolveApiUrl(
  import.meta.env.VITE_ADMIN_API_URL as string | undefined,
  "/api/admin/create-user",
);

const TIER_LABELS: Record<string, string> = {
  free: TIERS.free.name,
  tier2: `${TIERS.tier2.name} (${TIERS.tier2.price})`,
  tier3: `${TIERS.tier3.name} (${TIERS.tier3.price})`,
};

const LAYER_LABELS: Record<string, string> = {
  background: "🌆 Background",
  character:  "🧍 Character",
  frame:      "🖼 Frame",
  "board-img": "🛹 Board",
};

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString();
}

export function Admin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [successUid, setSuccessUid] = useState<string | null>(null);

  // ── Create user ────────────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Image cache ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"users" | "cache">("users");
  const [cacheEntries, setCacheEntries] = useState<CacheEntry[]>([]);
  const [cacheLastDoc, setCacheLastDoc] = useState<DocumentSnapshot | null>(null);
  const [cacheHasMore, setCacheHasMore] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheError, setCacheError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    if (!auth?.currentUser) {
      setCreateError("You must be signed in to create users.");
      return;
    }
    setCreating(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(ADMIN_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create user.");
      } else {
        setCreateSuccess(`✓ Account created for ${data.email}`);
        setNewEmail("");
        setNewPassword("");
      }
    } catch (err) {
      console.error("Create user error:", err);
      setCreateError("Network error — could not reach the server.");
    } finally {
      setCreating(false);
    }
  }, [newEmail, newPassword]);

  // ── Fetch user count ───────────────────────────────────────────────────────
  useEffect(() => {
    getCountFromServer(collection(db, "userProfiles"))
      .then((snap) => setTotalUsers(snap.data().count))
      .catch(() => {});
  }, []);

  // ── Load first page ────────────────────────────────────────────────────────
  const loadUsers = useCallback(async (after?: DocumentSnapshot) => {
    setLoading(true);
    setError("");
    try {
      const q = after
        ? query(collection(db, "userProfiles"), orderBy("updatedAt", "desc"), startAfter(after), limit(PAGE_SIZE))
        : query(collection(db, "userProfiles"), orderBy("updatedAt", "desc"), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const batch = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers((prev) => (after ? [...prev, ...batch] : batch));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      setError("Failed to load users. Make sure you have admin access.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ── Filter by search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) {
      setFilteredUsers(users);
      return;
    }
    const q = search.toLowerCase();
    setFilteredUsers(
      users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.displayName?.toLowerCase().includes(q) ||
          u.uid.toLowerCase().includes(q)
      )
    );
  }, [search, users]);

  // ── Set tier for a user ────────────────────────────────────────────────────
  const handleSetTier = async (uid: string, newTier: TierLevel) => {
    setSavingUid(uid);
    setSuccessUid(null);
    try {
      await setDoc(doc(db, "userProfiles", uid), { tier: newTier }, { merge: true });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, tier: newTier } : u))
      );
      setSuccessUid(uid);
      setTimeout(() => setSuccessUid(null), 2000);
    } catch (err) {
      console.error("Failed to set tier:", err);
      setError(`Failed to update tier for ${uid}.`);
    } finally {
      setSavingUid(null);
    }
  };

  // ── Load image cache entries ───────────────────────────────────────────────
  const loadCacheEntries = useCallback(async (after?: DocumentSnapshot) => {
    setCacheLoading(true);
    setCacheError("");
    try {
      const result = await listCachedImages(after);
      setCacheEntries((prev) => (after ? [...prev, ...result.entries] : result.entries));
      setCacheLastDoc(result.lastDoc);
      setCacheHasMore(result.hasMore);
      setCacheLoaded(true);
    } catch (err) {
      setCacheError("Failed to load cache entries. Make sure you have admin access.");
      console.error(err);
    } finally {
      setCacheLoading(false);
    }
  }, []);

  // Load cache entries when switching to the cache tab for the first time
  useEffect(() => {
    if (activeTab === "cache" && !cacheLoaded) {
      loadCacheEntries();
    }
  }, [activeTab, cacheLoaded, loadCacheEntries]);

  // ── Delete a cache entry ───────────────────────────────────────────────────
  const handleDeleteCache = async (id: string) => {
    if (!window.confirm("Delete this cache entry? The image will be regenerated next time this card is forged.")) return;
    setDeletingId(id);
    try {
      await deleteCachedImage(id);
      setCacheEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete cache entry:", err);
      setCacheError("Failed to delete entry. Check you have admin permissions.");
    } finally {
      setDeletingId(null);
    }
  };

  const tierOptions: TierLevel[] = ["free", "tier2", "tier3"];

  return (
    <div className="page admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙ Admin Panel</h1>
          <p className="page-sub">Manage users, access tiers, and image cache.</p>
        </div>
      </div>

      {/* ── Tab switcher ───────────────────────────────────────────────────── */}
      <div className="admin-tabs">
        <button
          className={`admin-tab${activeTab === "users" ? " admin-tab--active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          👤 Users
        </button>
        <button
          className={`admin-tab${activeTab === "cache" ? " admin-tab--active" : ""}`}
          onClick={() => setActiveTab("cache")}
        >
          🖼 Image Cache
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          USERS TAB
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "users" && (
        <>
          {/* ── Create user ────────────────────────────────────────────────── */}
          <div className="admin-create-user">
            <h2 className="admin-section-title">Create New Account</h2>
            <form className="admin-create-form" onSubmit={handleCreateUser}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  className="input"
                  type="password"
                  placeholder="Password (min. 10 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
              </div>
              <button className="btn-primary" type="submit" disabled={creating}>
                {creating ? "⏳ Creating…" : "Create Account"}
              </button>
            </form>
            {createError && <p className="admin-error">{createError}</p>}
            {createSuccess && <p className="admin-saved" style={{ marginTop: 8 }}>{createSuccess}</p>}
          </div>

          {/* ── Stats row ──────────────────────────────────────────────────── */}
          <div className="admin-stats-row">
            <div className="admin-stat-card">
              <span className="admin-stat-label">Total Users</span>
              <span className="admin-stat-value">
                {totalUsers !== null ? totalUsers : "—"}
              </span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-label">Loaded</span>
              <span className="admin-stat-value">{users.length}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-label">Tier3 (Deck Master)</span>
              <span className="admin-stat-value">
                {users.filter((u) => u.tier === "tier3" || u.isAdmin).length}
              </span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-label">Tier2 (Street Creator)</span>
              <span className="admin-stat-value">
                {users.filter((u) => u.tier === "tier2" && !u.isAdmin).length}
              </span>
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────────────────── */}
          <div className="admin-search-row">
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <input
                className="input"
                type="text"
                placeholder="Search by email, name, or UID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn-outline"
              onClick={() => { setSearch(""); setUsers([]); setLastDoc(null); loadUsers(); }}
            >
              Refresh
            </button>
          </div>

          {error && <p className="admin-error">{error}</p>}

          {/* ── User table ─────────────────────────────────────────────────── */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>UID</th>
                  <th>Tier</th>
                  <th>Set Tier</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      {search ? "No users match your search." : "No users found."}
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className={u.isAdmin ? "admin-row--admin" : ""}>
                    <td>
                      <div className="admin-user-email">
                        {u.email}
                        {u.isAdmin && (
                          <span className="admin-badge admin-badge--admin">ADMIN</span>
                        )}
                      </div>
                      <div className="admin-user-name">{u.displayName}</div>
                    </td>
                    <td>
                      <code className="admin-uid">{u.uid.slice(0, 12)}…</code>
                    </td>
                    <td>
                      <span className={`admin-tier-tag admin-tier-tag--${u.tier ?? "free"}`}>
                        {TIER_LABELS[u.tier ?? "free"] ?? u.tier ?? "free"}
                      </span>
                    </td>
                    <td>
                      {successUid === u.uid ? (
                        <span className="admin-saved">✓ Saved</span>
                      ) : (
                        <div className="admin-tier-select-wrap">
                          <select
                            className="admin-tier-select"
                            value={u.tier ?? "free"}
                            disabled={savingUid === u.uid}
                            onChange={(e) =>
                              handleSetTier(u.uid, e.target.value as TierLevel)
                            }
                          >
                            {tierOptions.map((t) => (
                              <option key={t} value={t}>
                                {TIERS[t].name}
                              </option>
                            ))}
                          </select>
                          {savingUid === u.uid && (
                            <span className="admin-saving">⏳</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && (
              <div className="admin-loading">⏳ Loading users…</div>
            )}
          </div>

          {hasMore && !search && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                className="btn-outline"
                disabled={loading}
                onClick={() => lastDoc && loadUsers(lastDoc)}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          IMAGE CACHE TAB
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "cache" && (
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
                  setCacheLoaded(false);
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

          {!cacheLoading && cacheLoaded && cacheEntries.length === 0 && (
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
      )}
    </div>
  );
}
