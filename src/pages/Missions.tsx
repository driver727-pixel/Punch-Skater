import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { useDecks } from "../hooks/useDecks";
import { isEnabled } from "../lib/featureFlags";
import {
  MISSION_PHASE,
  MISSION_PHASE_LABELS,
  normalizeMissionPhase,
} from "../lib/missionPhaseMachine";
import { findAStarRoute, routeUsesGraphEdges } from "../lib/pathfinding";
import type {
  ActiveDistrictRun,
  DistrictWorld,
  DistrictWorldVisuals,
  MissionEncounter,
  MissionEncounterOption,
  MissionFork,
  MissionRunDebrief,
  WorldContract,
} from "../lib/sharedTypes";
import type { CardPayload, DeckPayload } from "../lib/types";
import {
  acknowledgeDistrictRun,
  getDistrictWorld,
  getDistrictWorldVisuals,
  persistDistrictCheckpoint,
  resolveEncounter,
  resolvePoiFork,
  startDistrictRun,
} from "../services/missions";
import { MissionsMap } from "../components/MissionsMap";
import { MissionsPanel } from "../components/MissionsPanel";

const STATIC_MISSIONS_MAP_BACKDROP_URL = "/game-map-best-big.jpg";
import { announceActiveDistrict } from "../lib/districtTheme";

const PANEL_WIDTH = 320;
const SEGMENT_DURATION_MS = 700;
const ACTION_ERROR_REFRESH_SUFFIX = "Please try again or refresh the Missions page.";
const ACTION_ERROR_BANNER_STYLE: CSSProperties = {
  padding: "8px 20px",
  borderBottom: "1px solid rgba(255,138,138,0.22)",
  background: "rgba(255,80,80,0.08)",
  color: "#ffb0b0",
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.45,
  flexShrink: 0,
};

type MissionRunnerOption = {
  id: string;
  runnerType: "card" | "deck";
  label: string;
  detail: string;
  deck?: DeckPayload;
  card?: CardPayload;
};

const SINGLE_MISSION_IDEAS = [
  "Theft: lift a prototype truck or rival patch before the alarm loop closes.",
  "Hack: crack a Cascade kiosk, erase a trace, or ghost a camera spine.",
  "Joust: challenge a gatekeeper rider for passage, proof, or reputation.",
  "Courier sting: carry a decoy packet and identify who tries to intercept it.",
];

const GROUP_OPERATION_IDEAS = [
  "Heist: split lookout, driver, hacker, and muscle roles for a high-value vault pull.",
  "Rival assault: hit an enemy skater safehouse and hold the line through retaliation.",
  "Aid hijack: seize an Asclepian shipment and decide who gets the supplies.",
  "Convoy extraction: escort a witness, union fund, or med-crate across multiple districts.",
];

function getCardDisplayName(card?: CardPayload | null): string {
  return card?.identity?.name?.trim() || "Unnamed card";
}

function getCardRunnerDetail(card: CardPayload): string {
  return `${getCardDisplayName(card)} runs one-person jobs: thefts, hacks, jousts, stings, and other solo risks.`;
}

/** Smoothstep easing — eliminates the harsh linear start/stop of token travel. */
function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

// ── Phase badge ────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  [MISSION_PHASE.IDLE_AT_BASE]: "rgba(125,231,255,0.7)",
  [MISSION_PHASE.TRAVELING_OUTBOUND]: "#ffe44d",
  [MISSION_PHASE.ENCOUNTER_RESOLUTION]: "#ff3af2",
  [MISSION_PHASE.AT_POI_FORK]: "#7dffb6",
  [MISSION_PHASE.TRAVELING_INBOUND]: "#ffe44d",
  [MISSION_PHASE.MISSION_COMPLETE]: "#7dffb6",
  [MISSION_PHASE.MISSION_FAILED]: "#ff6b6b",
};

// ── Debrief helpers ────────────────────────────────────────────────────────

const DEBRIEF_DISTRICT_ACCENT: Record<string, { color: string; glyph: string }> = {
  Airaway: { color: "#7de7ff", glyph: "◎" },
  Batteryville: { color: "#ffe44d", glyph: "⚡" },
  "The Grid": { color: "#ff3af2", glyph: "▦" },
  Nightshade: { color: "#d490ff", glyph: "✦" },
  "The Forest": { color: "#8cff8a", glyph: "❋" },
  "Glass City": { color: "#ffd98f", glyph: "◈" },
};

function formatRunDuration(launchedAt?: string, completedAt?: string): string {
  if (!launchedAt || !completedAt) return "";
  const ms = new Date(completedAt).getTime() - new Date(launchedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function RunPhaseBadge({ phase }: { phase: string }) {
  const normalized = normalizeMissionPhase(phase);
  const label = MISSION_PHASE_LABELS[normalized] ?? normalized;
  const color = PHASE_COLORS[normalized] ?? "rgba(125,231,255,0.7)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        background: `${color}18`,
        border: `1px solid ${color}`,
        borderRadius: 3,
        color,
        fontFamily: "monospace",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        verticalAlign: "middle",
      }}
    >
      {label}
    </span>
  );
}

// ── Section divider label ──────────────────────────────────────────────────

function DebriefSectionLabel({ children, color = "rgba(125,231,255,0.5)" }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 0" }}>
      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}40` }} />
    </div>
  );
}

// ── Mission debrief panel — baseball-card-style run record ─────────────────

function MissionDebriefPanel({
  debrief,
  contract,
  onDismiss,
  onRefresh,
}: {
  debrief?: MissionRunDebrief;
  contract?: WorldContract;
  onDismiss: () => void;
  onRefresh: () => void;
}) {
  const hasDebrief = Boolean(debrief);
  const success = debrief?.success === true;
  const title = debrief?.contractTitle ?? contract?.title ?? "Mission run";
  const district = debrief?.district ?? contract?.district ?? "The Grid";
  const results = debrief?.results ?? [];
  const accent = DEBRIEF_DISTRICT_ACCENT[district] ?? { color: "#7de7ff", glyph: "◈" };
  const statusColor = success ? "#7dffb6" : "#ff8a8a";
  const duration = formatRunDuration(debrief?.launchedAt, debrief?.completedAt);
  const encounterResults = results.filter((r) => r.resultType === "travel_encounter");
  const routeLegs = debrief?.routeSummary ?? "";
  const shortRunId = debrief?.runId
    ? (debrief.runId.includes("_") ? debrief.runId.split("_").pop() : debrief.runId)?.slice(-8) ?? null
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
      {/* ── Card header ── */}
      <div
        style={{
          borderTop: `3px solid ${accent.color}`,
          padding: "14px 18px 12px",
          background: `linear-gradient(180deg, ${accent.color}0d 0%, transparent 100%)`,
          flexShrink: 0,
        }}
      >
        {/* District + status row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.13em", color: accent.color }}>
            {accent.glyph} {district}
          </span>
          <span
            style={{
              padding: "1px 7px",
              background: `${statusColor}18`,
              border: `1px solid ${statusColor}`,
              borderRadius: 3,
              fontFamily: "monospace",
              fontSize: 8,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: statusColor,
            }}
          >
            {success ? "✓ Returned" : "✕ Failed run"}
          </span>
        </div>

        {/* Contract title */}
        <h2 style={{ margin: "0 0 4px", fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
          {title}
        </h2>

        {/* Run ID line */}
        {shortRunId && (
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
            RUN {shortRunId.toUpperCase()}
            {duration ? ` · ${duration}` : ""}
          </p>
        )}
      </div>

      {/* ── Summary text ── */}
      <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
        <p style={{ margin: 0, fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
          {debrief?.summary ?? (!hasDebrief
            ? "Run record unavailable. Refresh the Missions page to reload the latest run state."
            : success ? "Run complete." : "Run logged with no gameplay penalties.")}
        </p>
      </div>

      {/* ── Route + deck metadata ── */}
      <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
        <DebriefSectionLabel>Route</DebriefSectionLabel>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontFamily: "monospace", fontSize: 10 }}>
          {routeLegs && (
            <>
              <span style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.08em", alignSelf: "center" }}>Legs</span>
              <span style={{ color: "rgba(255,255,255,0.8)" }}>{routeLegs}</span>
            </>
          )}
          {encounterResults.length > 0 && (
            <>
              <span style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.08em", alignSelf: "center" }}>Encounters</span>
              <span style={{ color: "rgba(255,255,255,0.8)" }}>{encounterResults.length}</span>
            </>
          )}
          {(debrief?.deckName || debrief?.cardName) && (
            <>
              <span style={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontSize: 9, letterSpacing: "0.08em", alignSelf: "center" }}>Game piece</span>
              <span style={{ color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{debrief.cardName ?? debrief.deckName}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Encounter + POI log ── */}
      {results.length > 0 && (
        <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
          <DebriefSectionLabel>Run log</DebriefSectionLabel>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {results.map((result, index) => {
              const isPoi = result.resultType === "poi_resolution";
              const entryColor = isPoi ? accent.color : "rgba(255,255,255,0.65)";
              const entryBadge = isPoi ? "🎯" : "⚡";
              const hasGain = (Number(result.rewardXpDelta) > 0) || (Number(result.rewardOzziesDelta) > 0);
              return (
                <div
                  key={`${result.resultType}-${result.choiceId}-${index}`}
                  style={{
                    padding: "8px 10px",
                    border: `1px solid ${isPoi ? `${accent.color}30` : "rgba(255,255,255,0.09)"}`,
                    borderLeft: `2px solid ${isPoi ? accent.color : (result.success === true ? "rgba(125,255,182,0.5)" : "rgba(255,138,138,0.35)")}`,
                    borderRadius: "0 4px 4px 0",
                    background: isPoi ? `${accent.color}08` : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: entryColor }}>
                        {entryBadge} {result.label}
                      </p>
                      <p style={{ margin: "3px 0 0", fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{result.summary}</p>
                    </div>
                    {success && hasGain && (
                      <div style={{ flexShrink: 0, textAlign: "right", fontFamily: "monospace", fontSize: 9, color: "#7dffb6", lineHeight: 1.5 }}>
                        {Number(result.rewardXpDelta) > 0 && <div>+{result.rewardXpDelta} XP</div>}
                        {Number(result.rewardOzziesDelta) > 0 && <div>+{result.rewardOzziesDelta} Ozzies</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rewards (success) or No-penalty notice (failure) ── */}
      <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
        {success ? (
          <>
            <DebriefSectionLabel color="#7dffb6">Rewards banked</DebriefSectionLabel>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Base XP", value: debrief?.baseRewardXp ?? 0 },
                { label: "Base Ozzies", value: debrief?.baseRewardOzzies ?? 0 },
                { label: "Bonus XP", value: debrief?.bonusRewardXp ?? 0 },
                { label: "Bonus Ozzies", value: debrief?.bonusRewardOzzies ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "7px 9px", border: "1px solid rgba(125,255,182,0.15)", borderRadius: 4, background: "rgba(125,255,182,0.04)" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 8, color: "#7dffb6", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                  <div style={{ marginTop: 3, fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#fff" }}>{value}</div>
                </div>
              ))}
            </div>
            {((debrief?.totalRewardXp ?? 0) > 0 || (debrief?.totalRewardOzzies ?? 0) > 0) && (
              <div style={{ marginTop: 8, padding: "8px 10px", border: "1px solid rgba(125,255,182,0.3)", borderRadius: 4, background: "rgba(125,255,182,0.07)", fontFamily: "monospace", fontSize: 10, color: "#7dffb6", display: "flex", justifyContent: "space-between" }}>
                <span>Total</span>
                <span style={{ fontWeight: 700 }}>
                  {debrief?.totalRewardXp ?? 0} XP · {debrief?.totalRewardOzzies ?? 0} Ozzies
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <DebriefSectionLabel color="#ff8a8a">No rewards · No penalties</DebriefSectionLabel>
            <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid rgba(255,138,138,0.2)", borderRadius: 4, background: "rgba(255,138,138,0.04)" }}>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "#ffb0b0", lineHeight: 1.6 }}>
                This run didn't make it back to the Workshop.
              </p>
              <p style={{ margin: "6px 0 0", fontFamily: "monospace", fontSize: 9, color: "rgba(255,138,138,0.6)", lineHeight: 1.55 }}>
                No XP, Ozzies, stat changes, card repairs, or lockouts applied.
                The run is recorded as history only.
              </p>
              {debrief?.failureReason && (
                <p style={{ margin: "8px 0 0", fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.4, borderTop: "1px solid rgba(255,138,138,0.15)", paddingTop: 8 }}>
                  {debrief.failureReason}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Card record ── */}
      <div style={{ padding: "10px 18px 0", flexShrink: 0 }}>
        <DebriefSectionLabel color="#ff8af8">Card record</DebriefSectionLabel>
        <div style={{ marginTop: 8, padding: "9px 10px", border: "1px solid rgba(255,58,242,0.2)", borderRadius: 4, background: "rgba(255,58,242,0.04)" }}>
          {debrief?.cardName ? (
            <>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#ff8af8" }}>{debrief.cardName}</p>
              <p style={{ margin: "2px 0 0", fontFamily: "monospace", fontSize: 9, color: "rgba(255,138,248,0.5)", letterSpacing: "0.06em" }}>{debrief.cardId}</p>
            </>
          ) : (
            <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              No card selected for this run.
            </p>
          )}
          <p style={{ margin: "6px 0 0", fontFamily: "monospace", fontSize: 9, color: success ? "rgba(125,255,182,0.7)" : "rgba(255,138,138,0.6)", lineHeight: 1.4 }}>
            {success
              ? "Rewards and run stats applied to this card."
              : "Failure history logged — no gameplay penalties applied to this card."}
          </p>
        </div>
      </div>

      {/* ── Dismiss button ── */}
      <div style={{ padding: "14px 18px 18px", marginTop: "auto", flexShrink: 0 }}>
        <button
          type="button"
          aria-label="Return to map"
          onClick={hasDebrief ? onDismiss : onRefresh}
          style={{
            width: "100%",
            padding: "10px 0",
            background: `${accent.color}0e`,
            border: `1px solid ${accent.color}88`,
            borderRadius: 4,
            color: accent.color,
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          {hasDebrief ? "Return to map" : "Refresh Missions"}
        </button>
      </div>
    </div>
  );
}

// ── Contract detail panel (pre-launch) ────────────────────────────────────

function ContractDetailPanel({
  contract,
  onLaunch,
  launching,
  disabled,
  runnerOptions,
  selectedRunnerId,
  selectedRunner,
  onRunnerChange,
}: {
  contract: WorldContract;
  onLaunch: () => void;
  launching: boolean;
  disabled: boolean;
  runnerOptions: MissionRunnerOption[];
  selectedRunnerId: string;
  selectedRunner?: MissionRunnerOption;
  onRunnerChange: (runnerId: string) => void;
}) {
  const isLocked = contract.visibility === "locked";
  const isCompleted = contract.status === "completed";
  const isSolo = selectedRunner?.runnerType === "card";
  const ideaList = isSolo ? SINGLE_MISSION_IDEAS : GROUP_OPERATION_IDEAS;
  const launchDisabled = launching || disabled || !selectedRunner;
  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
      <p style={{ margin: 0, fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: isLocked ? "rgba(180,180,220,0.5)" : "#ff3af2" }}>
        {isLocked ? "Locked" : isCompleted ? "Cleared" : contract.district}
      </p>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isLocked ? "rgba(180,180,220,0.5)" : "#ffffff", fontFamily: "monospace" }}>
        {isLocked ? "???" : contract.title}
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
        {isLocked ? (contract.lockHint ?? "Complete an adjacent contract to reveal this node.") : contract.tagline}
      </p>
      {!isLocked && !isCompleted && (
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", marginBottom: 2 }}>XP</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{contract.rewardXp}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", marginBottom: 2 }}>OZZIES</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{contract.rewardOzzies}</div>
          </div>
        </div>
      )}
      {!isLocked && !isCompleted && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", border: "1px solid rgba(125,231,255,0.2)", borderRadius: 4, background: "rgba(125,231,255,0.05)" }}>
          <label htmlFor="mission-runner-select" style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Game piece
          </label>
          <select
            id="mission-runner-select"
            value={selectedRunnerId}
            onChange={(event) => onRunnerChange(event.target.value)}
            disabled={launching || disabled || runnerOptions.length === 0}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 4,
              border: "1px solid rgba(125,231,255,0.45)",
              background: "#071120",
              color: "#ffffff",
              fontFamily: "monospace",
              fontSize: 11,
            }}
          >
            {runnerOptions.length === 0 ? (
              <option value="">Create a card or card deck first</option>
            ) : runnerOptions.map((runner) => (
              <option key={runner.id} value={runner.id}>
                {runner.runnerType === "card" ? "Card" : "Deck"} · {runner.label}
              </option>
            ))}
          </select>
          <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
            {selectedRunner?.detail ?? "Pick a character card for solo jobs, or a card deck for squad operations."}
          </p>
        </div>
      )}
      {!isLocked && !isCompleted && (
        <div style={{ padding: "10px 12px", border: `1px solid ${isSolo ? "rgba(255,58,242,0.28)" : "rgba(125,255,182,0.24)"}`, borderRadius: 4, background: isSolo ? "rgba(255,58,242,0.05)" : "rgba(125,255,182,0.04)" }}>
          <p style={{ margin: "0 0 6px", fontSize: 9, fontFamily: "monospace", color: isSolo ? "#ff8af8" : "#7dffb6", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            {isSolo ? "Single-card mission ideas" : "Squad operation ideas"}
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {ideaList.map((idea) => (
              <li key={idea} style={{ fontSize: 10, color: "rgba(255,255,255,0.62)", lineHeight: 1.35 }}>{idea}</li>
            ))}
          </ul>
        </div>
      )}
      {!isLocked && !isCompleted && (
        <button
          onClick={onLaunch}
          disabled={launchDisabled}
          style={{
            marginTop: "auto",
            padding: "10px 0",
            background: "rgba(255,58,242,0.1)",
            border: "1px solid #ff3af2",
            borderRadius: 4,
            color: "#ff3af2",
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: launching ? "wait" : launchDisabled ? "not-allowed" : "pointer",
            opacity: launchDisabled ? 0.6 : 1,
          }}
        >
          {launching ? "Launching…" : disabled ? "Travel in progress" : selectedRunner ? (isSolo ? "Run Solo Job" : "Run Squad Operation") : "Pick a game piece"}
        </button>
      )}
      {isCompleted && (
        <div style={{ marginTop: "auto", padding: "10px 0", textAlign: "center", color: "#7dffb6", fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ✓ Cleared
        </div>
      )}
    </div>
  );
}

// ── Punch Skater™ Streets launch ───────────────────────────────────────────

const STREETS_RETURN_PATH = "/missions";
const STREETS_LOSS_CHOICE_ID = "streets-down";

/**
 * Build the `/streets/` launch URL for a side-scroll brawl encounter option,
 * encoding the chosen card's forged stats and cosmetics so the beat-em-up can
 * derive the player fighter. The game bounces back to `STREETS_RETURN_PATH`
 * with a `streetsResult` query param, which {@link MissionsWorldView} resolves.
 */
function buildStreetsLaunchUrl(
  option: MissionEncounterOption,
  runId: string,
  nodeId: string | null,
  card: CardPayload | null,
  world: DistrictWorld | null,
  visuals: DistrictWorldVisuals | null,
): string {
  const params = new URLSearchParams();
  if (option.streetsMissionId) params.set("mission", option.streetsMissionId);
  if (option.streetsObjective) params.set("objective", option.streetsObjective);
  if (option.streetsDistrict) params.set("district", option.streetsDistrict);
  params.set("runId", runId);
  if (nodeId) params.set("nodeId", nodeId);
  params.set("choiceId", option.id);
  params.set("returnTo", STREETS_RETURN_PATH);
  params.set("levelSeed", [
    world?.boardDateKey,
    runId,
    nodeId,
    option.streetsMissionId,
  ].filter(Boolean).join(":"));
  if (visuals?.backdrop && !visuals.backdrop.fallback && visuals.backdrop.url) {
    params.set("levelBackdrop", visuals.backdrop.url);
  }

  if (card) {
    const name = card.identity?.name;
    if (name) params.set("pName", name);
    const stats = card.stats;
    if (stats) {
      if (Number.isFinite(stats.speed)) params.set("pSpeed", String(stats.speed));
      if (Number.isFinite(stats.range)) params.set("pRange", String(stats.range));
      if (Number.isFinite(stats.stealth)) params.set("pStealth", String(stats.stealth));
      if (Number.isFinite(stats.grit)) params.set("pGrit", String(stats.grit));
    }
    const joust = card.joust;
    if (joust) {
      if (Number.isFinite(joust.lance)) params.set("pLance", String(joust.lance));
      if (Number.isFinite(joust.shield)) params.set("pShield", String(joust.shield));
      if (Number.isFinite(joust.hype)) params.set("pHype", String(joust.hype));
      const weapon = joust.gear?.lanceType;
      if (weapon) params.set("pWeapon", weapon);
    }
    if (card.characterImageUrl) params.set("pSprite", card.characterImageUrl);
  }

  return `/streets/?${params.toString()}`;
}

// ── Encounter overlay ──────────────────────────────────────────────────────

function EncounterOverlay({
  encounter,
  onResolve,
  onLaunchStreets,
  resolving,
}: {
  encounter: MissionEncounter;
  onResolve: (choiceId: string) => void;
  onLaunchStreets: (option: MissionEncounterOption) => void;
  resolving: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "rgba(3,7,14,0.92)",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(2px)",
      }}
    >
      {/* Header stripe */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid rgba(255,58,242,0.4)",
          background: "rgba(255,58,242,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{encounter.badge}</span>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "#ff3af2" }}>
            ⚡ Encounter
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, fontFamily: "monospace", color: "#ff8af8", fontWeight: 700 }}>
            {encounter.threat}
          </p>
        </div>
      </div>

      {/* Prompt */}
      <div style={{ padding: "14px 20px", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, fontFamily: "monospace" }}>
          {encounter.prompt}
        </p>
      </div>

      {/* Options */}
      <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1 }}>
        <p style={{ margin: "0 0 4px", fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(125,231,255,0.6)" }}>
          Choose your response
        </p>
        {encounter.options.map((opt) => {
          if (opt.hidden) return null;
          const unavailable = opt.available === false;
          if (opt.encounterType === "streets") {
            return (
              <button
                key={opt.id}
                onClick={() => onLaunchStreets(opt)}
                disabled={resolving || unavailable}
                title={unavailable ? "Requirements not met" : opt.description}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  background: unavailable ? "rgba(255,255,255,0.03)" : "rgba(57,255,20,0.1)",
                  border: `1px solid ${unavailable ? "rgba(255,255,255,0.12)" : "rgba(57,255,20,0.6)"}`,
                  borderRadius: 4,
                  color: unavailable ? "rgba(255,255,255,0.3)" : "#eaffe0",
                  fontFamily: "monospace",
                  fontSize: 11,
                  cursor: resolving || unavailable ? "not-allowed" : "pointer",
                  opacity: resolving ? 0.6 : 1,
                  transition: "background 0.15s",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>▶ {opt.label}</div>
                <div style={{ fontSize: 10, color: unavailable ? "rgba(255,255,255,0.2)" : "rgba(234,255,224,0.7)", lineHeight: 1.4 }}>
                  {opt.description}
                </div>
                <div style={{ marginTop: 6, fontSize: 9, color: "#7de7ff", letterSpacing: "0.08em" }}>
                  SIDE-SCROLL BRAWL · PUNCH SKATER™ STREETS
                </div>
              </button>
            );
          }
          return (
            <button
              key={opt.id}
              onClick={() => onResolve(opt.id)}
              disabled={resolving || unavailable}
              title={unavailable ? "Requirements not met" : opt.description}
              style={{
                textAlign: "left",
                padding: "10px 14px",
                background: unavailable ? "rgba(255,255,255,0.03)" : "rgba(255,58,242,0.07)",
                border: `1px solid ${unavailable ? "rgba(255,255,255,0.12)" : "rgba(255,58,242,0.5)"}`,
                borderRadius: 4,
                color: unavailable ? "rgba(255,255,255,0.3)" : "#ffffff",
                fontFamily: "monospace",
                fontSize: 11,
                cursor: resolving || unavailable ? "not-allowed" : "pointer",
                opacity: resolving ? 0.6 : 1,
                transition: "background 0.15s",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{opt.label}</div>
              <div style={{ fontSize: 10, color: unavailable ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
                {opt.description}
              </div>
              {(opt.rewardXpDelta != null || opt.rewardOzziesDelta != null) && !unavailable && (
                <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
                  {opt.rewardXpDelta != null && opt.rewardXpDelta !== 0 && (
                    <span style={{ fontSize: 9, color: opt.rewardXpDelta > 0 ? "#7dffb6" : "#ff6b6b" }}>
                      {opt.rewardXpDelta > 0 ? "+" : ""}{opt.rewardXpDelta} XP
                    </span>
                  )}
                  {opt.rewardOzziesDelta != null && opt.rewardOzziesDelta !== 0 && (
                    <span style={{ fontSize: 9, color: opt.rewardOzziesDelta > 0 ? "#7dffb6" : "#ff6b6b" }}>
                      {opt.rewardOzziesDelta > 0 ? "+" : ""}{opt.rewardOzziesDelta} Ozzies
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── POI fork panel ─────────────────────────────────────────────────────────

function PoiForkPanel({
  contract,
  fork,
  onResolve,
  resolving,
}: {
  contract: WorldContract;
  fork: MissionFork | null;
  onResolve: (choiceId: string) => void;
  resolving: boolean;
}) {
  if (!fork) {
    return (
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, height: "100%", boxSizing: "border-box" }}>
        <p style={{ margin: 0, fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "#7dffb6" }}>
          ◆ Contract reached
        </p>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#ffffff", fontFamily: "monospace" }}>
          {contract.title}
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
          {contract.tagline}
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", marginBottom: 2 }}>XP</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{contract.rewardXp}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "#7de7ff", marginBottom: 2 }}>OZZIES</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>{contract.rewardOzzies}</div>
          </div>
        </div>
        <button
          onClick={() => onResolve("default")}
          disabled={resolving}
          style={{
            marginTop: "auto",
            padding: "10px 0",
            background: "rgba(125,255,182,0.1)",
            border: "1px solid #7dffb6",
            borderRadius: 4,
            color: "#7dffb6",
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: resolving ? "wait" : "pointer",
            opacity: resolving ? 0.6 : 1,
          }}
        >
          {resolving ? "Returning…" : "Begin Return"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
      <p style={{ margin: 0, fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "#7dffb6" }}>
        {fork.badge} Fork
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, fontFamily: "monospace" }}>
        {fork.prompt}
      </p>
      <p style={{ margin: "4px 0 2px", fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(125,231,255,0.6)" }}>
        Choose your route
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fork.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onResolve(opt.id)}
            disabled={resolving}
            style={{
              textAlign: "left",
              padding: "10px 14px",
              background: "rgba(125,255,182,0.06)",
              border: "1px solid rgba(125,255,182,0.45)",
              borderRadius: 4,
              color: "#ffffff",
              fontFamily: "monospace",
              fontSize: 11,
              cursor: resolving ? "wait" : "pointer",
              opacity: resolving ? 0.6 : 1,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>{opt.description}</div>
            {(opt.rewardXpDelta != null || opt.rewardOzziesDelta != null) && (
              <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
                {opt.rewardXpDelta != null && opt.rewardXpDelta !== 0 && (
                  <span style={{ fontSize: 9, color: opt.rewardXpDelta > 0 ? "#7dffb6" : "#ff6b6b" }}>
                    {opt.rewardXpDelta > 0 ? "+" : ""}{opt.rewardXpDelta} XP
                  </span>
                )}
                {opt.rewardOzziesDelta != null && opt.rewardOzziesDelta !== 0 && (
                  <span style={{ fontSize: 9, color: opt.rewardOzziesDelta > 0 ? "#7dffb6" : "#ff6b6b" }}>
                    {opt.rewardOzziesDelta > 0 ? "+" : ""}{opt.rewardOzziesDelta} Ozzies
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

type SegmentTravel = {
  routeNodeIds: string[];
  fromIndex: number;
  toIndex: number;
  progress: number;
};

function MissionsWorldView({ uid, userEmail }: { uid: string; userEmail?: string | null }) {
  const { decks } = useDecks();
  const { cards } = useCollection();
  const [world, setWorld] = useState<DistrictWorld | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveDistrictRun | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");
  const [visuals, setVisuals] = useState<DistrictWorldVisuals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [resolvingEncounter, setResolvingEncounter] = useState(false);
  const [resolvingFork, setResolvingFork] = useState(false);
  const [segmentTravel, setSegmentTravel] = useState<SegmentTravel | null>(null);
  const fetchedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastCheckpointSyncRef = useRef<string>("");
  const animatingRef = useRef(false);

  const loadDistrictWorld = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    setSegmentTravel(null);
    lastCheckpointSyncRef.current = "";
    try {
      const { world: w, activeRun: run, visuals: payloadVisuals } = await getDistrictWorld(uid, userEmail);
      setWorld(w);
      setActiveRun(run);
      setVisuals(payloadVisuals ?? w.visuals ?? null);
      const restoredPhase = normalizeMissionPhase(run?.phase);
      if (run && restoredPhase !== MISSION_PHASE.MISSION_FAILED) {
        const contract = w.contracts.find((c) => c.id === run.contractId);
        if (contract) setSelectedContractId(contract.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load district world.");
    } finally {
      setLoading(false);
    }
  }, [uid, userEmail]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void loadDistrictWorld();
  }, [loadDistrictWorld]);

  const selectedContract: WorldContract | undefined = useMemo(
    () => world?.contracts.find((c) => c.id === selectedContractId),
    [world, selectedContractId],
  );

  useEffect(() => {
    if (selectedContract?.district) {
      announceActiveDistrict(selectedContract.district);
    }
  }, [selectedContract?.district]);

  const runnerOptions = useMemo<MissionRunnerOption[]>(() => {
    const deckOptions = decks.map((deck) => ({
      id: `deck:${deck.id}`,
      runnerType: "deck" as const,
      label: deck.name,
      detail: `${deck.cards.length} card${deck.cards.length === 1 ? "" : "s"} ready for group jobs and squad operations.`,
      deck,
    }));
    const seenCardIds = new Set<string>();
    const cardOptions: MissionRunnerOption[] = [];
    for (const card of cards) {
      if (!card?.id || seenCardIds.has(card.id)) continue;
      seenCardIds.add(card.id);
      cardOptions.push({
        id: `card:${card.id}`,
        runnerType: "card",
        label: getCardDisplayName(card),
        detail: getCardRunnerDetail(card),
        card,
      });
    }
    for (const deck of decks) {
      for (const card of deck.cards) {
        if (!card?.id || seenCardIds.has(card.id)) continue;
        seenCardIds.add(card.id);
        cardOptions.push({
          id: `card:${card.id}`,
          runnerType: "card",
          label: getCardDisplayName(card),
          detail: getCardRunnerDetail(card),
          card,
        });
      }
    }
    return [...cardOptions, ...deckOptions];
  }, [cards, decks]);

  const selectedRunner = useMemo(
    () => runnerOptions.find((runner) => runner.id === selectedRunnerId),
    [runnerOptions, selectedRunnerId],
  );

  useEffect(() => {
    if (runnerOptions.length === 0) {
      setSelectedRunnerId("");
      return;
    }
    setSelectedRunnerId((current) => (
      runnerOptions.some((runner) => runner.id === current) ? current : runnerOptions[0].id
    ));
  }, [runnerOptions]);

  const visualDeckId = activeRun
    ? activeRun.deckId ?? null
    : selectedRunner?.runnerType === "deck" ? selectedRunner.deck?.id ?? null : null;
  const visualCardId = activeRun
    ? activeRun.cardId ?? null
    : selectedRunner?.runnerType === "card" ? selectedRunner.card?.id ?? null : null;

  useEffect(() => {
    if (!world) return;
    let cancelled = false;
    getDistrictWorldVisuals(uid, world.boardDateKey, { deckId: visualDeckId, cardId: visualCardId }, userEmail)
      .then((payload) => {
        if (!cancelled) setVisuals(payload);
      })
      .catch(() => {
        // Fallback visuals are already safe; keep gameplay uninterrupted.
      });
    return () => {
      cancelled = true;
    };
  }, [uid, userEmail, visualCardId, visualDeckId, world]);

  const selectedRouteNodeIds = useMemo(() => {
    if (!world || !selectedContract) return [];
    const graph = { nodes: world.nodes, edges: world.edges };
    const route = findAStarRoute(graph, "workshop", selectedContract.nodeId);
    return routeUsesGraphEdges(graph, route) ? route : [];
  }, [world, selectedContract]);

  const activeRouteNodeIds = useMemo(
    () => activeRun?.routeNodeIds ?? [],
    [activeRun],
  );
  const previewRouteNodeIds = activeRouteNodeIds.length > 1 ? activeRouteNodeIds : selectedRouteNodeIds;

  // ── Outbound travel animation ────────────────────────────────────────────
  useEffect(() => {
    if (!world || !activeRun?.routeNodeIds?.length) return;
    if (normalizeMissionPhase(activeRun.phase) !== MISSION_PHASE.TRAVELING_OUTBOUND) return;
    const routeNodeIds = activeRun.routeNodeIds;
    const checkpointNodeIndex = Math.max(0, Math.min(routeNodeIds.length - 1, activeRun.checkpointNodeIndex ?? 0));
    if (checkpointNodeIndex >= routeNodeIds.length - 1) return;

    const fromIndex = checkpointNodeIndex;
    const toIndex = checkpointNodeIndex + 1;
    const syncKey = `${activeRun.runId}:${fromIndex}`;
    if (animatingRef.current || lastCheckpointSyncRef.current === syncKey) return;
    lastCheckpointSyncRef.current = syncKey;
    animatingRef.current = true;

    let cancelled = false;
    const startedAt = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const raw = Math.min(1, (now - startedAt) / SEGMENT_DURATION_MS);
      const progress = smoothstep(raw);
      setSegmentTravel({ routeNodeIds, fromIndex, toIndex, progress });
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const nextNodeId = routeNodeIds[toIndex];
      persistDistrictCheckpoint(uid, activeRun.runId, nextNodeId, toIndex, userEmail)
        .then((run) => {
          setActionError(null);
          setActiveRun(run);
          setSegmentTravel(null);
          animatingRef.current = false;
        })
        .catch(() => {
          lastCheckpointSyncRef.current = "";
          setActionError(`Failed to sync outbound checkpoint. ${ACTION_ERROR_REFRESH_SUFFIX}`);
          setSegmentTravel(null);
          animatingRef.current = false;
        });
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animatingRef.current = false;
    };
  }, [activeRun, uid, userEmail, world]);

  // ── Inbound travel animation ─────────────────────────────────────────────
  useEffect(() => {
    if (!world || !activeRun?.routeNodeIds?.length) return;
    if (normalizeMissionPhase(activeRun.phase) !== MISSION_PHASE.TRAVELING_INBOUND) return;
    const routeNodeIds = activeRun.routeNodeIds;
    const checkpointNodeIndex = Math.max(0, Math.min(routeNodeIds.length - 1, activeRun.checkpointNodeIndex ?? 0));
    if (checkpointNodeIndex <= 0) return;

    const fromIndex = checkpointNodeIndex;
    const toIndex = checkpointNodeIndex - 1;
    const syncKey = `${activeRun.runId}:inbound:${fromIndex}`;
    if (animatingRef.current || lastCheckpointSyncRef.current === syncKey) return;
    lastCheckpointSyncRef.current = syncKey;
    animatingRef.current = true;

    let cancelled = false;
    const startedAt = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const raw = Math.min(1, (now - startedAt) / SEGMENT_DURATION_MS);
      const progress = smoothstep(raw);
      setSegmentTravel({ routeNodeIds, fromIndex, toIndex, progress });
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const nextNodeId = routeNodeIds[toIndex];
      persistDistrictCheckpoint(uid, activeRun.runId, nextNodeId, toIndex, userEmail)
        .then((run) => {
          setActionError(null);
          setActiveRun(run);
          setSegmentTravel(null);
          animatingRef.current = false;
        })
        .catch(() => {
          lastCheckpointSyncRef.current = "";
          setActionError(`Failed to sync return checkpoint. ${ACTION_ERROR_REFRESH_SUFFIX}`);
          setSegmentTravel(null);
          animatingRef.current = false;
        });
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animatingRef.current = false;
    };
  }, [activeRun, uid, userEmail, world]);

  const tokenPosition = useMemo(() => {
    if (!world) return null;
    if (segmentTravel?.routeNodeIds?.length) {
      const fromNode = world.nodes.find((n) => n.id === segmentTravel.routeNodeIds[segmentTravel.fromIndex]);
      const toNode = world.nodes.find((n) => n.id === segmentTravel.routeNodeIds[segmentTravel.toIndex]);
      if (!fromNode || !toNode) return null;
      return {
        x: fromNode.x + (toNode.x - fromNode.x) * segmentTravel.progress,
        y: fromNode.y + (toNode.y - fromNode.y) * segmentTravel.progress,
      };
    }
    const routeNodeIds = activeRun?.routeNodeIds;
    if (routeNodeIds?.length) {
      const checkpointIndex = Math.max(0, Math.min(routeNodeIds.length - 1, activeRun?.checkpointNodeIndex ?? 0));
      const node = world.nodes.find((candidate) => candidate.id === routeNodeIds[checkpointIndex]);
      if (node) return { x: node.x, y: node.y };
    }
    const workshop = world.nodes.find((node) => node.kind === "workshop");
    return workshop ? { x: workshop.x, y: workshop.y } : null;
  }, [activeRun, segmentTravel, world]);

  const handleSelectContract = useCallback((contractId: string) => {
    setActionError(null);
    setSelectedContractId(contractId);
  }, []);

  const handleLaunch = useCallback(async () => {
    if (
      !world
      || !selectedContractId
      || !selectedRunner
      || selectedRouteNodeIds.length < 2
      || !routeUsesGraphEdges({ nodes: world.nodes, edges: world.edges }, selectedRouteNodeIds)
    ) return;
    setLaunching(true);
    setActionError(null);
    try {
      const launchRunner = selectedRunner.runnerType === "card"
        ? {
          runnerType: "card" as const,
          cardId: selectedRunner.card?.id ?? null,
          cardName: selectedRunner.label,
          deckId: null,
          deckName: null,
        }
        : {
          runnerType: "deck" as const,
          deckId: selectedRunner.deck?.id ?? null,
          deckName: selectedRunner.label,
          cardId: null,
          cardName: null,
        };
      const run = await startDistrictRun(uid, selectedContractId, launchRunner, userEmail);
      setActiveRun(run);
      lastCheckpointSyncRef.current = "";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start run.";
      setActionError(`${message} ${ACTION_ERROR_REFRESH_SUFFIX}`);
    } finally {
      setLaunching(false);
    }
  }, [uid, world, selectedContractId, selectedRunner, selectedRouteNodeIds, userEmail]);

  const handleResolveEncounter = useCallback(async (choiceId: string) => {
    if (!activeRun) return;
    setResolvingEncounter(true);
    setActionError(null);
    try {
      const run = await resolveEncounter(uid, activeRun.runId, choiceId, userEmail);
      setActiveRun(run);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resolve encounter.";
      setActionError(`${message} ${ACTION_ERROR_REFRESH_SUFFIX}`);
    } finally {
      setResolvingEncounter(false);
    }
  }, [uid, activeRun, userEmail]);

  // Resolve the active card for a Streets brawl launch: the run's solo card, or
  // the first card of the squad deck when running a deck.
  const runnerCard = useMemo<CardPayload | null>(() => {
    if (!activeRun) return null;
    if (activeRun.cardId) {
      const card = cards.find((c) => c.id === activeRun.cardId);
      if (card) return card;
    }
    if (activeRun.deckId) {
      const deck = decks.find((d) => d.id === activeRun.deckId);
      const card = deck?.cards?.[0];
      if (card) return card;
    }
    return null;
  }, [activeRun, cards, decks]);

  const handleLaunchStreets = useCallback((option: MissionEncounterOption) => {
    if (!activeRun) return;
    const nodeId = activeRun.encounter?.triggeredAtNodeId ?? null;
    const url = buildStreetsLaunchUrl(option, activeRun.runId, nodeId, runnerCard, world, visuals);
    window.location.href = url;
  }, [activeRun, runnerCard, visuals, world]);

  // When the Streets game bounces back with ?streetsResult=win|lose, resolve the
  // active encounter once: a win banks the launch option's reward, a loss banks
  // the hidden consolation outcome. Guarded so it fires a single time per result.
  const streetsResultHandledRef = useRef(false);
  useEffect(() => {
    if (streetsResultHandledRef.current) return;
    if (!activeRun?.encounter || activeRun.encounter.resolvedAt) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("streetsResult");
    if (result !== "win" && result !== "lose") return;

    const options = activeRun.encounter.contract?.options ?? [];
    let choiceId: string | null = null;
    if (result === "win") {
      choiceId = params.get("choiceId")
        ?? options.find((opt) => opt.encounterType === "streets")?.id
        ?? null;
    } else {
      choiceId = options.find((opt) => opt.id === STREETS_LOSS_CHOICE_ID)?.id
        ?? STREETS_LOSS_CHOICE_ID;
    }

    streetsResultHandledRef.current = true;
    // Strip the result params so a refresh does not re-trigger resolution.
    window.history.replaceState({}, "", window.location.pathname);
    if (choiceId) void handleResolveEncounter(choiceId);
  }, [activeRun, handleResolveEncounter]);

  const handleResolvePoiFork = useCallback(async (choiceId: string) => {
    if (!activeRun) return;
    setResolvingFork(true);
    setActionError(null);
    try {
      const run = await resolvePoiFork(uid, activeRun.runId, choiceId, userEmail);
      setActiveRun(run);
      lastCheckpointSyncRef.current = "";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resolve POI fork.";
      setActionError(`${message} ${ACTION_ERROR_REFRESH_SUFFIX}`);
    } finally {
      setResolvingFork(false);
    }
  }, [uid, activeRun, userEmail]);

  const handleDismissDebrief = useCallback(() => {
    const runId = activeRun?.runId;
    setActiveRun(null);
    setSegmentTravel(null);
    setActionError(null);
    lastCheckpointSyncRef.current = "";
    if (runId) {
      // Best-effort: drop the terminal run from the active-runs collection so
      // a refresh does not re-hydrate the debrief. The archive copy is kept
      // server-side as the historical record.
      acknowledgeDistrictRun(uid, runId, userEmail).catch(() => {
        // Ignore acknowledge failures; local state is already cleared and a
        // subsequent refresh will simply re-show the debrief, which the user
        // can dismiss again.
      });
    }
  }, [activeRun, uid, userEmail]);

  const handleRefreshMissions = useCallback(() => {
    void loadDistrictWorld();
  }, [loadDistrictWorld]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#7de7ff", fontFamily: "monospace", fontSize: 13 }}>
        Loading district world…
      </div>
    );
  }

  if (error || !world) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ff3af2", fontFamily: "monospace", fontSize: 13 }}>
        {error ?? "District world unavailable."}
      </div>
    );
  }

  const phase = normalizeMissionPhase(activeRun?.phase);
  const activeTraveling = Boolean(
    activeRun
      && (phase === MISSION_PHASE.TRAVELING_OUTBOUND || phase === MISSION_PHASE.TRAVELING_INBOUND)
      && (phase === MISSION_PHASE.TRAVELING_OUTBOUND
        ? (activeRun.checkpointNodeIndex ?? 0) < ((activeRun.routeNodeIds?.length ?? 0) - 1)
        : (activeRun.checkpointNodeIndex ?? 0) > 0),
  );

  // Encounter data: use the full definition from the contract when available,
  // or fall back to a minimal stub built from the run record so the overlay
  // can always be shown after a page reload.
  let activeEncounter: MissionEncounter | null = null;
  if (phase === MISSION_PHASE.ENCOUNTER_RESOLUTION && activeRun?.encounter) {
    activeEncounter = activeRun.encounter.contract ?? selectedContract?.encounter ?? {
      id: activeRun.encounter.encounterId,
      badge: "⚡",
      prompt: "An unexpected situation has interrupted your run.",
      threat: "Unknown threat",
      options: [
        {
          id: "dismiss",
          label: "Push through",
          description: "Continue without engaging.",
          available: true,
        },
      ],
    };
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#03070e" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <MissionsMap
          world={world}
          activeRun={activeRun}
          selectedContractId={selectedContractId}
          onSelectContract={handleSelectContract}
          routeNodeIds={previewRouteNodeIds}
          backdropUrl={STATIC_MISSIONS_MAP_BACKDROP_URL}
          spriteUrl={visuals?.sprite.fallback ? null : visuals?.sprite.url}
          spriteExtraction={visuals?.extraction ?? null}
          tokenPosition={tokenPosition}
        />
      </div>

      {/* Right panel */}
      <div style={{ width: PANEL_WIDTH, flexShrink: 0, borderLeft: "1px solid rgba(125,231,255,0.18)", background: "rgba(5,10,20,0.97)", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Panel header: date, clear count, and active phase badge */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid rgba(125,231,255,0.15)", fontFamily: "monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#7de7ff", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span>{world.boardDateKey} · {world.contracts.filter((c) => c.status === "completed").length}/{world.contracts.length} Cleared</span>
          {activeRun && phase !== MISSION_PHASE.IDLE_AT_BASE && (
            <RunPhaseBadge phase={phase} />
          )}
        </div>

        {actionError && (
          <div style={ACTION_ERROR_BANNER_STYLE}>
            {actionError}
          </div>
        )}

        {/* Panel body: varies by active phase */}
        {phase === MISSION_PHASE.ENCOUNTER_RESOLUTION && activeEncounter ? (
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {selectedContract && (
              <ContractDetailPanel
                contract={selectedContract}
                onLaunch={handleLaunch}
                launching={launching}
                disabled
                runnerOptions={runnerOptions}
                selectedRunnerId={selectedRunner?.id ?? ""}
                selectedRunner={selectedRunner}
                onRunnerChange={setSelectedRunnerId}
              />
            )}
            <EncounterOverlay
              encounter={activeEncounter}
              onResolve={handleResolveEncounter}
              onLaunchStreets={handleLaunchStreets}
              resolving={resolvingEncounter}
            />
          </div>
        ) : phase === MISSION_PHASE.AT_POI_FORK && selectedContract ? (
          <PoiForkPanel
            contract={selectedContract}
            fork={selectedContract.fork ?? null}
            onResolve={handleResolvePoiFork}
            resolving={resolvingFork}
          />
        ) : phase === MISSION_PHASE.MISSION_COMPLETE || phase === MISSION_PHASE.MISSION_FAILED ? (
          <MissionDebriefPanel
            debrief={activeRun?.debrief}
            contract={selectedContract}
            onDismiss={handleDismissDebrief}
            onRefresh={handleRefreshMissions}
          />
        ) : selectedContract ? (
          <ContractDetailPanel
            contract={selectedContract}
            onLaunch={handleLaunch}
            launching={launching}
            disabled={activeTraveling}
            runnerOptions={runnerOptions}
            selectedRunnerId={selectedRunner?.id ?? ""}
            selectedRunner={selectedRunner}
            onRunnerChange={setSelectedRunnerId}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: 11 }}>
            Select a contract node
          </div>
        )}
      </div>
    </div>
  );
}

export function Missions() {
  const { user } = useAuth();
  if (!user) return null;

  if (isEnabled("MISSIONS", user.email)) {
    return (
      <div style={{ width: "100%", height: "calc(100vh - 60px)", overflow: "hidden" }}>
        <MissionsWorldView uid={user.uid} userEmail={user.email} />
      </div>
    );
  }

  return <MissionsPanel uid={user.uid} />;
}
