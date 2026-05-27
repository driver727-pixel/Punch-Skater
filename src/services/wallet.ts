import type { User } from "firebase/auth";
import type { PlayerWallet, WalletTransaction } from "../lib/sharedTypes";
import { resolveApiUrl } from "../lib/apiUrls";

const WALLET_API_URL = resolveApiUrl(
  import.meta.env.VITE_WALLET_API_URL as string | undefined,
  "/api/wallet",
);
const WALLET_SPEND_API_URL = resolveApiUrl(
  import.meta.env.VITE_WALLET_SPEND_API_URL as string | undefined,
  "/api/wallet/spend",
);
const WALLET_MISSION_REWARD_API_URL = resolveApiUrl(
  import.meta.env.VITE_WALLET_MISSION_REWARD_API_URL as string | undefined,
  "/api/wallet/rewards/mission",
);

export interface WalletStateResponse {
  wallet: PlayerWallet;
  recentTransactions: WalletTransaction[];
}

export interface WalletMutationResponse {
  wallet: PlayerWallet;
  transaction: WalletTransaction;
  duplicate?: boolean;
}

async function callWalletApi<T>(user: User, url: string, init?: RequestInit): Promise<T> {
  const idToken = await user.getIdToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken,
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Wallet request failed.");
  }
  return data as T;
}

export function fetchWalletState(user: User): Promise<WalletStateResponse> {
  return callWalletApi<WalletStateResponse>(user, WALLET_API_URL);
}

export function spendOzzies(
  user: User,
  { sink, idempotencyKey }: { sink: "card_forge"; idempotencyKey: string },
): Promise<WalletMutationResponse> {
  return callWalletApi<WalletMutationResponse>(user, WALLET_SPEND_API_URL, {
    method: "POST",
    body: JSON.stringify({ sink, idempotencyKey }),
  });
}

export function claimMissionReward(
  user: User,
  { missionId, idempotencyKey }: { missionId: string; idempotencyKey: string },
): Promise<WalletMutationResponse> {
  return callWalletApi<WalletMutationResponse>(user, WALLET_MISSION_REWARD_API_URL, {
    method: "POST",
    body: JSON.stringify({ missionId, idempotencyKey }),
  });
}
