import type { User } from "firebase/auth";
import { resolveApiUrl } from "../lib/apiUrls";
import { buildSignupBonusCard } from "../lib/cardClassProgression";

const PLAYER_REWARDS_SYNC_API_URL = resolveApiUrl(
  (import.meta.env.VITE_PLAYER_REWARDS_API_URL as string | undefined)?.trim(),
  "/api/player-rewards/sync",
);

export interface PlayerRewardsSyncResult {
  signupBonusGranted: boolean;
  signupBonusCardId: string;
  dailyReward: {
    claimed: boolean;
    currentStreak: number;
    longestStreak: number;
    totalClaims: number;
    lastClaimDate: string;
    rewardXp: number;
    rewardOzzies: number;
  };
  progression: {
    missionXp: number;
    missionOzzies: number;
  };
}

export async function syncPlayerRewards(user: User): Promise<PlayerRewardsSyncResult> {
  const idToken = await user.getIdToken();
  const signupBonusCard = buildSignupBonusCard(user.uid);
  const response = await fetch(PLAYER_REWARDS_SYNC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ signupBonusCard }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to sync player rewards.");
  }
  return payload as PlayerRewardsSyncResult;
}
