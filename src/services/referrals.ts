import { auth } from "../lib/firebase";
import { resolveApiUrl } from "../lib/apiUrls";

export const REFERRAL_CREDITS_KEY = "ps_gen_credits";
const CLAIMED_STORAGE_PREFIX = "ps_ref_claimed_";
const REFERRAL_API_URL = resolveApiUrl(
  (import.meta.env.VITE_REFERRALS_API_URL as string | undefined)?.trim(),
  "/api/referrals",
);

function getReferralCreditsUrl(): string {
  return `${REFERRAL_API_URL}/credits`;
}

function getReferralClaimUrl(): string {
  return `${REFERRAL_API_URL}/claim`;
}

async function getIdToken(): Promise<string> {
  if (!auth?.currentUser) {
    throw new Error("Authentication is required to use referral credits.");
  }
  return auth.currentUser.getIdToken();
}

/**
 * Returns true if this browser has already recorded a referral claim for the
 * given referrerUid. This is a UX cache only — the authoritative guard against
 * duplicate credit is the server-side claim route.
 */
export function hasClaimedReferral(referrerUid: string): boolean {
  return localStorage.getItem(`${CLAIMED_STORAGE_PREFIX}${referrerUid}`) === "1";
}

/**
 * Attempts to claim a referral credit for `referrerUid` on behalf of the
 * authenticated visitor `visitorUid`.
 *
 * @returns `true` if the claim was newly written, `false` if the visitor is not
 *          authenticated, has already claimed, or is the referrer themselves
 *          (self-referral guard).
 */
export async function claimReferral(
  referrerUid: string,
  visitorUid: string | null
): Promise<boolean> {
  if (!visitorUid) return false;
  if (visitorUid === referrerUid) return false;
  if (hasClaimedReferral(referrerUid)) return false;

  const idToken = await getIdToken();
  if (!idToken) return false;

  try {
   const response = await fetch(getReferralClaimUrl(), {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       Authorization: "Bearer " + idToken,
     },
     body: JSON.stringify({ referrerUid }),
   });
   const payload = await response.json().catch(() => ({}));
   if (!response.ok || !payload?.claimed) {
     return false;
   }
   localStorage.setItem(`${CLAIMED_STORAGE_PREFIX}${referrerUid}`, "1");
   return true;
  } catch {
   return false;
  }
}

/**
 * Counts the number of referral claims attributed to the authenticated user.
 */
export async function getReferralCreditCount(): Promise<number> {
  const idToken = await getIdToken();
  if (!idToken) return 0;

  try {
   const response = await fetch(getReferralCreditsUrl(), {
     headers: {
       Authorization: "Bearer " + idToken,
     },
   });
   const payload = await response.json().catch(() => ({}));
   if (!response.ok) {
     return 0;
   }
   return Number(payload?.count ?? 0);
  } catch {
   return 0;
  }
}

/**
 * Syncs referral-earned credits for a logged-in user from the server.
 * Persists the count to localStorage so it survives a page reload.
 * Returns the synced credit count.
 */
export async function syncReferralCredits(): Promise<number> {
  const count = await getReferralCreditCount();
  localStorage.setItem(REFERRAL_CREDITS_KEY, String(count));
  return count;
}
