/**
 * TerminalShell — Unified Terminal SPA shell (phase 1).
 *
 * Hosts the persistent HUD and a stage that keeps each registered terminal
 * view mounted as a CSS-transform slide panel. Routing remains URL-driven
 * via `TerminalRouterProvider`, but page components no longer unmount on
 * navigation; instead they animate in/out using hardware-accelerated
 * transforms and retain their internal state (forms, in-progress runs,
 * scroll position).
 *
 * Phase 1 wires Hub (LandingPage) and Forge (CardForge). Additional views
 * are added to `TERMINAL_VIEWS` and `PANEL_RENDERERS` as they migrate.
 */
import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  TERMINAL_VIEWS,
  useTerminalRouter,
  type TerminalViewId,
} from "../context/TerminalRouterContext";
import { PersistentHud } from "./PersistentHud";

const LandingPage = lazy(() => import("../pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const CardForge = lazy(() => import("../pages/CardForge").then((m) => ({ default: m.CardForge })));

const PANEL_RENDERERS: Record<TerminalViewId, ComponentType> = {
  hub: LandingPage,
  forge: CardForge,
};

function PanelLoader() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading__glyph" aria-hidden="true">⚡</span>
      <div className="page-loading__copy">
        <strong>Switching panel…</strong>
        <span>Sliding the next view into the terminal.</span>
      </div>
    </div>
  );
}

interface PanelProps {
  viewId: TerminalViewId;
  isActive: boolean;
  state: "active" | "exiting" | "hidden";
  direction: "forward" | "back" | "none";
  children: ReactNode;
}

/**
 * A single terminal panel.
 *
 * - First activation triggers Suspense + lazy-load of the underlying page.
 * - Once activated, the panel stays mounted to preserve UI state.
 * - Scroll position is snapshotted on exit and restored on re-entry unless
 *   `consumeResetScroll` indicates a fresh-start navigation.
 */
function TerminalPanel({ viewId, isActive, state, direction, children }: PanelProps) {
  const { scrollMemoryRef, consumeResetScroll } = useTerminalRouter();
  const [hasActivated, setHasActivated] = useState(isActive);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && !hasActivated) setHasActivated(true);
  }, [isActive, hasActivated]);

  // Snapshot scroll position whenever this panel becomes inactive.
  useEffect(() => {
    const node = panelRef.current;
    if (!node || isActive) return;
    scrollMemoryRef.current.set(viewId, node.scrollTop);
  }, [isActive, viewId, scrollMemoryRef]);

  // Restore (or reset) scroll position when this panel becomes active.
  useLayoutEffect(() => {
    if (!isActive) return;
    const node = panelRef.current;
    if (!node) return;
    if (consumeResetScroll(viewId)) {
      node.scrollTop = 0;
      return;
    }
    const remembered = scrollMemoryRef.current.get(viewId);
    if (typeof remembered === "number") {
      node.scrollTop = remembered;
    }
  }, [isActive, viewId, scrollMemoryRef, consumeResetScroll]);

  return (
    <div
      ref={panelRef}
      className="terminal-panel"
      data-view={viewId}
      data-state={state}
      data-direction={direction}
      aria-hidden={isActive ? undefined : true}
      // React 18 @types don't include the `inert` boolean attribute yet; cast
      // through unknown so background panels can't steal focus or tab order.
      // Switch to `inert={true}` once we upgrade @types/react to >=18.3.18.
      {...(!isActive ? ({ inert: "" } as unknown as Record<string, unknown>) : {})}
    >
      {hasActivated ? (
        <Suspense fallback={<PanelLoader />}>{children}</Suspense>
      ) : null}
    </div>
  );
}

export function TerminalShell() {
  const { activeView, previousView, direction } = useTerminalRouter();

  return (
    <div className="terminal-shell" data-active-view={activeView}>
      <PersistentHud />
      <div className="terminal-stage" data-direction={direction}>
        {TERMINAL_VIEWS.map((view) => {
          const PanelComponent = PANEL_RENDERERS[view.id];
          const isActive = view.id === activeView;
          const isExiting = view.id === previousView;
          const state: "active" | "exiting" | "hidden" = isActive
            ? "active"
            : isExiting
              ? "exiting"
              : "hidden";
          return (
            <TerminalPanel
              key={view.id}
              viewId={view.id}
              isActive={isActive}
              state={state}
              direction={direction}
            >
              <PanelComponent />
            </TerminalPanel>
          );
        })}
      </div>
    </div>
  );
}
