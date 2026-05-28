/**
 * TerminalRouterContext — phase 1 of the Unified Terminal SPA shell.
 *
 * Tracks the active terminal view (Hub, Forge, …) and bridges to
 * react-router-dom for URL sync (deep links, refresh, browser back/forward)
 * without unmounting page components on every navigation.
 *
 * Phase 1 registers Hub (`/`) and Forge (`/forge`). Additional panels are
 * added to TERMINAL_VIEWS as they are migrated; URLs that are not in the
 * registry fall through to legacy `<Routes>`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type TerminalViewId = "hub" | "forge";

export type SlideDirection = "forward" | "back" | "none";

interface TerminalViewDescriptor {
  id: TerminalViewId;
  /** Canonical URL pathname for this view. */
  path: string;
  /** Human-readable label used by the persistent HUD. */
  label: string;
}

/* eslint-disable react-refresh/only-export-components */
export const TERMINAL_VIEWS: readonly TerminalViewDescriptor[] = [
  { id: "hub", path: "/", label: "Hub" },
  { id: "forge", path: "/forge", label: "Forge" },
] as const;

const VIEW_BY_PATH = new Map<string, TerminalViewDescriptor>(
  TERMINAL_VIEWS.map((v) => [v.path, v] as const),
);
const VIEW_BY_ID = new Map<TerminalViewId, TerminalViewDescriptor>(
  TERMINAL_VIEWS.map((v) => [v.id, v] as const),
);

export function getTerminalViewForPath(pathname: string): TerminalViewDescriptor | null {
  return VIEW_BY_PATH.get(pathname) ?? null;
}

export function isTerminalPath(pathname: string): boolean {
  return VIEW_BY_PATH.has(pathname);
}

export interface TerminalNavigateOptions {
  /** Reset scroll position on arrival instead of restoring the snapshot. */
  resetScroll?: boolean;
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

interface TerminalRouterContextValue {
  activeView: TerminalViewId;
  previousView: TerminalViewId | null;
  direction: SlideDirection;
  views: readonly TerminalViewDescriptor[];
  navigate: (viewId: TerminalViewId, options?: TerminalNavigateOptions) => void;
  /** Per-panel scroll snapshot map (mutated by TerminalPanel). */
  scrollMemoryRef: React.MutableRefObject<Map<TerminalViewId, number>>;
  /** Flag honoured by TerminalPanel to skip scroll restore once. */
  consumeResetScroll: (viewId: TerminalViewId) => boolean;
}

const TerminalRouterContext = createContext<TerminalRouterContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Optional fallback view if URL is not a registered terminal path on mount. */
  fallbackView?: TerminalViewId;
}

export function TerminalRouterProvider({ children, fallbackView = "hub" }: ProviderProps) {
  const location = useLocation();
  const routerNavigate = useNavigate();

  const initialView = useMemo<TerminalViewId>(() => {
    return getTerminalViewForPath(location.pathname)?.id ?? fallbackView;
  }, [location.pathname, fallbackView]);

  const [activeView, setActiveView] = useState<TerminalViewId>(initialView);
  const [previousView, setPreviousView] = useState<TerminalViewId | null>(null);
  const [direction, setDirection] = useState<SlideDirection>("none");
  const historyRef = useRef<TerminalViewId[]>([initialView]);
  const scrollMemoryRef = useRef<Map<TerminalViewId, number>>(new Map());
  const resetScrollRef = useRef<Set<TerminalViewId>>(new Set());

  const applyView = useCallback(
    (nextView: TerminalViewId, hint: SlideDirection) => {
      setActiveView((current) => {
        if (current === nextView) return current;
        setPreviousView(current);
        setDirection(hint);
        return nextView;
      });
    },
    [],
  );

  // Sync state when the URL changes (deep link, back/forward button, etc.).
  useEffect(() => {
    const target = getTerminalViewForPath(location.pathname);
    if (!target) return;
    if (target.id === activeView) return;
    const stack = historyRef.current;
    // If the URL change matches the previous stack entry, treat as back.
    const isBack = stack.length >= 2 && stack[stack.length - 2] === target.id;
    if (isBack) {
      stack.pop();
    } else {
      stack.push(target.id);
    }
    applyView(target.id, isBack ? "back" : "forward");
  }, [location.pathname, activeView, applyView]);

  const navigate = useCallback(
    (viewId: TerminalViewId, options?: TerminalNavigateOptions) => {
      const target = VIEW_BY_ID.get(viewId);
      if (!target) return;
      if (options?.resetScroll) {
        resetScrollRef.current.add(viewId);
      }
      const stack = historyRef.current;
      const isBack = stack.length >= 2 && stack[stack.length - 2] === viewId;
      if (isBack) {
        stack.pop();
      } else if (stack[stack.length - 1] !== viewId) {
        stack.push(viewId);
      }
      if (location.pathname !== target.path) {
        routerNavigate(target.path, { replace: options?.replace });
      } else {
        applyView(viewId, isBack ? "back" : "forward");
      }
    },
    [applyView, location.pathname, routerNavigate],
  );

  const consumeResetScroll = useCallback((viewId: TerminalViewId) => {
    if (resetScrollRef.current.has(viewId)) {
      resetScrollRef.current.delete(viewId);
      return true;
    }
    return false;
  }, []);

  const value = useMemo<TerminalRouterContextValue>(
    () => ({
      activeView,
      previousView,
      direction,
      views: TERMINAL_VIEWS,
      navigate,
      scrollMemoryRef,
      consumeResetScroll,
    }),
    [activeView, previousView, direction, navigate, consumeResetScroll],
  );

  return (
    <TerminalRouterContext.Provider value={value}>
      {children}
    </TerminalRouterContext.Provider>
  );
}

export function useTerminalRouter(): TerminalRouterContextValue {
  const ctx = useContext(TerminalRouterContext);
  if (!ctx) {
    throw new Error("useTerminalRouter must be used inside <TerminalRouterProvider>");
  }
  return ctx;
}

/** Returns null when used outside the provider — for opt-in nav links. */
export function useOptionalTerminalRouter(): TerminalRouterContextValue | null {
  return useContext(TerminalRouterContext);
}
