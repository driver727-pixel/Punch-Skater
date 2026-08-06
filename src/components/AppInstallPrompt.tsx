import { useEffect, useState } from "react";

interface DeferredInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandaloneMode extends Navigator {
  standalone?: boolean;
}

const DISMISSAL_KEY = "punch-skater-install-prompt-dismissed-at";
const REMINDER_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as NavigatorWithStandaloneMode).standalone === true;
}

function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

function wasDismissedRecently() {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISSAL_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REMINDER_DELAY_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSAL_KEY, String(Date.now()));
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

export function AppInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(wasDismissedRecently);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncInstalledState = () => setInstalled(isStandalone());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPromptEvent);
      setShowIosSteps(false);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    syncInstalledState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener("change", syncInstalledState);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayMode.removeEventListener("change", syncInstalledState);
    };
  }, []);

  const dismiss = () => {
    rememberDismissal();
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) {
      setShowIosSteps(true);
      return;
    }

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismiss();
    } finally {
      setInstalling(false);
    }
  };

  const canInstall = deferredPrompt !== null;
  const canShowIosInstructions = isAppleMobileDevice();

  if (installed || dismissed || (!canInstall && !canShowIosInstructions)) return null;

  return (
    <aside className="app-install-prompt" data-testid="app-install-prompt" aria-label="Install Punch Skater">
      <div className="app-install-prompt__copy">
        <strong>Play Punch Skater as an app</strong>
        <span>Install for a full-screen game, a home-screen icon, and offline-ready game assets.</span>
      </div>
      <div className="app-install-prompt__actions">
        <button
          type="button"
          className="app-install-prompt__install"
          onClick={() => void install()}
          disabled={installing}
        >
          {installing ? "Opening install…" : "Install app"}
        </button>
        <button type="button" className="app-install-prompt__dismiss" onClick={dismiss} aria-label="Dismiss install prompt">
          Not now
        </button>
      </div>
      {showIosSteps && (
        <p className="app-install-prompt__ios-steps">
          In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
        </p>
      )}
    </aside>
  );
}
