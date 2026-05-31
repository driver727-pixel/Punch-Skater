import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { DECK_CARD_LIMIT, useDecks } from "../hooks/useDecks";
import { useModalA11y } from "../hooks/useModalA11y";

const SESSION_KEY = "current-objective-popup-shown";

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
      primaryTo: "/",
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
      secondaryTo: "/",
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

export function CurrentObjectivePopup() {
  const { user, userProfile } = useAuth();
  const { cards } = useCollection();
  const { decks } = useDecks();
  const navigate = useNavigate();

  const primaryDeck = decks.find((deck) => deck.isPrimary) ?? decks[0] ?? null;
  const primaryDeckCards = primaryDeck?.cards ?? [];
  const missionXp = Number(userProfile?.missionXp ?? 0);

  const objective = getObjectiveState({
    signedIn: Boolean(user),
    collectionCount: cards.length,
    hasDeck: Boolean(primaryDeck),
    deckCardCount: primaryDeckCards.length,
    hasPrimaryDeck: Boolean(primaryDeck?.isPrimary),
    hasChallenger: Boolean(primaryDeck?.challengerCardId),
    missionXp,
  });

  const prevUserRef = useRef<typeof user>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    // Logged in this render cycle (new login event) — clear session flag so popup re-shows.
    if (prevUser === null && user !== null) {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    }

    // Show popup once per session if user is present and it hasn't been shown yet.
    if (user !== undefined) {
      try {
        const alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
        if (!alreadyShown) {
          setOpen(true);
        }
      } catch {
        setOpen(true);
      }
    }
  }, [user]);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }, []);

  const dialogRef = useModalA11y({ onClose: handleDismiss, active: open });

  if (!open) return null;

  return (
    <div
      className="modal-overlay forge-objective-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="current-objective-popup-title"
      onClick={handleDismiss}
    >
      <div
        className="modal-panel forge-objective-popup"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="close-btn modal-close"
          aria-label="Dismiss current objective"
          onClick={handleDismiss}
        >
          ✕
        </button>
        <span className="forge-objective-eyebrow">Current objective</span>
        <h2 className="forge-objective-title" id="current-objective-popup-title">{objective.title}</h2>
        <p className="forge-objective-copy">{objective.description}</p>
        <div className="forge-objective-actions">
          {objective.primaryTo ? (
            <Link className="btn-primary btn-glass" to={objective.primaryTo} onClick={handleDismiss}>
              {objective.primaryLabel}
            </Link>
          ) : (
            <button type="button" className="btn-primary btn-glass" onClick={() => { handleDismiss(); navigate("/"); }}>
              {objective.primaryLabel}
            </button>
          )}
          {objective.secondaryLabel && (
            objective.secondaryTo ? (
              <Link className="btn-outline btn-glass" to={objective.secondaryTo} onClick={handleDismiss}>
                {objective.secondaryLabel}
              </Link>
            ) : (
              <button type="button" className="btn-outline btn-glass" onClick={() => { handleDismiss(); navigate("/"); }}>
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
    </div>
  );
}
