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
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
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
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, firebaseUnavailableMessage } from "../lib/firebase";
import { isAdminEmail } from "../lib/adminUtils";
import { syncReferralCredits } from "../services/referrals";

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  isAdmin?: boolean;
}

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithPhone: (phone: string, appVerifier: ApplicationVerifier) => Promise<ConfirmationResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  changeDisplayName: (newName: string) => Promise<void>;
  deleteAccount: (currentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export { RecaptchaVerifier };

function createAuthUnavailableError() {
  return new Error(firebaseUnavailableMessage);
}

function getProfileString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function upsertUserProfile(user: User) {
  if (!db) return;
  const email = user.email ?? "";
  const admin = isAdminEmail(email);
  await setDoc(
    doc(db, "userProfiles", user.uid),
    {
      uid: user.uid,
      email,
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "Skater",
      ...(admin ? { isAdmin: true, tier: "tier3" } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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
      setUserProfile(null);
      setLoading(false);
      if (u) {
        await upsertUserProfile(u).catch(() => {/* non-fatal */});
        syncReferralCredits(u.uid).catch(() => {/* non-fatal */});
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    if (!db) {
      setUserProfile({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "Skater",
        isAdmin: false,
      });
      return;
    }

    return onSnapshot(
      doc(db, "userProfiles", user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as Partial<UserProfile>) : {};
        const email = getProfileString(data.email) ?? user.email ?? "";
        const admin = data.isAdmin === true || isAdminEmail(email);
        setUserProfile({
          uid: user.uid,
          email,
          displayName:
            getProfileString(data.displayName)
            ?? user.displayName
            ?? user.email?.split("@")[0]
            ?? "Skater",
          isAdmin: admin,
        });
      },
      () => {
        setUserProfile({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? user.email?.split("@")[0] ?? "Skater",
          isAdmin: false,
        });
      },
    );
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw createAuthUnavailableError();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!auth) throw createAuthUnavailableError();
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw createAuthUnavailableError();
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
    if (!auth) throw createAuthUnavailableError();
    await sendPasswordResetEmail(auth, email);
  }, []);

  const signInWithPhone = useCallback(
    async (phone: string, appVerifier: ApplicationVerifier) => {
      if (!auth) throw createAuthUnavailableError();
      return signInWithPhoneNumber(auth, phone, appVerifier);
    },
    []
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!auth || !auth.currentUser) throw createAuthUnavailableError();
      const u = auth.currentUser;
      if (!u.email) throw new Error("Password change is only available for email/password accounts.");
      const credential = EmailAuthProvider.credential(u.email, currentPassword);
      await reauthenticateWithCredential(u, credential);
      await updatePassword(u, newPassword);
    },
    []
  );

  const changeDisplayName = useCallback(
    async (newName: string) => {
      if (!auth || !auth.currentUser) throw createAuthUnavailableError();
      await updateProfile(auth.currentUser, { displayName: newName });
      await upsertUserProfile(auth.currentUser);
      // Trigger a re-render by updating the user state
      setUser({ ...auth.currentUser } as User);
    },
    []
  );

  const deleteAccount = useCallback(
    async (currentPassword: string) => {
      if (!auth || !auth.currentUser) throw createAuthUnavailableError();
      const u = auth.currentUser;
      if (u.email) {
        const credential = EmailAuthProvider.credential(u.email, currentPassword);
        await reauthenticateWithCredential(u, credential);
      }
      await deleteUser(u);
    },
    []
  );

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signUp, signOut, signInWithGoogle, sendPasswordReset, signInWithPhone, changePassword, changeDisplayName, deleteAccount }}>
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
