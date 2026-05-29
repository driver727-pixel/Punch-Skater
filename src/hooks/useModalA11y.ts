import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface UseModalA11yOptions {
  /** Called when the user requests to close the dialog (Escape key). */
  onClose?: () => void;
  /** When false, the hook is inert (listeners detached, focus untouched). Defaults to true. */
  active?: boolean;
  /** When false, Escape will not close the dialog. Defaults to true. */
  closeOnEscape?: boolean;
}

/**
 * Shared accessibility behaviour for modal dialogs:
 *  - Closes on the Escape key.
 *  - Moves focus into the dialog on open and keeps Tab focus trapped inside it.
 *  - Restores focus to the previously focused element on close.
 *
 * Attach the returned ref to the dialog container (the element carrying
 * `role="dialog"`).
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  onClose,
  active = true,
  closeOnEscape = true,
}: UseModalA11yOptions = {}) {
  const containerRef = useRef<T | null>(null);

  const getFocusable = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  // Move focus into the dialog on open and restore it on close.
  useEffect(() => {
    if (!active) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (container) {
      const focusable = getFocusable();
      const target = focusable[0] ?? container;
      // Ensure the container itself can receive focus as a last resort.
      if (target === container && !container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      // Defer so the element is painted before focusing.
      window.requestAnimationFrame(() => target.focus());
    }
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, getFocusable]);

  // Keyboard handling: Escape to close, Tab to cycle focus inside the dialog.
  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (closeOnEscape && onClose) {
          event.stopPropagation();
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeEl === first || !containerRef.current?.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !containerRef.current?.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, closeOnEscape, onClose, getFocusable]);

  return containerRef;
}
