import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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
  storage: FirebaseStorage | null;
} = (() => {
  if (!isFirebaseConfigured) {
    console.warn("[Firebase] Missing config:", missingFirebaseConfig.join(", "));
    return { app: null, auth: null, db: null, storage: null };
  }

  try {
    const app = initializeApp(firebaseConfig);
    return {
      app,
      auth: getAuth(app),
      db: initializeFirestore(app, { ignoreUndefinedProperties: true }),
      storage: getStorage(app),
    };
  } catch (error) {
    console.error("[Firebase] Initialization failed.", error);
    return { app: null, auth: null, db: null, storage: null };
  }
})();

const { app, auth, db, storage } = firebaseServices;

export { app, auth, db, storage };
