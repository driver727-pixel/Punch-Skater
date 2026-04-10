import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, RecaptchaVerifier } from "../context/AuthContext";
import { auth, firebaseUnavailableMessage } from "../lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

export function Login() {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset, signInWithPhone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";
  const isAuthUnavailable = !auth;

  const [mode, setMode] = useState<"signin" | "signup" | "phone">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Phone auth
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"number" | "code">("number");
  const [smsCode, setSmsCode] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifierRef = useRef<InstanceType<typeof RecaptchaVerifier> | null>(null);

  // Cleanup recaptcha on unmount
  useEffect(() => {
    return () => clearRecaptcha();
  }, []);

  const clearRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
  };

  const switchMode = (next: "signin" | "signup" | "phone") => {
    setMode(next);
    setError("");
    setForgotMode(false);
    setForgotSuccess(false);
    setPhoneStep("number");
    setSmsCode("");
    setPhone("");
    clearRecaptcha();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(friendlyError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(friendlyError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordReset(forgotEmail.trim());
      setForgotSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(friendlyError(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recaptchaContainerRef.current) return;
    if (!auth) {
      setError(firebaseUnavailableMessage);
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          auth,
          recaptchaContainerRef.current,
          { size: "invisible" }
        );
      }
      const result = await signInWithPhone(phone.trim(), recaptchaVerifierRef.current);
      confirmationRef.current = result;
      setPhoneStep("code");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(friendlyError(msg));
      clearRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationRef.current) return;
    setError("");
    setLoading(true);
    try {
      await confirmationRef.current.confirm(smsCode.trim());
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(friendlyError(msg));
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
        <p className="login-game-badge">A Sk8r Punk Game</p>
        {isAuthUnavailable && <p className="login-error">{firebaseUnavailableMessage}</p>}

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === "signin" ? "login-tab--active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            className={`login-tab ${mode === "signup" ? "login-tab--active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Create Account
          </button>
          <button
            className={`login-tab ${mode === "phone" ? "login-tab--active" : ""}`}
            onClick={() => switchMode("phone")}
          >
            📱 Phone
          </button>
        </div>

        {/* ── Forgot password view ── */}
        {forgotMode ? (
          <form className="login-form" onSubmit={handleForgotPassword}>
            <p className="login-hint">Enter your email to receive a password reset link.</p>
            <div className="form-group">
              <label>Email</label>
              <input
                className="input"
                type="email"
                placeholder="your@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            {forgotSuccess && (
              <p className="login-success">✓ Reset link sent! Check your inbox.</p>
            )}
            <button className="btn-primary btn-lg" type="submit" disabled={loading || forgotSuccess}>
              {loading ? "⏳ Please wait…" : "Send Reset Link"}
            </button>
            <button
              type="button"
              className="login-back-btn"
              onClick={() => { setForgotMode(false); setForgotSuccess(false); setError(""); }}
            >
              ← Back to Sign In
            </button>
          </form>
        ) : mode === "phone" ? (
          /* ── Phone sign-in view ── */
          phoneStep === "number" ? (
            <form className="login-form" onSubmit={handleSendSms}>
              <p className="login-hint">Enter your phone number with country code (e.g. +1 555 000 1234).</p>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+1 555 000 1234"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </div>
              {error && <p className="login-error">{error}</p>}
              <div ref={recaptchaContainerRef} />
              <button className="btn-primary btn-lg" type="submit" disabled={loading}>
                {loading ? "⏳ Sending code…" : "Send SMS Code"}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleVerifyCode}>
              <p className="login-hint">Enter the 6-digit code sent to {phone}.</p>
              <div className="form-group">
                <label>Verification Code</label>
                <input
                  className="input"
                  type="text"
                  placeholder="123456"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              </div>
              {error && <p className="login-error">{error}</p>}
              <button className="btn-primary btn-lg" type="submit" disabled={loading}>
                {loading ? "⏳ Verifying…" : "Verify Code"}
              </button>
              <button
                type="button"
                className="login-back-btn"
                onClick={() => { setPhoneStep("number"); setError(""); setSmsCode(""); }}
              >
                ← Change Number
              </button>
            </form>
          )
        ) : (
          /* ── Email sign-in / sign-up view ── */
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                className="input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Min. 6 characters" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
            {mode === "signup" && (
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
            )}
            {mode === "signin" && (
              <button
                type="button"
                className="login-forgot-btn"
                onClick={() => { setForgotMode(true); setForgotEmail(email); setError(""); }}
              >
                Forgot password?
              </button>
            )}
            {error && <p className="login-error">{error}</p>}
            <button className="btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? "⏳ Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>
        )}

        {mode !== "phone" && !forgotMode && (
          <>
            <div className="login-divider"><span>or</span></div>

            <button className="btn-google" onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <p className="login-guest">
          <button className="login-guest-btn" onClick={() => navigate("/")}>
            Continue as guest →
          </button>
        </p>
      </div>
    </div>
  );
}

function friendlyError(msg: string): string {
  if (msg === firebaseUnavailableMessage) return msg;
  if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
    return "Invalid email or password.";
  }
  if (msg.includes("email-already-in-use")) return "An account with this email already exists.";
  if (msg.includes("weak-password")) return "Password must be at least 6 characters.";
  if (msg.includes("invalid-email")) return "Please enter a valid email address.";
  if (msg.includes("popup-closed-by-user")) return "Sign-in cancelled.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection.";
  if (msg.includes("invalid-phone-number")) return "Please enter a valid phone number with country code.";
  if (msg.includes("invalid-verification-code") || msg.includes("code-expired")) return "Invalid or expired verification code.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please try again later.";
  return "Something went wrong. Please try again.";
}
