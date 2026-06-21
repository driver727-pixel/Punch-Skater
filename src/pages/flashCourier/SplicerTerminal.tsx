import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { DragEvent, KeyboardEvent } from "react";
import {
  ALL_SHARDS,
  SHARD_KIND_COLORS,
  SHARD_KIND_GLYPHS,
  SHARD_KIND_LABELS,
} from "../../lib/flashCourier";
import type { DataShard, NavDeckSlots, ShardKind } from "../../lib/flashCourier";

// ── Compile animation text lines ──────────────────────────────────────────────

const COMPILE_LINES = [
  "> INITIALISING BURN-ROUTE COMPILER v4.3.1...",
  "> HANDSHAKING WITH DISTRICT RELAY MESH...",
  "> VALIDATING VECTOR SHARD INTEGRITY...",
  "> RUNNING GHOST PROTOCOL STACK TRACE...",
  "> LOADING PAYLOAD MODIFIER MANIFEST...",
  "> CROSS-REFERENCING COVER IDENTITY TOKEN...",
  "> ROUTING THROUGH ICE LAYER 1... BYPASSED",
  "> ROUTING THROUGH ICE LAYER 2... BYPASSED",
  "> ROUTING THROUGH ICE LAYER 3... CRACKING...",
  "> ENTROPY SEED GENERATED: 0xF4C9A3E1",
  "> NARRATIVE PATH RESOLVED — 3 BRANCHES LOADED",
  "> BURN ROUTE COMPILED. BRIEFING READY.",
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface SplicerTerminalProps {
  slots: NavDeckSlots;
  onSlotChange: (kind: ShardKind, shard: DataShard | null) => void;
  onCompile: () => void;
  compiling: boolean;
  compileProgress: number; // 0–1
  compileLog: string[];
}

// ── Shard card ────────────────────────────────────────────────────────────────

function ShardCard({
  shard,
  onDragStart,
  onKeySelect,
  selected,
  disabled,
}: {
  shard: DataShard;
  onDragStart: (shard: DataShard) => void;
  onKeySelect: (shard: DataShard) => void;
  selected: boolean;
  disabled: boolean;
}) {
  const color = SHARD_KIND_COLORS[shard.kind];
  const glyph = SHARD_KIND_GLYPHS[shard.kind];

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onKeySelect(shard);
    }
  };

  return (
    <div
      className={`splicer-shard-card${selected ? " splicer-shard-card--selected" : ""}${disabled ? " splicer-shard-card--disabled" : ""}`}
      style={{ "--shard-color": color } as React.CSSProperties}
      draggable={!disabled}
      onDragStart={() => !disabled && onDragStart(shard)}
      tabIndex={disabled ? -1 : 0}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      aria-label={`${shard.name}: ${shard.flavour}`}
      onKeyDown={handleKeyDown}
      onClick={() => !disabled && onKeySelect(shard)}
    >
      <div className="splicer-shard-card__header">
        <span className="splicer-shard-card__glyph">{glyph}</span>
        <span className="splicer-shard-card__name">{shard.name}</span>
      </div>
      <p className="splicer-shard-card__flavour">{shard.flavour}</p>
      {shard.ozziesCost != null && shard.ozziesCost > 0 && (
        <span className="splicer-shard-card__cost">{shard.ozziesCost} OZ</span>
      )}
    </div>
  );
}

// ── Slot zone ─────────────────────────────────────────────────────────────────

function SlotZone({
  kind,
  shard,
  dragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  onEject,
  disabled,
}: {
  kind: ShardKind;
  shard: DataShard | null;
  dragOver: boolean;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onEject: () => void;
  disabled: boolean;
}) {
  const color = SHARD_KIND_COLORS[kind];
  const glyph = SHARD_KIND_GLYPHS[kind];
  const label = SHARD_KIND_LABELS[kind];
  const slotId = useId();

  return (
    <div
      className={`splicer-slot${dragOver ? " splicer-slot--drag-over" : ""}${shard ? " splicer-slot--filled" : ""}${disabled ? " splicer-slot--disabled" : ""}`}
      style={{ "--shard-color": color } as React.CSSProperties}
      onDrop={disabled ? undefined : onDrop}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      aria-label={`${label} slot`}
      aria-describedby={slotId}
      role="listitem"
    >
      <div className="splicer-slot__label" id={slotId}>
        <span className="splicer-slot__glyph">{glyph}</span>
        <span className="splicer-slot__kind-text">{label}</span>
      </div>

      {shard ? (
        <div className="splicer-slot__loaded">
          <div className="splicer-slot__loaded-name">{shard.name}</div>
          <div className="splicer-slot__loaded-flavour">{shard.flavour}</div>
          {!disabled && (
            <button
              type="button"
              className="splicer-slot__eject"
              onClick={onEject}
              aria-label={`Eject ${shard.name} from ${label} slot`}
            >
              ✕ EJECT
            </button>
          )}
        </div>
      ) : (
        <div className="splicer-slot__empty">
          <span className="splicer-slot__empty-hint">
            DROP or CLICK a {kind.toUpperCase()} SHARD
          </span>
          <div className="splicer-slot__empty-pulse" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

// ── Compile animation overlay ─────────────────────────────────────────────────

function CompileOverlay({ log, progress }: { log: string[]; progress: number }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="splicer-compile-overlay" aria-live="polite" aria-label="Compiling burn route">
      <div className="splicer-compile-overlay__header">
        <span className="splicer-compile-overlay__title">◈ COMPILING BURN ROUTE</span>
        <span className="splicer-compile-overlay__pct">{Math.round(progress * 100)}%</span>
      </div>

      <div className="splicer-compile-overlay__progress-track">
        <div
          className="splicer-compile-overlay__progress-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="splicer-compile-overlay__log" ref={logRef}>
        {log.map((line, i) => (
          <div
            key={i}
            className={`splicer-compile-overlay__line${i === log.length - 1 ? " splicer-compile-overlay__line--active" : ""}`}
          >
            {line}
          </div>
        ))}
        {log.length < COMPILE_LINES.length && (
          <span className="splicer-compile-overlay__cursor" aria-hidden="true">█</span>
        )}
      </div>
    </div>
  );
}

// ── Main SplicerTerminal component ────────────────────────────────────────────

export function SplicerTerminal({
  slots,
  onSlotChange,
  onCompile,
  compiling,
  compileProgress,
  compileLog,
}: SplicerTerminalProps) {
  const [activeKind, setActiveKind] = useState<ShardKind>("vector");
  const [dragShard, setDragShard] = useState<DataShard | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<ShardKind | null>(null);

  const allFilled =
    slots.vector !== null && slots.ghost !== null && slots.payload !== null;

  const kinds: ShardKind[] = ["vector", "ghost", "payload"];

  // ── Drag source handlers ──────────────────────────────────────────────────

  const handleDragStart = useCallback((shard: DataShard) => {
    setDragShard(shard);
  }, []);

  // ── Slot drop handlers ────────────────────────────────────────────────────

  const handleSlotDrop = useCallback(
    (kind: ShardKind) => (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!dragShard || dragShard.kind !== kind) return;
      onSlotChange(kind, dragShard);
      setDragShard(null);
      setDragOverSlot(null);
    },
    [dragShard, onSlotChange],
  );

  const handleDragOver = useCallback(
    (kind: ShardKind) => (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverSlot(kind);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  // ── Click-to-slot (keyboard/touch fallback) ───────────────────────────────

  const handleKeySelect = useCallback(
    (shard: DataShard) => {
      // Clicking a shard equips it into its corresponding slot.
      onSlotChange(shard.kind, shard);
    },
    [onSlotChange],
  );

  const availableShards = ALL_SHARDS[activeKind];

  return (
    <div className="splicer-terminal">
      {/* ── Header ── */}
      <div className="splicer-terminal__header">
        <div className="splicer-terminal__scanline" aria-hidden="true" />
        <h2 className="splicer-terminal__title">SPLICER TERMINAL</h2>
        <p className="splicer-terminal__sub">
          Slot three Data Shards to compile your Burn Route. Drag or click to equip.
        </p>
      </div>

      {/* ── Slot zones ── */}
      <div className="splicer-terminal__slots" role="list" aria-label="Shard slots">
        {kinds.map((kind) => (
          <SlotZone
            key={kind}
            kind={kind}
            shard={slots[kind]}
            dragOver={dragOverSlot === kind}
            onDrop={handleSlotDrop(kind)}
            onDragOver={handleDragOver(kind)}
            onDragLeave={handleDragLeave}
            onEject={() => onSlotChange(kind, null)}
            disabled={compiling}
          />
        ))}
      </div>

      {/* ── Shard browser ── */}
      <div className="splicer-terminal__browser">
        {/* Kind tabs */}
        <div className="splicer-browser-tabs" role="tablist" aria-label="Shard kind filter">
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={activeKind === kind}
              className={`splicer-browser-tab${activeKind === kind ? " splicer-browser-tab--active" : ""}`}
              style={{ "--shard-color": SHARD_KIND_COLORS[kind] } as React.CSSProperties}
              onClick={() => setActiveKind(kind)}
              disabled={compiling}
            >
              {SHARD_KIND_GLYPHS[kind]} {kind.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Shard list */}
        <div
          className="splicer-shard-list"
          role="listbox"
          aria-label={`Available ${activeKind} shards`}
          aria-multiselectable="false"
        >
          {availableShards.map((shard) => (
            <ShardCard
              key={shard.id}
              shard={shard}
              selected={slots[shard.kind]?.id === shard.id}
              onDragStart={handleDragStart}
              onKeySelect={handleKeySelect}
              disabled={compiling}
            />
          ))}
        </div>
      </div>

      {/* ── Compile button ── */}
      <div className="splicer-terminal__footer">
        <button
          type="button"
          className={`splicer-compile-btn${allFilled && !compiling ? " splicer-compile-btn--ready" : ""}`}
          disabled={!allFilled || compiling}
          onClick={onCompile}
          aria-label="Compile Burn Route"
          aria-busy={compiling}
        >
          {compiling ? (
            <span className="splicer-compile-btn__label splicer-compile-btn__label--busy">
              COMPILING
              <span className="splicer-compile-btn__dots" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </span>
          ) : (
            <span className="splicer-compile-btn__label">
              {allFilled ? "⚡ COMPILE BURN ROUTE" : `${kinds.filter((k) => slots[k] === null).length} SHARD${kinds.filter((k) => slots[k] === null).length !== 1 ? "S" : ""} MISSING`}
            </span>
          )}
        </button>
      </div>

      {/* ── Compile animation overlay ── */}
      {compiling && (
        <CompileOverlay log={compileLog} progress={compileProgress} />
      )}
    </div>
  );
}

// ── useCompileAnimation hook (co-located for modularity) ──────────────────────

const COMPILE_STEP_INTERVAL_MS = 320;
const COMPILE_TOTAL_DURATION_MS = 4200;

export interface CompileAnimationState {
  compiling: boolean;
  compileProgress: number;
  compileLog: string[];
  triggerCompile: () => void;
}

/**
 * Drives the 3–5 second compile animation.
 * Call `triggerCompile()` to start; `onComplete` fires when the animation ends.
 */
export function useCompileAnimation(onComplete: () => void): CompileAnimationState {
  const [compiling, setCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileLog, setCompileLog] = useState<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const triggerCompile = useCallback(() => {
    setCompiling(true);
    setCompileProgress(0);
    setCompileLog([]);

    const startTime = Date.now();
    let lineIndex = 0;
    const lineInterval = setInterval(() => {
      if (lineIndex < COMPILE_LINES.length) {
        setCompileLog((prev) => [...prev, COMPILE_LINES[lineIndex]]);
        lineIndex += 1;
      }
    }, COMPILE_STEP_INTERVAL_MS);

    const progressRaf = { id: 0 };
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / COMPILE_TOTAL_DURATION_MS, 1);
      setCompileProgress(progress);
      if (progress < 1) {
        progressRaf.id = requestAnimationFrame(tick);
      } else {
        clearInterval(lineInterval);
        setCompiling(false);
        onCompleteRef.current();
      }
    };
    progressRaf.id = requestAnimationFrame(tick);

    return () => {
      clearInterval(lineInterval);
      cancelAnimationFrame(progressRaf.id);
    };
  }, []);

  return { compiling, compileProgress, compileLog, triggerCompile };
}
