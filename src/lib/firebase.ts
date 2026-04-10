import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => value == null || value === '')
  .map(([key]) => key);

export const firebaseUnavailableMessage = "Online sign-in and cloud sync are temporarily unavailable.";
export const isFirebaseConfigured = missingFirebaseConfig.length === 0;

const firebaseServices: {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
} = (() => {
  if (!isFirebaseConfigured) {
    console.warn("[Firebase] Missing config:", missingFirebaseConfig.join(", "));
    return { app: null, auth: null, db: null };
  }

  try {
    const app = initializeApp(firebaseConfig);
    return {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
    };
  } catch (error) {
    console.error("[Firebase] Initialization failed.", error);
    return { app: null, auth: null, db: null };
  }
})();

const { app, auth, db } = firebaseServices;

export { app, auth, db };
