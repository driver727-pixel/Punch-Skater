import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { isEnabled } from "../lib/featureFlags";
import type { CompiledNavDeck, DataShard, NavDeckSlots, ShardKind } from "../lib/flashCourier";
import type { BriefingChoice, StoryNode } from "../lib/runBriefing";
import { resolveRunBriefing } from "../lib/runBriefing";
import type { Archetype, District } from "../lib/types";
import { SplicerTerminal, useCompileAnimation } from "./flashCourier/SplicerTerminal";

// ── Run Briefing display ──────────────────────────────────────────────────────

function RunBriefingPanel({
  node,
  onChoose,
  choosing,
  chosenId,
}: {
  node: StoryNode;
  onChoose: (choice: BriefingChoice) => void;
  choosing: boolean;
  chosenId: string | null;
}) {
  return (
    <div className="run-briefing">
      <div className="run-briefing__header">
        <p className="run-briefing__eyebrow">{node.eyebrow}</p>
        <h2 className="run-briefing__title">{node.title}</h2>
      </div>

      <div className="run-briefing__prose">
        {node.prose.map((paragraph, i) => (
          <p key={i} className="run-briefing__paragraph">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="run-briefing__choices">
        <p className="run-briefing__choices-label">▶ CHOOSE YOUR APPROACH</p>
        {node.choices.map((choice) => {
          const isChosen = chosenId === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              className={`run-briefing__choice${isChosen ? " run-briefing__choice--chosen" : ""}`}
              onClick={() => onChoose(choice)}
              disabled={choosing || chosenId !== null}
              aria-pressed={isChosen}
            >
              <span className="run-briefing__choice-label">{choice.label}</span>
              <span className="run-briefing__choice-consequence">{choice.consequence}</span>
              {choice.modifiers && (
                <div className="run-briefing__choice-mods">
                  {choice.modifiers.stealthDelta != null && choice.modifiers.stealthDelta !== 0 && (
                    <span className={`run-briefing__choice-mod run-briefing__choice-mod--${choice.modifiers.stealthDelta > 0 ? "pos" : "neg"}`}>
                      {choice.modifiers.stealthDelta > 0 ? "+" : ""}{choice.modifiers.stealthDelta} STEALTH
                    </span>
                  )}
                  {choice.modifiers.speedDelta != null && choice.modifiers.speedDelta !== 0 && (
                    <span className={`run-briefing__choice-mod run-briefing__choice-mod--${choice.modifiers.speedDelta > 0 ? "pos" : "neg"}`}>
                      {choice.modifiers.speedDelta > 0 ? "+" : ""}{choice.modifiers.speedDelta} SPEED
                    </span>
                  )}
                  {choice.modifiers.rewardDelta != null && choice.modifiers.rewardDelta !== 0 && (
                    <span className={`run-briefing__choice-mod run-briefing__choice-mod--${choice.modifiers.rewardDelta > 0 ? "pos" : "neg"}`}>
                      {choice.modifiers.rewardDelta > 0 ? "+" : ""}{choice.modifiers.rewardDelta} REWARD
                    </span>
                  )}
                  {choice.modifiers.riskDelta != null && choice.modifiers.riskDelta !== 0 && (
                    <span className={`run-briefing__choice-mod run-briefing__choice-mod--${choice.modifiers.riskDelta > 0 ? "neg" : "pos"}`}>
                      {choice.modifiers.riskDelta > 0 ? "+" : ""}{choice.modifiers.riskDelta} RISK
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {chosenId && (
        <div className="run-briefing__committed" role="status">
          <span className="run-briefing__committed-glyph">◈</span>
          ROUTE COMMITTED — BURN IN PROGRESS
        </div>
      )}
    </div>
  );
}

// ── Card picker (inline, no modal) ────────────────────────────────────────────

function CardIdentityPicker({
  archetype,
  district,
  onArchetypeChange,
  onDistrictChange,
}: {
  archetype: Archetype | "";
  district: District | "";
  onArchetypeChange: (a: Archetype) => void;
  onDistrictChange: (d: District) => void;
}) {
  const { cards } = useCollection();

  const uniqueArchetypes = useMemo((): Archetype[] => {
    const seen = new Set<Archetype>();
    for (const card of cards) {
      if (card?.prompts?.archetype) seen.add(card.prompts.archetype as Archetype);
    }
    return Array.from(seen);
  }, [cards]);

  const uniqueDistricts = useMemo((): District[] => {
    const seen = new Set<District>();
    for (const card of cards) {
      if (card?.prompts?.district) seen.add(card.prompts.district as District);
    }
    return Array.from(seen);
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div className="flash-courier__no-cards">
        <p>No forged cards found in your collection.</p>
        <p>Visit the <a href="/forge">Card Forge</a> to create your first courier.</p>
      </div>
    );
  }

  return (
    <div className="flash-courier__identity-picker">
      <div className="flash-courier__identity-picker-label">
        SELECT ACTIVE COVER IDENTITY &amp; DISTRICT
      </div>

      <div className="flash-courier__identity-selects">
        <label className="flash-courier__select-group">
          <span className="flash-courier__select-label">◈ Cover Identity</span>
          <select
            className="flash-courier__select"
            value={archetype}
            onChange={(e) => onArchetypeChange(e.target.value as Archetype)}
            aria-label="Cover Identity"
          >
            <option value="">— choose identity —</option>
            {uniqueArchetypes.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className="flash-courier__select-group">
          <span className="flash-courier__select-label">◎ District</span>
          <select
            className="flash-courier__select"
            value={district}
            onChange={(e) => onDistrictChange(e.target.value as District)}
            aria-label="District"
          >
            <option value="">— choose district —</option>
            {uniqueDistricts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

// ── Flash Courier page ────────────────────────────────────────────────────────

const EMPTY_SLOTS: NavDeckSlots = { vector: null, ghost: null, payload: null };

export function FlashCourier() {
  const { user } = useAuth();
  const [archetype, setArchetype] = useState<Archetype | "">("");
  const [district, setDistrict] = useState<District | "">("");
  const [slots, setSlots] = useState<NavDeckSlots>(EMPTY_SLOTS);
  const [briefingNode, setBriefingNode] = useState<StoryNode | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const handleSlotChange = useCallback(
    (kind: ShardKind, shard: DataShard | null) => {
      setSlots((prev) => ({ ...prev, [kind]: shard }));
    },
    [],
  );

  const handleCompileComplete = useCallback(() => {
    if (!slots.vector || !slots.ghost || !slots.payload || !archetype || !district) return;
    const deck: CompiledNavDeck = {
      navDeckId: `${user?.uid ?? "anon"}_${Date.now()}`,
      uid: user?.uid ?? "",
      archetype: archetype as Archetype,
      district: district as District,
      vector: slots.vector,
      ghost: slots.ghost,
      payload: slots.payload,
      compiledAt: new Date().toISOString(),
    };
    setBriefingNode(resolveRunBriefing(deck));
    setChosenId(null);
  }, [slots, archetype, district, user?.uid]);

  const { compiling, compileProgress, compileLog, triggerCompile } =
    useCompileAnimation(handleCompileComplete);

  const canCompile =
    Boolean(archetype) &&
    Boolean(district) &&
    slots.vector !== null &&
    slots.ghost !== null &&
    slots.payload !== null;

  const handleCompile = useCallback(() => {
    if (!canCompile) return;
    setBriefingNode(null);
    setChosenId(null);
    triggerCompile();
  }, [canCompile, triggerCompile]);

  const handleChoose = useCallback((choice: BriefingChoice) => {
    setChosenId(choice.id);
  }, []);

  const handleReset = useCallback(() => {
    setSlots(EMPTY_SLOTS);
    setBriefingNode(null);
    setChosenId(null);
  }, []);

  if (!isEnabled("FLASH_COURIER", user?.email)) {
    return (
      <div className="flash-courier__locked">
        <p>Flash Courier is not yet available.</p>
      </div>
    );
  }

  return (
    <div className="flash-courier">
      {/* ── Page header ── */}
      <div className="flash-courier__page-header">
        <div className="flash-courier__page-header-scanline" aria-hidden="true" />
        <h1 className="flash-courier__page-title">FLASH COURIER</h1>
        <p className="flash-courier__page-sub">
          Compile your Burn Route. Slot your Data Shards. Read the briefing.
        </p>
      </div>

      {/* ── Identity picker ── */}
      <CardIdentityPicker
        archetype={archetype}
        district={district}
        onArchetypeChange={setArchetype}
        onDistrictChange={setDistrict}
      />

      {/* ── Main layout: terminal + briefing ── */}
      <div className="flash-courier__layout">
        <div className="flash-courier__terminal-col">
          <SplicerTerminal
            slots={slots}
            onSlotChange={handleSlotChange}
            onCompile={handleCompile}
            compiling={compiling}
            compileProgress={compileProgress}
            compileLog={compileLog}
          />
        </div>

        <div className="flash-courier__briefing-col">
          {briefingNode ? (
            <>
              <RunBriefingPanel
                node={briefingNode}
                onChoose={handleChoose}
                choosing={false}
                chosenId={chosenId}
              />
              {chosenId && (
                <button
                  type="button"
                  className="flash-courier__reset-btn"
                  onClick={handleReset}
                >
                  ↩ COMPILE NEW ROUTE
                </button>
              )}
            </>
          ) : (
            <div className="flash-courier__briefing-placeholder">
              <span className="flash-courier__briefing-placeholder-glyph">◈</span>
              <p>Slot all three shards and compile to receive your Run Briefing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
