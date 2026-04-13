import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth, firebaseUnavailableMessage } from "../lib/firebase";

type Step = "loading" | "form" | "success" | "invalid";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const oobCode = searchParams.get("oobCode") ?? "";

  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) {
      setError(firebaseUnavailableMessage);
      setStep("invalid");
      return;
    }
    if (!oobCode) {
      setStep("invalid");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setStep("form");
      })
      .catch(() => setStep("invalid"));
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setError(firebaseUnavailableMessage);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStep("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("expired-action-code") || msg.includes("invalid-action-code")) {
        setError("This reset link has expired or already been used. Please request a new one.");
      } else if (msg.includes("weak-password")) {
        setError("Password must be at least 6 characters.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page login-page">
      <div className="login-card">
        <div className="login-logo">⚡</div>
        <h1 className="login-title">Punch Skater</h1>
        <p className="login-subtitle">DECK BUILDER</p>
        <p className="login-game-badge"><a href="https://sk8rpunk.com" target="_blank" rel="noopener noreferrer">A Sk8r Punk Game</a></p>

        {step === "loading" && (
          <p className="login-hint">Verifying your reset link…</p>
        )}

        {step === "invalid" && (
          <>
            <p className="login-error" style={{ textAlign: "center", marginBottom: 16 }}>
              {error || "This reset link is invalid or has expired."}
            </p>
            <button className="btn-primary btn-lg" onClick={() => navigate("/login")}>
              Back to Sign In
            </button>
          </>
        )}

        {step === "form" && (
          <form className="login-form" onSubmit={handleSubmit}>
            <p className="login-hint">
              Setting a new password for <strong>{email}</strong>.
            </p>
            <div className="form-group">
              <label>New Password</label>
              <div className="password-input-wrapper">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span aria-hidden="true">{showPassword ? "🙈" : "👁"}</span>
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  className="input"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  <span aria-hidden="true">{showConfirm ? "🙈" : "👁"}</span>
                </button>
              </div>
            </div>
            {error && <p className="login-error">{error}</p>}
            <button className="btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? "⏳ Saving…" : "Set New Password"}
            </button>
          </form>
        )}

        {step === "success" && (
          <>
            <p className="login-success" style={{ textAlign: "center", marginBottom: 16 }}>
              ✓ Password changed! You can now sign in with your new password.
            </p>
            <button className="btn-primary btn-lg" onClick={() => navigate("/login")}>
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
