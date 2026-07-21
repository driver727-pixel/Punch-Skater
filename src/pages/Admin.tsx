import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  getDocs,
  setDoc,
  serverTimestamp,
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
import { resolveAdminActionUrl } from "../lib/apiUrls";
import type { CardPayload } from "../lib/types";
import { AdminCombinationStatsPanel } from "../components/AdminCombinationStatsPanel";
import { AdminPageBadge } from "../components/AdminPageBadge";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  tier?: TierLevel;
  isAdmin?: boolean;
  updatedAt?: { seconds: number };
}

const PAGE_SIZE = 20;

const ADMIN_API_URL = resolveAdminActionUrl("/api/admin/create-user");

const ADMIN_DELETE_API_URL = resolveAdminActionUrl("/api/admin/delete-user");

const TIER_LABELS: Record<string, string> = {
  free: TIERS.free.name,
  tier2: `${TIERS.tier2.name} (${TIERS.tier2.price})`,
  tier3: `${TIERS.tier3.name} (${TIERS.tier3.price})`,
};

// ── Player management panel ───────────────────────────────────────────────────

interface PlayerPanelProps {
  user: UserProfile;
  onClose: () => void;
}

function PlayerPanel({ user, onClose }: PlayerPanelProps) {
  const [cards, setCards] = useState<CardPayload[]>([]);
  const [decks, setDecks] = useState<Array<{ id: string; name?: string; cardIds?: string[] }>>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [panelSuccess, setPanelSuccess] = useState("");

  // Profile edit
  const [editDisplayName, setEditDisplayName] = useState(user.displayName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Card restore
  const [restoreJson, setRestoreJson] = useState("");
  const [restoringCard, setRestoringCard] = useState(false);

  const adminFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!auth?.currentUser) throw new Error("Not signed in.");
    const idToken = await auth.currentUser.getIdToken();
    return fetch(resolveAdminActionUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        ...(options.headers ?? {}),
      },
    });
  }, []);

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    setPanelError("");
    try {
      const res = await adminFetch(`/api/admin/player/${user.uid}/cards`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? "Failed to load cards.");
      }
      const data = await res.json();
      setCards(data.cards ?? []);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Failed to load cards.");
    } finally {
      setLoadingCards(false);
    }
  }, [adminFetch, user.uid]);

  const loadDecks = useCallback(async () => {
    setLoadingDecks(true);
    try {
      const res = await adminFetch(`/api/admin/player/${user.uid}/decks`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? "Failed to load decks.");
      }
      const data = await res.json();
      setDecks(data.decks ?? []);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Failed to load decks.");
    } finally {
      setLoadingDecks(false);
    }
  }, [adminFetch, user.uid]);

  useEffect(() => {
    void loadCards();
    void loadDecks();
  }, [loadCards, loadDecks]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanelError("");
    setPanelSuccess("");
    const trimmed = editDisplayName.trim();
    if (!trimmed) { setPanelError("Display name cannot be empty."); return; }
    setSavingProfile(true);
    try {
      const res = await adminFetch(`/api/admin/player/${user.uid}/profile`, {
        method: "PUT",
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? "Failed to save profile.");
      }
      await res.json();
      setPanelSuccess("✓ Profile saved.");
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm(`Delete card ${cardId}? This cannot be undone.`)) return;
    setPanelError("");
    try {
      const res = await adminFetch(`/api/admin/player/${user.uid}/cards/${cardId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete card.");
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setPanelSuccess(`✓ Card ${cardId} deleted.`);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Failed to delete card.");
    }
  };

  const handleRestoreCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanelError("");
    setPanelSuccess("");
    let parsed: CardPayload;
    try {
      parsed = JSON.parse(restoreJson) as CardPayload;
    } catch {
      setPanelError("Invalid JSON. Paste a valid card object.");
      return;
    }
    if (!parsed?.id) { setPanelError("Card JSON must have an `id` field."); return; }
    setRestoringCard(true);
    try {
      const res = await adminFetch(`/api/admin/player/${user.uid}/cards/${parsed.id}`, {
        method: "PUT",
        body: JSON.stringify(parsed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to restore card.");
      setRestoreJson("");
      setPanelSuccess(`✓ Card ${parsed.id} saved to player's collection.`);
      void loadCards();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Failed to restore card.");
    } finally {
      setRestoringCard(false);
    }
  };

  const handleDeleteDeck = async (deckId: string, deckName?: string) => {
    const label = deckName ? `"${deckName}"` : `deck ${deckId}`;
    if (!window.confirm(`Delete ${label}?`)) return;
    setPanelError("");
    try {
      const res = await adminFetch(`/api/admin/player/${user.uid}/decks/${deckId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete deck.");
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      setPanelSuccess(`✓ Deck deleted.`);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : "Failed to delete deck.");
    }
  };

  return (
    <div className="admin-player-panel">
      <div className="admin-player-panel-header">
        <div>
          <strong>{user.email}</strong>
          <span className="admin-uid" style={{ marginLeft: 8 }}>{user.uid}</span>
        </div>
        <button className="btn-outline" onClick={onClose}>✕ Close</button>
      </div>

      {panelError && <p className="admin-error">{panelError}</p>}
      {panelSuccess && <p className="admin-saved">{panelSuccess}</p>}

      {/* ── Profile edit ──────────────────────────────────────────────────── */}
      <section className="admin-player-section">
        <h3 className="admin-section-title">Profile Settings</h3>
        <form className="admin-create-form" onSubmit={handleSaveProfile}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <input
              className="input"
              type="text"
              placeholder="Display name"
              value={editDisplayName}
              onChange={(e) => setEditDisplayName(e.target.value)}
              maxLength={40}
              required
            />
          </div>
          <button className="btn-primary" type="submit" disabled={savingProfile}>
            {savingProfile ? "⏳ Saving…" : "Save Profile"}
          </button>
        </form>
      </section>

      {/* ── Collection ────────────────────────────────────────────────────── */}
      <section className="admin-player-section">
        <h3 className="admin-section-title">
          Collection ({cards.length} cards)
          {loadingCards && " ⏳"}
          <button className="btn-outline" style={{ marginLeft: 12, padding: "2px 10px" }} onClick={loadCards}>
            ↺ Refresh
          </button>
        </h3>

        {cards.length > 0 && (
          <div className="admin-table-wrap" style={{ maxHeight: 320 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rarity</th>
                  <th>ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id}>
                    <td>{card.identity?.name ?? "—"}</td>
                    <td>{card.class?.rarity ?? card.prompts?.rarity ?? "—"}</td>
                    <td><code className="admin-uid">{card.id.slice(0, 12)}…</code></td>
                    <td>
                      <button
                        className="btn-outline admin-delete-user-btn"
                        onClick={() => handleDeleteCard(card.id)}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingCards && cards.length === 0 && (
          <p className="admin-empty">No cards in collection.</p>
        )}

        {/* Restore card */}
        <div style={{ marginTop: 12 }}>
          <h4 className="admin-section-title" style={{ fontSize: "0.85rem" }}>Restore / Add Card (paste card JSON)</h4>
          <form onSubmit={handleRestoreCard} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <textarea
              className="input"
              style={{ flex: 1, minHeight: 72, fontFamily: "monospace", fontSize: "0.8rem" }}
              placeholder='{"id": "...", "identity": {...}, ...}'
              value={restoreJson}
              onChange={(e) => setRestoreJson(e.target.value)}
            />
            <button className="btn-primary" type="submit" disabled={restoringCard} style={{ whiteSpace: "nowrap" }}>
              {restoringCard ? "⏳ Saving…" : "Save Card"}
            </button>
          </form>
        </div>
      </section>

      {/* ── Decks ─────────────────────────────────────────────────────────── */}
      <section className="admin-player-section">
        <h3 className="admin-section-title">
          Decks ({decks.length})
          {loadingDecks && " ⏳"}
          <button className="btn-outline" style={{ marginLeft: 12, padding: "2px 10px" }} onClick={loadDecks}>
            ↺ Refresh
          </button>
        </h3>
        {decks.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cards</th>
                  <th>ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {decks.map((deck) => (
                  <tr key={deck.id}>
                    <td>{deck.name ?? "—"}</td>
                    <td>{deck.cardIds?.length ?? "—"}</td>
                    <td><code className="admin-uid">{deck.id.slice(0, 12)}…</code></td>
                    <td>
                      <button
                        className="btn-outline admin-delete-user-btn"
                        onClick={() => handleDeleteDeck(deck.id, deck.name)}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loadingDecks && decks.length === 0 && (
          <p className="admin-empty">No decks.</p>
        )}
      </section>
    </div>
  );
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
  const successTimerRef = useRef<number | null>(null);

  // Player management panel
  const [managingUser, setManagingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) clearTimeout(successTimerRef.current);
    };
  }, []);

  // ── Create user ────────────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const currentUserUid = auth?.currentUser?.uid ?? null;

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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        setCreateError(errData.error ?? "Failed to create user.");
      } else {
        const data = await res.json();
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
    if (!db) return;
    getCountFromServer(collection(db, "userProfiles"))
      .then((snap) => setTotalUsers(snap.data().count))
      .catch(() => {});
  }, []);

  // ── Load first page ────────────────────────────────────────────────────────
  const loadUsers = useCallback(async (after?: DocumentSnapshot) => {
    if (!db) return;
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
    if (!db) return;
    setSavingUid(uid);
    setSuccessUid(null);
    try {
      await setDoc(doc(db, "userProfiles", uid), { tier: newTier, updatedAt: serverTimestamp() }, { merge: true });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, tier: newTier } : u))
      );
      setSuccessUid(uid);
      successTimerRef.current = window.setTimeout(() => setSuccessUid(null), 2000);
    } catch (err) {
      console.error("Failed to set tier:", err);
      setError(`Failed to update tier for ${uid}.`);
    } finally {
      setSavingUid(null);
    }
  };

  const handleDeleteUser = async (uid: string, email: string) => {
    if (!auth?.currentUser) {
      setError("You must be signed in to delete users.");
      return;
    }
    if (uid === auth.currentUser.uid) {
      setError("You cannot delete the account you are currently using.");
      return;
    }
    if (!window.confirm(`Delete the account for ${email}? This removes their sign-in and stored data.`)) return;
    setDeletingUid(uid);
    setError("");
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch(ADMIN_DELETE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete user.");
        return;
      }
      setUsers((prev) => prev.filter((user) => user.uid !== uid));
      setFilteredUsers((prev) => prev.filter((user) => user.uid !== uid));
      setTotalUsers((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
    } catch (err) {
      console.error("Delete user error:", err);
      setError("Network error — could not reach the server.");
    } finally {
      setDeletingUid(null);
    }
  };

  const tierOptions: TierLevel[] = ["free", "tier2", "tier3"];

  return (
    <div className="page admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙ Admin Panel<AdminPageBadge /></h1>
          <p className="page-sub">Manage users and access tiers.</p>
        </div>
      </div>

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
                  placeholder="Password (12+ chars, upper/lower/number/symbol)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={12}
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

          {/* ── Combination coverage ───────────────────────────────────────── */}
          <AdminCombinationStatsPanel />

          {/* ── Player management panel ─────────────────────────────────────── */}
          {managingUser && (
            <PlayerPanel
              user={managingUser}
              onClose={() => setManagingUser(null)}
            />
          )}

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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="admin-empty">
                      {search ? "No users match your search." : "No users found."}
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => {
                  const effectiveTier: TierLevel = u.isAdmin ? "tier3" : (u.tier ?? "free");
                  return (
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
                        <span className={`admin-tier-tag admin-tier-tag--${effectiveTier}`}>
                          {TIER_LABELS[effectiveTier] ?? effectiveTier}
                        </span>
                      </td>
                      <td>
                        {u.isAdmin ? (
                          <span className="admin-saved">Deck Master locked</span>
                        ) : successUid === u.uid ? (
                          <span className="admin-saved">✓ Saved</span>
                        ) : (
                          <div className="admin-tier-select-wrap">
                            <select
                              className="admin-tier-select"
                              value={effectiveTier}
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
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            className="btn-outline"
                            onClick={() => setManagingUser(managingUser?.uid === u.uid ? null : u)}
                          >
                            {managingUser?.uid === u.uid ? "✕ Close" : "✏ Manage"}
                          </button>
                          <button
                            className="btn-outline admin-delete-user-btn"
                            disabled={deletingUid === u.uid || currentUserUid === u.uid}
                            onClick={() => handleDeleteUser(u.uid, u.email)}
                          >
                            {currentUserUid === u.uid
                              ? "Current account"
                              : deletingUid === u.uid
                                ? "⏳ Deleting…"
                                : "🗑 Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
