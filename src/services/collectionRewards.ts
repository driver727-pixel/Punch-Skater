import type { User } from "firebase/auth";
import { resolveApiUrl } from "../lib/apiUrls";
import type { CollectionRewardDefinition, CollectionRewardEvaluation } from "../lib/collectionRewards";

const COLLECTION_REWARDS_API_URL = resolveApiUrl(
  (import.meta.env.VITE_COLLECTION_REWARDS_API_URL as string | undefined)?.trim(),
  "/api/collection-rewards",
);
const COLLECTION_REWARDS_CLAIM_API_URL = resolveApiUrl(
  (import.meta.env.VITE_COLLECTION_REWARDS_CLAIM_API_URL as string | undefined)?.trim(),
  "/api/collection-rewards/claim",
);

export interface CollectionRewardsResponse {
  schemaVersion: number;
  evaluation: CollectionRewardEvaluation;
}

export interface CollectionRewardClaimResponse extends CollectionRewardsResponse {
  claimed: boolean;
  alreadyClaimed: boolean;
  milestoneId: string;
  rewards: CollectionRewardDefinition[];
}

async function parseRewardResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : fallbackError);
  }
  return payload as T;
}

export async function fetchCollectionRewards(user: User): Promise<CollectionRewardsResponse> {
  const idToken = await user.getIdToken();
  const response = await fetch(COLLECTION_REWARDS_API_URL, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return parseRewardResponse<CollectionRewardsResponse>(response, "Failed to load collection rewards.");
}

export async function claimCollectionReward(user: User, milestoneId: string): Promise<CollectionRewardClaimResponse> {
  const idToken = await user.getIdToken();
  const response = await fetch(COLLECTION_REWARDS_CLAIM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ milestoneId }),
  });
  return parseRewardResponse<CollectionRewardClaimResponse>(response, "Failed to claim collection reward.");
}
