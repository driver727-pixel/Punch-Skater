import { useCallback, useMemo, useState } from "react";
import {
  addXpToPass,
  BATTLE_PASS_MAX_TIER,
  BATTLE_PASS_TIERS,
  claimReward,
  getCurrentSeasonId,
  getSeasonBounds,
  getXpProgress,
  loadBattlePassState,
  type BattlePassTier,
  type LocalBattlePassState,
} from "../lib/battlePass";
import { isEnabled } from "../lib/featureFlags";
import { useTier } from "../context/TierContext";

export interface BattlePassHookState {
  enabled: boolean;
  state: LocalBattlePassState;
  seasonId: string;
  seasonName: string;
  seasonEndsAt: string;
  tier: number;
  maxTier: number;
  xpProgress: { currentXp: number; xpToNext: number; percentage: number };
  tiers: BattlePassTier[];
  addXp: (amount: number) => void;
  claimFreeReward: (tier: number) => void;
  claimPremiumReward: (tier: number) => void;
  isRewardClaimed: (tier: number, premium: boolean) => boolean;
  isRewardAvailable: (tier: number, premium: boolean) => boolean;
}

export function useBattlePass(): BattlePassHookState {
  const enabled = isEnabled("BATTLE_PASS");
  const { tier } = useTier();
  const [state, setState] = useState<LocalBattlePassState>(loadBattlePassState);

  const seasonId = getCurrentSeasonId();
  const bounds = useMemo(() => getSeasonBounds(seasonId), [seasonId]);
  const effectiveState = useMemo(
    () => (tier === "tier3" ? { ...state, isPremium: true } : state),
    [state, tier],
  );
  const xpProgress = useMemo(() => getXpProgress(effectiveState), [effectiveState]);

  const addXp = useCallback((amount: number) => {
    setState((prev) => addXpToPass(prev, amount));
  }, []);

  const claimFreeReward = useCallback((tier: number) => {
    setState((prev) => claimReward(prev, tier, false));
  }, []);

  const claimPremiumReward = useCallback((tier: number) => {
    setState((prev) => claimReward(
      tier === "tier3" ? { ...prev, isPremium: true } : prev,
      tier,
      true,
    ));
  }, [tier]);

  const isRewardClaimed = useCallback(
    (tier: number, premium: boolean) => {
      return premium
        ? state.claimedPremiumRewards.includes(tier)
        : state.claimedFreeRewards.includes(tier);
    },
    [state.claimedFreeRewards, state.claimedPremiumRewards],
  );

  const isRewardAvailable = useCallback(
    (tier: number, premium: boolean) => {
      if (tier > effectiveState.tier) return false;
      if (premium && !effectiveState.isPremium) return false;
      return !(premium
        ? effectiveState.claimedPremiumRewards.includes(tier)
        : effectiveState.claimedFreeRewards.includes(tier));
    },
    [effectiveState],
  );

  return {
    enabled,
    state: effectiveState,
    seasonId,
    seasonName: `Season ${seasonId}`,
    seasonEndsAt: bounds.endsAt,
    tier: effectiveState.tier,
    maxTier: BATTLE_PASS_MAX_TIER,
    xpProgress,
    tiers: BATTLE_PASS_TIERS,
    addXp,
    claimFreeReward,
    claimPremiumReward,
    isRewardClaimed,
    isRewardAvailable,
  };
}
