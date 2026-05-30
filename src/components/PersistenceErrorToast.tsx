import { useCallback, useEffect, useRef, useState } from "react";
import {
  PERSISTENCE_ERROR_EVENT,
  type PersistenceErrorDetail,
} from "../lib/persistenceError";

const AUTO_DISMISS_MS = 8000;

/**
 * Global listener that turns background persistence failures (deck/card/profile
 * saves that previously failed silently) into a dismissible, screen-reader
 * announced toast.
 */
export function PersistenceErrorToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setMessage(null);
  }, [clearTimer]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PersistenceErrorDetail>).detail;
      if (!detail?.message) return;
      setMessage(detail.message);
      clearTimer();
      timerRef.current = window.setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
    };
    window.addEventListener(PERSISTENCE_ERROR_EVENT, handler);
    return () => {
      window.removeEventListener(PERSISTENCE_ERROR_EVENT, handler);
      clearTimer();
    };
  }, [clearTimer]);

  if (!message) return null;

  return (
    <div className="persistence-error-toast" role="alert" aria-live="assertive">
      <span className="persistence-error-toast__message">{message}</span>
      <button
        type="button"
        className="persistence-error-toast__close"
        onClick={dismiss}
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
