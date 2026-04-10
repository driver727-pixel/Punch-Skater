/**
 * referrals.ts
 *
 * Firestore-backed referral-credit system.
 *
 * Flow:
 *  1. A logged-in user generates their referral link: `?ref=<uid>`.
 *  2. A visitor opens that link.  On arrival, `claimReferral()` is called:
 *     - A document is written to `referralClaims/<referrerUid>_<visitorKey>`.
 *     - The visitorKey is a UUID persisted in localStorage so the same browser
 *       cannot claim the same referrer twice.
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
const VISITOR_KEY_STORAGE = "ps_visitor_key";
const CLAIMED_STORAGE_PREFIX = "ps_ref_claimed_";

/** Returns the persistent visitor key for this browser, generating one if needed. */
export function getOrCreateVisitorKey(): string {
  let key = localStorage.getItem(VISITOR_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY_STORAGE, key);
  }
  return key;
}

/**
 * Returns true if this browser has already claimed a referral credit for the
 * given referrerUid.
 */
export function hasClaimedReferral(referrerUid: string): boolean {
  return localStorage.getItem(`${CLAIMED_STORAGE_PREFIX}${referrerUid}`) === "1";
}

/**
 * Attempts to claim a referral credit for `referrerUid`.
 * Writes a Firestore document so the referrer can count their earned credits.
 * Marks the claim in localStorage to prevent duplicate claims from this browser.
 *
 * @returns `true` if the claim was newly written, `false` if already claimed or
 *          if the visitor's own UID matches the referrerUid (self-referral guard).
 */
export async function claimReferral(
  referrerUid: string,
  visitorUid: string | null
): Promise<boolean> {
  if (!db) return false;
  // Prevent self-referral
  if (visitorUid && visitorUid === referrerUid) return false;

  // Already claimed by this browser
  if (hasClaimedReferral(referrerUid)) return false;

  const visitorKey = getOrCreateVisitorKey();
  const claimId = `${referrerUid}_${visitorKey}`;

  try {
    await setDoc(doc(db, "referralClaims", claimId), {
      referrerUid,
      visitorKey,
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
