import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sfxClick } from "../lib/sfx";
import { resolveCraftlinguaShareCode } from "../services/craftlingua";

export function AccountSettings() {
  const {
    user,
    userProfile,
    changePassword,
    changeDisplayName,
    deleteAccount,
    signOut,
    updateCraftlinguaLink,
  } = useAuth();
  const navigate = useNavigate();

  // Display name
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameSuccess, setNameSuccess] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [shareCode, setShareCode] = useState(userProfile?.craftlinguaLink?.shareCode ?? "");
  const [shareCodeError, setShareCodeError] = useState("");
  const [shareCodeSuccess, setShareCodeSuccess] = useState("");
  const [shareCodeLoading, setShareCodeLoading] = useState(false);

  useEffect(() => {
    setShareCode(userProfile?.craftlinguaLink?.shareCode ?? "");
  }, [userProfile?.craftlinguaLink?.shareCode]);

  const isEmailUser = !!user?.email && user.providerData.some(p => p.providerId === "password");

  const handleDisplayNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");
    setNameSuccess("");
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError("Display name cannot be empty.");
      return;
    }
    if (trimmed === user?.displayName) {
      setNameError("That is already your display name.");
      return;
    }
    setNameLoading(true);
    try {
      await changeDisplayName(trimmed);
      setNameSuccess("Display name updated!");
    } catch (err: unknown) {
      setNameError(friendlyError(err));
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPwError(friendlyError(err));
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleteLoading(true);
    try {
      await deleteAccount(deletePassword);
      await signOut();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setDeleteError(friendlyError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCraftlinguaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareCodeError("");
    setShareCodeSuccess("");
    const trimmed = shareCode.trim();
    if (!trimmed) {
      setShareCodeError("Paste a CraftLingua share code first.");
      return;
    }
    setShareCodeLoading(true);
    try {
      const link = await resolveCraftlinguaShareCode(trimmed);
      await updateCraftlinguaLink(link);
      setShareCode(link.shareCode);
      setShareCodeSuccess(`${link.languageName} linked to your account.`);
    } catch (err: unknown) {
      setShareCodeError(friendlyError(err));
    } finally {
      setShareCodeLoading(false);
    }
  };

  const handleCraftlinguaClear = async () => {
    setShareCodeError("");
    setShareCodeSuccess("");
    setShareCodeLoading(true);
    try {
      await updateCraftlinguaLink(null);
      setShareCode("");
      setShareCodeSuccess("CraftLingua link removed.");
    } catch (err: unknown) {
      setShareCodeError(friendlyError(err));
    } finally {
      setShareCodeLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Account Settings</h1>
      <p className="page-sub">Manage your profile and security</p>

      <div className="account-settings">
        {/* Profile Info */}
        <section className="account-section">
          <h2 className="account-section-title">Profile</h2>
          <div className="account-info-row">
            <span className="account-info-label">Email</span>
            <span className="account-info-value">{user?.email ?? "N/A"}</span>
          </div>
          <div className="account-info-row">
            <span className="account-info-label">Sign-in method</span>
            <span className="account-info-value">
              {user?.providerData.map(p => providerLabel(p.providerId)).join(", ") || "Unknown"}
            </span>
          </div>

          <form className="account-form" onSubmit={handleDisplayNameSubmit}>
            <div className="form-group">
              <label>Display Name</label>
              <input
                className="input"
                type="text"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); setNameSuccess(""); setNameError(""); }}
                maxLength={40}
                required
                autoComplete="name"
              />
            </div>
            {nameError && <p className="login-error">{nameError}</p>}
            {nameSuccess && <p className="login-success">{nameSuccess}</p>}
            <button className="btn-primary" type="submit" disabled={nameLoading}>
              {nameLoading ? "⏳ Saving…" : "Update Display Name"}
            </button>
          </form>
        </section>

        {/* Change Password */}
        {isEmailUser && (
          <section className="account-section">
            <h2 className="account-section-title">Change Password</h2>
            <form className="account-form" onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label>Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    className="input"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setPwError(""); setPwSuccess(""); }}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => { sfxClick(); setShowCurrent(v => !v); }}
                    aria-label={showCurrent ? "Hide password" : "Show password"}
                  >
                    <span aria-hidden="true">{showCurrent ? "🙈" : "👁"}</span>
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    className="input"
                    type={showNew ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPwError(""); setPwSuccess(""); }}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => { sfxClick(); setShowNew(v => !v); }}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    <span aria-hidden="true">{showNew ? "🙈" : "👁"}</span>
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    className="input"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPwError(""); setPwSuccess(""); }}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => { sfxClick(); setShowConfirm(v => !v); }}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <span aria-hidden="true">{showConfirm ? "🙈" : "👁"}</span>
                  </button>
                </div>
              </div>
              {pwError && <p className="login-error">{pwError}</p>}
              {pwSuccess && <p className="login-success">{pwSuccess}</p>}
              <button className="btn-primary" type="submit" disabled={pwLoading}>
                {pwLoading ? "⏳ Saving…" : "Change Password"}
              </button>
            </form>
          </section>
        )}

        <section className="account-section">
          <h2 className="account-section-title">CraftLingua Language Link</h2>
          <p className="account-section-copy">
            Link one of the Codex district languages to use its share code for Rare and Legendary flavor text.
          </p>
          {userProfile?.craftlinguaLink && (
            <div className="account-info-row">
              <span className="account-info-label">Current language</span>
              <span className="account-info-value">
                {userProfile.craftlinguaLink.languageName} ({userProfile.craftlinguaLink.languageCode})
              </span>
            </div>
          )}
          <form className="account-form" onSubmit={handleCraftlinguaSubmit}>
            <div className="form-group">
              <label>CraftLingua Share Code</label>
              <input
                className="input"
                type="text"
                value={shareCode}
                onChange={(e) => { setShareCode(e.target.value); setShareCodeError(""); setShareCodeSuccess(""); }}
                placeholder="CL-GRID-MESH"
                autoCapitalize="characters"
                maxLength={64}
              />
            </div>
            {userProfile?.craftlinguaLink?.exploreUrl && (
              <p className="account-help-text">
                Explore current link:{" "}
                <a href={userProfile.craftlinguaLink.exploreUrl} target="_blank" rel="noopener noreferrer">
                  {userProfile.craftlinguaLink.languageName} ↗
                </a>
              </p>
            )}
            {shareCodeError && <p className="login-error">{shareCodeError}</p>}
            {shareCodeSuccess && <p className="login-success">{shareCodeSuccess}</p>}
            <div className="account-inline-actions">
              <button className="btn-primary" type="submit" disabled={shareCodeLoading}>
                {shareCodeLoading ? "⏳ Validating…" : "Link Language"}
              </button>
              {userProfile?.craftlinguaLink && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => { sfxClick(); void handleCraftlinguaClear(); }}
                  disabled={shareCodeLoading}
                >
                  Clear Link
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="account-section account-section--danger">
          <h2 className="account-section-title account-section-title--danger">Danger Zone</h2>
          {!showDeleteConfirm ? (
            <button
              className="btn-danger"
              onClick={() => { sfxClick(); setShowDeleteConfirm(true); }}
            >
              🗑 Delete Account
            </button>
          ) : (
            <form className="account-form" onSubmit={handleDeleteAccount}>
              <p className="login-error account-delete-warning">
                This action is <strong>permanent</strong>. All your data will be lost.
              </p>
              {isEmailUser && (
                <div className="form-group">
                  <label>Enter your password to confirm</label>
                  <input
                    className="input"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }}
                    required
                    autoComplete="current-password"
                  />
                </div>
              )}
              {deleteError && <p className="login-error">{deleteError}</p>}
              <div className="account-danger-actions">
                <button className="btn-danger" type="submit" disabled={deleteLoading}>
                  {deleteLoading ? "⏳ Deleting…" : "Permanently Delete Account"}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => { sfxClick(); setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function providerLabel(providerId: string): string {
  switch (providerId) {
    case "password": return "Email/Password";
    case "google.com": return "Google";
    case "phone": return "Phone";
    default: return providerId;
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
    return "Current password is incorrect.";
  }
  if (msg.includes("weak-password")) return "New password must be at least 6 characters.";
  if (msg.includes("requires-recent-login")) return "Please sign out and sign back in, then try again.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please try again later.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection.";
  if (msg.toLowerCase().includes("share code")) return "That CraftLingua share code could not be found.";
  return "Something went wrong. Please try again.";
}
