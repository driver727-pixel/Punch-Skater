/**
 * useRaceArena — subscribes to the current user's incoming/outgoing race
 * challenges and exposes action wrappers for the `/api/race/*` endpoints.
 *
 * The Firestore rules on `challenges/{id}` allow read access only to the
 * two participants, so we run two parallel queries (`challengerUid == me`
 * and `defenderUid == me`) and merge the results client-side.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { RaceChallenge } from "../lib/types";
import {
  cancelRaceChallenge,
  issueRaceChallenge,
  respondToRaceChallenge,
  type IssueChallengeInput,
  type RespondResult,
} from "../services/race";

export function useRaceArena() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [outgoing, setOutgoing] = useState<RaceChallenge[]>([]);
  const [incoming, setIncoming] = useState<RaceChallenge[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !db) {
      setOutgoing([]); setIncoming([]);
      return;
    }
    setOutgoing([]); setIncoming([]);
    const colRef = collection(db, "challenges");
    const unsubOut = onSnapshot(
      query(colRef, where("challengerUid", "==", uid)),
      (snap) => setOutgoing(snap.docs.map((d) => d.data() as RaceChallenge)),
    );
    const unsubIn = onSnapshot(
      query(colRef, where("defenderUid", "==", uid)),
      (snap) => setIncoming(snap.docs.map((d) => d.data() as RaceChallenge)),
    );
    return () => { unsubOut(); unsubIn(); };
  }, [uid]);

  const sortedOutgoing = useMemo(() => [...outgoing].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))), [outgoing]);
  const sortedIncoming = useMemo(() => [...incoming].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))), [incoming]);

  const issue = useCallback(async (input: IssueChallengeInput): Promise<RaceChallenge> => {
    setBusy(true); setError(null);
    try {
      return await issueRaceChallenge(input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to issue challenge.";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const cancel = useCallback(async (challengeId: string): Promise<RaceChallenge> => {
    setBusy(true); setError(null);
    try {
      return await cancelRaceChallenge(challengeId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel.";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const respond = useCallback(async (challengeId: string, accept: boolean): Promise<RespondResult> => {
    setBusy(true); setError(null);
    try {
      return await respondToRaceChallenge(challengeId, accept);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to respond.";
      setError(msg);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    outgoing: sortedOutgoing,
    incoming: sortedIncoming,
    busy,
    error,
    issue,
    cancel,
    respond,
  };
}
