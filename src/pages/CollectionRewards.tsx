import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  evaluateCollectionRewards,
  type CollectionRewardEvaluation,
  type CollectionRewardFilter,
} from "../lib/collectionRewards";
import { claimCollectionReward, fetchCollectionRewards } from "../services/collectionRewards";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../context/AuthContext";
import { sfxSuccess } from "../lib/sfx";

function formatCollectionRewardMeta(track: string, seasonal?: boolean): string {
  return seasonal ? `${track} · seasonal` : track;
}

export function CollectionRewards() {
  const { user } = useAuth();
  const { cards } = useCollection();
  const navigate = useNavigate();

  const [rewardFilter, setRewardFilter] = useState<CollectionRewardFilter>("all");
  const [rewardEvaluation, setRewardEvaluation] = useState<CollectionRewardEvaluation>(() =>
    evaluateCollectionRewards([])
  );
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardClaimingId, setRewardClaimingId] = useState<string | null>(null);
  const [rewardMessage, setRewardMessage] = useState("");
  const [rewardError, setRewardError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setRewardError("");
    setRewardMessage("");

    if (!user) {
      setRewardEvaluation(evaluateCollectionRewards(cards));
      return;
    }

    setRewardLoading(true);
    fetchCollectionRewards(user)
      .then((result) => {
        if (!cancelled) setRewardEvaluation(result.evaluation);
      })
      .catch((error) => {
        if (!cancelled) {
          setRewardEvaluation(evaluateCollectionRewards(cards));
          setRewardError(error instanceof Error ? error.message : "Failed to load collection rewards.");
        }
      })
      .finally(() => {
        if (!cancelled) setRewardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cards, user]);

  const rewardMilestones = useMemo(() => {
    const milestones = rewardEvaluation.milestones;
    switch (rewardFilter) {
      case "claimable":
        return milestones.filter((e) => e.eligible && !e.claimed);
      case "owned":
        return milestones.filter((e) => e.claimed);
      case "locked":
        return milestones.filter((e) => !e.eligible && !e.claimed);
      case "faction":
        return milestones.filter((e) => e.milestone.track === "faction");
      case "district":
        return milestones.filter((e) => e.milestone.track === "district");
      case "seasonal":
        return milestones.filter((e) => e.milestone.seasonal);
      default:
        return milestones;
    }
  }, [rewardEvaluation.milestones, rewardFilter]);

  const claimableRewardCount = rewardEvaluation.milestones.filter((e) => e.eligible && !e.claimed).length;

  const handleClaimReward = async (milestoneId: string) => {
    if (!user) return;
    setRewardClaimingId(milestoneId);
    setRewardError("");
    setRewardMessage("");
    try {
      const result = await claimCollectionReward(user, milestoneId);
      setRewardEvaluation(result.evaluation);
      setRewardMessage(
        result.claimed
          ? `Claimed ${result.rewards.map((reward) => reward.name).join(", ")}.`
          : "Milestone was already claimed.",
      );
      if (result.claimed) sfxSuccess();
    } catch (error) {
      setRewardError(error instanceof Error ? error.message : "Failed to claim collection reward.");
    } finally {
      setRewardClaimingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Cosmetic Prestige</p>
          <h1 className="page-title">Collection Rewards</h1>
          <p>
            Badges, titles, frames, lore, and capped cosmetic reroll tokens. No stat boosts, rarity guarantees,
            Deck Power bonuses, or battle advantages.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn-outline btn-sm" onClick={() => navigate("/collection")}>
            ← Back to Collection
          </button>
        </div>
      </div>

      <div className="collection-rewards-score">
        <span>Collection Score</span>
        <strong>{rewardEvaluation.score}</strong>
        <small>
          {rewardEvaluation.uniqueCardCount} unique · {rewardEvaluation.duplicateVolumeScore} duplicate volume
        </small>
      </div>

      <div className="collection-rewards-stats">
        <span><strong>{rewardEvaluation.state.badgeIds.length}</strong> Badges</span>
        <span><strong>{rewardEvaluation.state.titleIds.length}</strong> Titles</span>
        <span><strong>{rewardEvaluation.state.frameIds.length}</strong> Frames</span>
        <span><strong>{rewardEvaluation.state.loreIds.length}</strong> Lore</span>
        <span><strong>{rewardEvaluation.state.rerollTokens}</strong> Cosmetic rerolls</span>
        <span><strong>{claimableRewardCount}</strong> Claimable</span>
      </div>

      <div className="collection-rewards-filters">
        {(["all", "claimable", "owned", "locked", "faction", "district", "seasonal"] as CollectionRewardFilter[]).map(
          (filter) => (
            <button
              key={filter}
              className={rewardFilter === filter ? "btn-primary btn-sm" : "btn-outline btn-sm"}
              type="button"
              onClick={() => setRewardFilter(filter)}
            >
              {filter[0].toUpperCase() + filter.slice(1)}
            </button>
          ),
        )}
      </div>

      {rewardMessage && (
        <div className="collection-rewards-message collection-rewards-message--ok">{rewardMessage}</div>
      )}
      {rewardError && (
        <div className="collection-rewards-message collection-rewards-message--error">{rewardError}</div>
      )}
      {rewardLoading && (
        <div className="collection-rewards-message app-status-banner">Syncing reward claims…</div>
      )}

      <div className="collection-rewards-list">
        {rewardMilestones.map((entry) => (
          <article
            key={entry.milestone.id}
            className={`collection-reward-card${entry.claimed ? " collection-reward-card--owned" : ""}${entry.eligible && !entry.claimed ? " collection-reward-card--claimable" : ""}`}
          >
            <div className="collection-reward-card__top">
              <div>
                <strong>{entry.milestone.name}</strong>
                <span>{formatCollectionRewardMeta(entry.milestone.track, entry.milestone.seasonal)}</span>
              </div>
              <span className="collection-reward-card__status">
                {entry.claimed ? "Owned" : entry.eligible ? "Claimable" : `${entry.percent}%`}
              </span>
            </div>
            <p>{entry.milestone.description}</p>
            <div className="collection-reward-progress" aria-label={`${entry.current} of ${entry.target}`}>
              <span style={{ width: `${entry.percent}%` }} />
            </div>
            <div className="collection-reward-card__rewards">
              {entry.rewards.map((reward) => (
                <span key={reward.id} className={`collection-reward-chip collection-reward-chip--${reward.kind}`}>
                  {reward.kind.replace(/_/g, " ")} · {reward.name}
                </span>
              ))}
            </div>
            <button
              className="btn-primary btn-sm"
              type="button"
              disabled={!entry.eligible || entry.claimed || rewardClaimingId !== null || !user}
              onClick={() => handleClaimReward(entry.milestone.id)}
            >
              {rewardClaimingId === entry.milestone.id ? "Claiming…" : entry.claimed ? "Claimed" : "Claim"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
