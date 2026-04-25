/**
 * missions.ts (service layer) — Firestore read/write for the missions system.
 *
 * All functions are no-ops when the MISSIONS feature flag is disabled or
 * Firebase is not configured.
 *
 * Firestore collection: `missions/{uid}_{date}_{templateId}`
 *
 * @sprint 1 @owner gamma
 */

import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { isEnabled } from "../lib/featureFlags";
import { pickDailyMissions, applyMissionProgress } from "../lib/missions";
import type { Mission, MissionEvent } from "../lib/sharedTypes";

const COLLECTION = "missions";

/** Returns today's UTC date as "YYYY-MM-DD". */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Loads today's missions for `uid`.
 *
 * - If documents already exist in Firestore for today, returns them.
 * - Otherwise, generates a fresh set with `pickDailyMissions` and persists
 *   them so subsequent reads are consistent.
 *
 * Returns an empty array when the MISSIONS flag is off or Firebase is
 * unavailable.
 */
export async function getDailyMissions(uid: string): Promise<Mission[]> {
  if (!isEnabled("MISSIONS") || !db) return [];

  const date = todayUtc();

  // Query existing docs for this uid + date by ID prefix
  const q = query(
    collection(db, COLLECTION),
    where("uid", "==", uid),
    where("createdAt", ">=", `${date}T00:00:00.000Z`),
    where("createdAt", "<=", `${date}T23:59:59.999Z`)
  );

  const snap = await getDocs(q);

  if (!snap.empty) {
    return snap.docs.map((d) => d.data() as Mission);
  }

  // No missions for today — generate and persist a fresh set
  const missions = pickDailyMissions(uid, date);

  await Promise.all(
    missions.map((m) =>
      setDoc(doc(db!, COLLECTION, m.id), {
        ...m,
        // Store Firestore server timestamp alongside the ISO string so
        // future index queries on `createdAt` (Timestamp) work correctly.
        _createdAt: serverTimestamp(),
      })
    )
  );

  return missions;
}

/**
 * Applies a `MissionEvent` against all of the user's active missions for
 * today, persisting any progress updates transactionally.
 *
 * No-op when the MISSIONS flag is off or Firebase is unavailable.
 */
export async function trackMissionEvent(
  uid: string,
  event: MissionEvent
): Promise<void> {
  if (!isEnabled("MISSIONS") || !db) return;

  const date = todayUtc();

  const q = query(
    collection(db, COLLECTION),
    where("uid", "==", uid),
    where("status", "==", "active"),
    where("createdAt", ">=", `${date}T00:00:00.000Z`),
    where("createdAt", "<=", `${date}T23:59:59.999Z`)
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  await Promise.all(
    snap.docs.map(async (docSnap) => {
      const mission = docSnap.data() as Mission;
      const updated = applyMissionProgress(mission, event);

      // Only write when something actually changed
      if (updated.progress === mission.progress && updated.status === mission.status) {
        return;
      }

      await runTransaction(db!, async (tx) => {
        const ref = doc(db!, COLLECTION, mission.id);
        const latest = await tx.get(ref);
        if (!latest.exists()) return;

        const current = latest.data() as Mission;
        // Re-apply on the freshest snapshot to avoid racing writes
        const final = applyMissionProgress(current, event);
        if (final.progress === current.progress && final.status === current.status) {
          return;
        }

        tx.update(ref, {
          progress: final.progress,
          status: final.status,
          ...(final.completedAt ? { completedAt: final.completedAt } : {}),
        });
      });
    })
  );
}

/**
 * Claims the reward for a completed mission.
 *
 * - Validates that the mission exists, belongs to `uid`, and has
 *   `status === "completed"`.
 * - Idempotent: returns the reward without re-writing if `completedAt` is
 *   already set and a `rewardClaimedAt` field exists.
 * - Credits XP via the `userProfiles/{uid}` document's `missionXp` field
 *   (created if absent).
 *
 * Returns `{ xp, ozzies }` on success.
 * Throws if the mission is not found, not owned by `uid`, or not completed.
 */
export async function claimMissionReward(
  uid: string,
  missionId: string
): Promise<{ xp: number; ozzies: number }> {
  if (!db) throw new Error("Firebase is not configured.");
  if (!isEnabled("MISSIONS")) throw new Error("Missions are not enabled.");

  const missionRef = doc(db, COLLECTION, missionId);
  const profileRef = doc(db, "userProfiles", uid);

  let rewardXp = 0;
  let rewardOzzies = 0;

  await runTransaction(db, async (tx) => {
    const missionSnap = await tx.get(missionRef);
    if (!missionSnap.exists()) throw new Error("Mission not found.");

    const mission = missionSnap.data() as Mission & {
      rewardClaimedAt?: Timestamp | string;
    };

    if (mission.uid !== uid) throw new Error("Mission does not belong to this user.");
    if (mission.status !== "completed") throw new Error("Mission is not yet completed.");

    // Idempotent: already claimed
    if (mission.rewardClaimedAt) {
      rewardXp = mission.rewardXp;
      rewardOzzies = mission.rewardOzzies ?? 0;
      return;
    }

    rewardXp = mission.rewardXp;
    rewardOzzies = mission.rewardOzzies ?? 0;

    tx.update(missionRef, { rewardClaimedAt: serverTimestamp() });

    // Credit XP to the user profile. The `missionXp` field is created if it
    // doesn't exist yet; a future migration may roll it into a broader XP total.
    const profileSnap = await tx.get(profileRef);
    if (profileSnap.exists()) {
      const currentXp: number = (profileSnap.data()?.missionXp as number) ?? 0;
      tx.update(profileRef, {
        missionXp: currentXp + rewardXp,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return { xp: rewardXp, ozzies: rewardOzzies };
}
