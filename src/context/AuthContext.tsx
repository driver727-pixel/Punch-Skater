import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type User,
  type ConfirmationResult,
  type ApplicationVerifier,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseUnavailableMessage } from "../lib/firebase";
import { syncReferralCredits } from "../services/referrals";
import { isAdminEmail } from "../lib/adminUtils";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithPhone: (phone: string, appVerifier: ApplicationVerifier) => Promise<ConfirmationResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export { RecaptchaVerifier };

function createFirebaseUnavailableError() {
  return new Error(firebaseUnavailableMessage);
}

async function upsertUserProfile(user: User) {
  if (!db) return;
  const adminFields = isAdminEmail(user.email ?? "") ? { isAdmin: true } : {};
  await setDoc(
    doc(db, "userProfiles", user.uid),
    {
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "Skater",
      updatedAt: serverTimestamp(),
      ...adminFields,
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Handle redirect result from Google sign-in
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await upsertUserProfile(result.user).catch(() => {/* non-fatal */});
      }
    }).catch(() => {/* non-fatal */});

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await upsertUserProfile(u).catch(() => {/* non-fatal */});
        syncReferralCredits(u.uid).catch(() => {/* non-fatal */});
      }
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw createFirebaseUnavailableError();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!auth) throw createFirebaseUnavailableError();
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw createFirebaseUnavailableError();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fall back to redirect when popup is blocked
      if (
        msg.includes("popup-blocked") ||
        msg.includes("cancelled-popup-request")
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!auth) throw createFirebaseUnavailableError();
    await sendPasswordResetEmail(auth, email);
  }, []);

  const signInWithPhone = useCallback(
    async (phone: string, appVerifier: ApplicationVerifier) => {
      if (!auth) throw createFirebaseUnavailableError();
      return signInWithPhoneNumber(auth, phone, appVerifier);
    },
    []
  );

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle, sendPasswordReset, signInWithPhone }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
