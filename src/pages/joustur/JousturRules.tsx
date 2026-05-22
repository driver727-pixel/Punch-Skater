/**
 * JousturRules.tsx — Reference page covering Joustur Skatur rules, traits,
 * faction passives, support effects, and rewards.
 */

import { Link } from "react-router-dom";

const FACTIONS = [
  {
    faction: "Rust Kids",
    crew: "Punch Skaters",
    passive: "patchworkRush",
    support: "recoveryPing — recover a captured rider from off-board back to entry (pos 1)",
  },
  {
    faction: "Neon Saints",
    crew: "Ne0n Legion",
    passive: "crowdHalo — +10 XP bonus at match end",
    support: "crowdRoar — grant an extra turn (same player moves again)",
  },
  {
    faction: "Signal Ghosts",
    crew: "Qu111s (Quills)",
    passive: "ghostRoute",
    support: "smokeScreen — your riders in the shared lane are immune to capture for the opponent's next turn",
  },
  {
    faction: "Chrome Syndicate",
    crew: "The Team",
    passive: "precisionCast",
    support: "reroll — regenerate the dice roll; extra turn to act on the new result",
  },
  {
    faction: "Voltage Vultures",
    crew: "Iron Curtains",
    passive: "surgeTrigger",
    support: "overclock — add +1 to the current roll (can exceed 3); extra turn",
  },
  {
    faction: "Alley Wraiths",
    crew: "The Asclepians",
    passive: "cutline",
    support: "sideRoute — teleport one of your entry-zone riders directly to the exit zone",
  },
];

const TRAITS = [
  { name: "boost",  desc: "Speed-focused rider. Increases early-entry scoring." },
  { name: "guard",  desc: "Defensive rider. Resists board disruption." },
  { name: "feint",  desc: "Misdirection specialist. Slips through contested lanes." },
  { name: "anchor", desc: "Holds ground. Benefits from Stealth Alcoves." },
  { name: "strike", desc: "Combative rider. +15 XP bonus at match end." },
  { name: "slip",   desc: "Ghostline rider. Avoids shared-lane pressure." },
  { name: "surge",  desc: "Burst-movement rider. Thrives on high rolls." },
  { name: "echo",   desc: "Crowd-favourite. +10 XP bonus at match end." },
];

const REWARDS_TABLE = [
  { condition: "Participation (any result)",  xp: "+50",  ozzies: "+10" },
  { condition: "Win bonus",                   xp: "+100", ozzies: "+25" },
  { condition: "strike trait in lineup",      xp: "+15",  ozzies: "—"   },
  { condition: "echo trait in lineup",        xp: "+10",  ozzies: "—"   },
  { condition: "crowdHalo faction passive",   xp: "+10",  ozzies: "—"   },
  { condition: "crowdRoar support activated", xp: "+10",  ozzies: "—"   },
];

export function JousturRules() {
  return (
    <div className="page joustur-rules">
      <p className="page-eyebrow">Joustur Skatur</p>
      <h1 className="page-title">Rules</h1>

      <section className="joustur-rules__section">
        <h2>How to play</h2>
        <ol className="joustur-rules__list">
          <li>
            Build a lineup of <strong>6 rider cards</strong> and{" "}
            <strong>1 support card</strong> before starting a match.
          </li>
          <li>
            Two players take turns asynchronously — no need to be online at
            the same time.
          </li>
          <li>
            On your turn, first <strong>roll die</strong> (3 tetrahedral
            dice — each with 2 marked corners and 2 unmarked corners. Count
            marked corners facing up → 0–3 steps). A roll of 0 lets you
            move <strong>4 tiles</strong> instead of skipping your turn!
          </li>
          <li>
            Once per match, instead of moving a rider, you may{" "}
            <strong>activate your support card</strong> for a special effect.
          </li>
          <li>
            The first player to get all 6 riders off the board (past position
            14) wins. An <strong>exact roll is required to exit</strong> — you
            cannot overshoot.
          </li>
        </ol>
      </section>

      <section className="joustur-rules__section">
        <h2>Board layout</h2>
        <div className="joustur-rules__board-diagram">
          <div className="joustur-rules__lane joustur-rules__lane--private">
            <p>Player 1 path: tiles 4→3→2→1→(shared)→6→5</p>
            <p>Player 2 path: tiles 18→17→16→15→(shared)→20→19</p>
            <p className="joustur-rules__lane-note">Entry &amp; exit tiles are private — no captures</p>
          </div>
          <div className="joustur-rules__lane joustur-rules__lane--shared">
            <p>Shared lane: tiles 7→8→9→10→11→12→13→14</p>
            <p className="joustur-rules__lane-note">
              Both players share these tiles — captures apply · Stealth Alcoves at path indices 6, 8, 12
            </p>
          </div>
        </div>

        <h3>Stealth Alcoves ⚡</h3>
        <ul className="joustur-rules__list">
          <li>Landing on a Stealth Alcove grants you an <strong>extra turn</strong>.</li>
          <li>
            Stealth Alcoves in the shared lane also make your rider{" "}
            <strong>safe from capture</strong> — your opponent cannot land there
            while you occupy it.
          </li>
        </ul>

        <h3>Captures</h3>
        <ul className="joustur-rules__list">
          <li>Captures only happen in the <strong>shared lane</strong> (tiles 7–14).</li>
          <li>Landing on an opponent's rider sends it back to off-board.</li>
          <li>Riders on Stealth Alcoves are safe. Riders protected by smoke screen are safe.</li>
        </ul>
      </section>

      <section className="joustur-rules__section">
        <h2>Factions &amp; support effects</h2>
        <p className="joustur-rules__note">
          Your <strong>support card's crew</strong> determines your faction,
          passive, and one-time support effect. Crews not listed below default
          to the Rust Kids passive.
        </p>
        <ul className="joustur-rules__faction-list">
          {FACTIONS.map((f) => (
            <li key={f.faction} className="joustur-rules__faction-card">
              <h3 className="joustur-rules__faction-name">{f.faction}</h3>
              <p className="joustur-rules__faction-crew">Crew: {f.crew}</p>
              <p className="joustur-rules__faction-passive">
                <strong>Passive:</strong> {f.passive}
              </p>
              <p className="joustur-rules__faction-support">
                <strong>Support:</strong> {f.support}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="joustur-rules__section">
        <h2>Rider traits</h2>
        <p className="joustur-rules__note">
          Each rider card's trait is resolved from its joust traits list (exact
          name → keyword → default: boost).
        </p>
        <ul className="joustur-rules__trait-list">
          {TRAITS.map((t) => (
            <li key={t.name} className="joustur-rules__trait-item">
              <strong>{t.name}</strong> — {t.desc}
            </li>
          ))}
        </ul>
      </section>

      <section className="joustur-rules__section">
        <h2>Rewards</h2>
        <table className="joustur-rules__table">
          <thead>
            <tr>
              <th>Condition</th>
              <th>XP</th>
              <th>Ozzies</th>
            </tr>
          </thead>
          <tbody>
            {REWARDS_TABLE.map((r) => (
              <tr key={r.condition}>
                <td>{r.condition}</td>
                <td>{r.xp}</td>
                <td>{r.ozzies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="joustur-rules__footer">
        <Link to="/joustur" className="btn-primary">
          ← Back to Joustur
        </Link>
      </div>
    </div>
  );
}
