import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { DECK_CARD_LIMIT, useDecks } from "../hooks/useDecks";
import { computeDeckTotalPower } from "../lib/battle";
import { getForgeClassOptions } from "../lib/cardClassProgression";
import { computeCrewOzzies, computeCrewXp } from "../lib/progression";

interface ForgeObjectivePanelProps {
  onOpenStartHere: () => void;
}

interface ObjectiveState {
  title: string;
  description: string;
  primaryLabel: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}

function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getObjectiveState({
  signedIn,
  collectionCount,
  hasDeck,
  deckCardCount,
  hasPrimaryDeck,
  hasChallenger,
  missionXp,
}: {
  signedIn: boolean;
  collectionCount: number;
  hasDeck: boolean;
  deckCardCount: number;
  hasPrimaryDeck: boolean;
  hasChallenger: boolean;
  missionXp: number;
}): ObjectiveState {
  if (!signedIn) {
    return {
      title: collectionCount > 0 ? "Turn your local forge into a real account" : "Forge a first skater",
      description: collectionCount > 0
        ? `You already have ${formatCount(collectionCount, "local card")}. Create an account to keep them in cloud progression, build Crews, run Missions, race rivals, and trade.`
        : "Guest mode is a safe forge preview. Create an account to save cards, build a 6-card Crew, run Missions, enter Race Arena, trade, and open Workshop.",
      primaryLabel: "Create account",
      primaryTo: "/login",
      secondaryLabel: "Sign in",
      secondaryTo: "/login",
    };
  }

  if (collectionCount === 0) {
    return {
      title: "Forge and save your first card",
      description: "Start your collection with a first forged skater, then turn that card into the core of your first Crew.",
      primaryLabel: "Start forging",
    };
  }

  if (!hasDeck) {
    return {
      title: "Build your first Crew",
      description: `You have ${formatCount(collectionCount, "card")} in your collection. Open Collection and start assembling a 6-card Crew.`,
      primaryLabel: "Open Collection",
      primaryTo: "/collection",
    };
  }

  if (deckCardCount < DECK_CARD_LIMIT) {
    return {
      title: "Fill your active Crew to six cards",
      description: `Your current Crew has ${deckCardCount}/${DECK_CARD_LIMIT} cards. Finish the full lineup so Missions, seasonal rankings, and Race Arena all feel meaningful.`,
      primaryLabel: "Finish Crew",
      primaryTo: "/collection?tab=decks",
      secondaryLabel: "Forge another card",
    };
  }

  if (!hasPrimaryDeck || !hasChallenger) {
    return {
      title: "Publish a race-ready Crew",
      description: "Set a Primary Crew and pick one Challenger card so your build is ready for the Race Arena starting grid.",
      primaryLabel: "Set race setup",
      primaryTo: "/collection?tab=decks",
      secondaryLabel: "Open Race Arena",
      secondaryTo: "/arena",
    };
  }

  if (missionXp <= 0) {
    return {
      title: "Run your first Mission",
      description: "Your Crew is ready. Missions are the fastest way to start earning XP, Ozzies, unlocks, and route pressure stories.",
      primaryLabel: "Open Missions",
      primaryTo: "/missions",
      secondaryLabel: "Open Race Arena",
      secondaryTo: "/arena",
    };
  }

  return {
    title: "Push progression on all fronts",
    description: "Keep tuning your Crew, race other challengers, submit a seasonal lineup, and use Workshop to upgrade how your skaters ride and look.",
    primaryLabel: "Run Missions",
    primaryTo: "/missions",
    secondaryLabel: "Leaderboard",
    secondaryTo: "/leaderboard",
  };
}

export function ForgeObjectivePanel({ onOpenStartHere }: ForgeObjectivePanelProps) {
  const { user, userProfile } = useAuth();
  const { cards } = useCollection();
  const { decks } = useDecks();

  const primaryDeck = decks.find((deck) => deck.isPrimary) ?? decks[0] ?? null;
  const primaryDeckCards = primaryDeck?.cards ?? [];
  const deckPower = computeDeckTotalPower(primaryDeckCards);
  const crewOzzies = computeCrewOzzies(primaryDeckCards);
  const crewXp = computeCrewXp(primaryDeckCards);
  const missionXp = Number(userProfile?.missionXp ?? 0);
  const missionOzzies = Number(userProfile?.missionOzzies ?? 0);
  const forgeOptions = getForgeClassOptions({ missionXp, missionOzzies, deckPower });
  const highestUnlockedForge = [...forgeOptions].reverse().find((option) => option.unlocked)?.rarity ?? "Punch Skater";
  const nextUnlock = forgeOptions.find((option) => !option.unlocked) ?? null;
  const objective = getObjectiveState({
    signedIn: Boolean(user),
    collectionCount: cards.length,
    hasDeck: Boolean(primaryDeck),
    deckCardCount: primaryDeckCards.length,
    hasPrimaryDeck: Boolean(primaryDeck?.isPrimary),
    hasChallenger: Boolean(primaryDeck?.challengerCardId),
    missionXp,
  });
  return (
    <section className="forge-objective-panel" aria-label="Current objective and progression">
      <div className="forge-objective-card forge-objective-card--primary">
        <span className="forge-objective-eyebrow">Current objective</span>
        <h2 className="forge-objective-title">{objective.title}</h2>
        <p className="forge-objective-copy">{objective.description}</p>
        <div className="forge-objective-actions">
          {objective.primaryTo ? (
            <Link className="btn-primary btn-glass" to={objective.primaryTo}>
              {objective.primaryLabel}
            </Link>
          ) : (
            <button type="button" className="btn-primary btn-glass" onClick={onOpenStartHere}>
              {objective.primaryLabel}
            </button>
          )}
          {objective.secondaryLabel && (
            objective.secondaryTo ? (
              <Link className="btn-outline btn-glass" to={objective.secondaryTo}>
                {objective.secondaryLabel}
              </Link>
            ) : (
              <button type="button" className="btn-outline btn-glass" onClick={onOpenStartHere}>
                {objective.secondaryLabel}
              </button>
            )
          )}
        </div>
        <p className="forge-objective-status">
          {user
            ? `Cloud progression active${user.email ? ` for ${user.email}` : ""}.`
            : "Guest forge preview only — account-gated systems stay locked until sign-in."}
        </p>
      </div>

      <div className="forge-objective-card">
        <span className="forge-objective-eyebrow">Progress snapshot</span>
        <div className="forge-objective-stats">
          <div className="forge-objective-stat">
            <span className="forge-objective-stat-label">Collection</span>
            <strong>{cards.length}</strong>
          </div>
          <div className="forge-objective-stat">
            <span className="forge-objective-stat-label">Crew size</span>
            <strong>{primaryDeckCards.length}/{DECK_CARD_LIMIT}</strong>
          </div>
          <div className="forge-objective-stat">
            <span className="forge-objective-stat-label">Crew power</span>
            <strong>{deckPower}</strong>
          </div>
          <div className="forge-objective-stat">
            <span className="forge-objective-stat-label">Crew Ozzies</span>
            <strong>{crewOzzies.toLocaleString()}</strong>
          </div>
          <div className="forge-objective-stat">
            <span className="forge-objective-stat-label">Mission XP</span>
            <strong>{missionXp.toLocaleString()}</strong>
          </div>
          <div className="forge-objective-stat">
            <span className="forge-objective-stat-label">Crew XP</span>
            <strong>{crewXp.toLocaleString()}</strong>
          </div>
        </div>
        <div className="forge-objective-unlocks">
          <p>
            <span className="forge-objective-stat-label">Highest forge unlocked</span>
            <strong>{highestUnlockedForge}</strong>
          </p>
          <p>
            <span className="forge-objective-stat-label">Next unlock</span>
            <strong>{nextUnlock?.rarity ?? "Legendary stays reward-only"}</strong>
          </p>
          {nextUnlock?.unlockHint && (
            <p className="forge-objective-unlock-hint">{nextUnlock.unlockHint}</p>
          )}
          {user && missionOzzies > 0 && (
            <p className="forge-objective-unlock-hint">
              Mission Ozzies banked: {missionOzzies.toLocaleString()}
            </p>
          )}
        </div>
      </div>

    </section>
  );
}
