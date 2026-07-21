import type { User } from "firebase/auth";
import { resolveApiUrl } from "../lib/apiUrls";
import type { TradePayload } from "../lib/types";

const TRADES_API_URL = resolveApiUrl(
  (import.meta.env.VITE_TRADES_API_URL as string | undefined)?.trim(),
  "/api/trades",
);

export interface CreateTradeOfferInput {
  offeredCardId: string;
  recipientEmail: string;
}

export interface CreateTradeOfferResponse {
  trade: TradePayload;
}

export async function createTradeOffer(user: User, input: CreateTradeOfferInput): Promise<CreateTradeOfferResponse> {
  const idToken = await user.getIdToken();
  const response = await fetch(TRADES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to send trade offer.");
  }
  return payload as CreateTradeOfferResponse;
}

export interface TradeStatusUpdateResponse {
  trade: TradePayload;
}

export async function getTradeMarket(user: User): Promise<TradePayload[]> {
  const idToken = await user.getIdToken();
  const response = await fetch(`${TRADES_API_URL}/market`, {
    headers: {
      Authorization: "Bearer " + idToken,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to load the community market.");
  }
  return Array.isArray(payload.trades) ? (payload.trades as TradePayload[]) : [];
}

export async function resolveTradeStatus(
  user: User,
  tradeId: string,
  status: "accepted" | "declined" | "cancelled",
): Promise<TradeStatusUpdateResponse> {
  const idToken = await user.getIdToken();
  const response = await fetch(`${TRADES_API_URL}/${encodeURIComponent(tradeId)}/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken,
    },
    body: JSON.stringify({ status }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Failed to update trade status.");
  }
  return payload as TradeStatusUpdateResponse;
}
