/**
 * persistenceError.ts
 *
 * Lightweight cross-cutting channel for surfacing background save/sync
 * failures to the user. Several hooks persist to Firestore in fire-and-forget
 * fashion; previously those rejections were swallowed with `console.error`,
 * leaving the UI looking like the change saved when it did not.
 *
 * `reportPersistenceError` logs the underlying error (for debugging) and emits
 * a DOM CustomEvent that the global `<PersistenceErrorToast>` listens for, so a
 * dismissible message is shown without each call site needing its own UI.
 */

export const PERSISTENCE_ERROR_EVENT = "ps:persistence-error";

export interface PersistenceErrorDetail {
  message: string;
}

/**
 * Reports a failed background persistence operation.
 *
 * @param message - A short, user-facing description of what failed to save.
 * @param error - The underlying error (logged to the console for debugging).
 */
export function reportPersistenceError(message: string, error?: unknown): void {
  if (error !== undefined) {
    console.error(message, error);
  } else {
    console.error(message);
  }

  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PersistenceErrorDetail>(PERSISTENCE_ERROR_EVENT, {
      detail: { message },
    }),
  );
}
