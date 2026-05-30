/**
 * referrals.ts
 *
 * Firestore-backed referral-credit system.
 *
 * Flow:
 *  1. A logged-in user generates their referral link: `?ref=<uid>`.
 *  2. A visitor opens that link. The referrer UID is held until the visitor
 *     signs in (referral credit is one-per-account, so authentication is
 *     required). Once the visitor is authenticated, `claimReferral()` is called:
 *     - A document is written to `referralClaims/<referrerUid>_<visitorUid>`.
 *     - Because the doc ID is keyed by the authenticated visitor UID, the same
 *       account can never claim the same referrer twice (and Firestore rules
 *       reject any claim whose visitorKey is not the caller's own uid).
 *  3. The referrer, on their next session, calls `syncReferralCredits(uid)`
 *     which counts `referralClaims` docs belonging to them, stores the count
 *     in localStorage, and returns it.  Each doc = 1 credit.
 */

import {
  collection,
  doc,
  getCountFromServer,
  setDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export const REFERRAL_CREDITS_KEY = "ps_gen_credits";
const CLAIMED_STORAGE_PREFIX = "ps_ref_claimed_";

/**
 * Returns true if this browser has already recorded a referral claim for the
 * given referrerUid. This is a UX cache only — the authoritative guard against
 * duplicate credit is the per-account Firestore document.
 */
export function hasClaimedReferral(referrerUid: string): boolean {
  return localStorage.getItem(`${CLAIMED_STORAGE_PREFIX}${referrerUid}`) === "1";
}

/**
 * Attempts to claim a referral credit for `referrerUid` on behalf of the
 * authenticated visitor `visitorUid`.
 * Writes a Firestore document so the referrer can count their earned credits.
 *
 * @returns `true` if the claim was newly written, `false` if the visitor is not
 *          authenticated, has already claimed, or is the referrer themselves
 *          (self-referral guard).
 */
export async function claimReferral(
  referrerUid: string,
  visitorUid: string | null
): Promise<boolean> {
  if (!db) return false;
  // Referral credit is one-per-account: an authenticated visitor is required.
  if (!visitorUid) return false;
  // Prevent self-referral.
  if (visitorUid === referrerUid) return false;

  // Already claimed by this browser/account.
  if (hasClaimedReferral(referrerUid)) return false;

  const claimId = `${referrerUid}_${visitorUid}`;

  try {
    await setDoc(doc(db, "referralClaims", claimId), {
      referrerUid,
      visitorKey: visitorUid,
      claimedAt: serverTimestamp(),
    });
    // Mark as claimed in localStorage so we don't write again
    localStorage.setItem(`${CLAIMED_STORAGE_PREFIX}${referrerUid}`, "1");
    return true;
  } catch {
    // Likely a permission-denied because the doc already exists (idempotent)
    return false;
  }
}

/**
 * Counts the number of referral claims attributed to `uid`.
 * Each unique claim = 1 earned generate credit.
 */
export async function getReferralCreditCount(uid: string): Promise<number> {
  if (!db) return 0;
  try {
    const q = query(
      collection(db, "referralClaims"),
      where("referrerUid", "==", uid)
    );
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}

/**
 * Syncs referral-earned credits for a logged-in user from Firestore.
 * Persists the count to localStorage so it survives a page reload.
 * Returns the synced credit count.
 */
export async function syncReferralCredits(uid: string): Promise<number> {
  const count = await getReferralCreditCount(uid);
  localStorage.setItem(REFERRAL_CREDITS_KEY, String(count));
  return count;
}
