// === Firebase Initialization ===
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


const app = initializeApp(firebaseConfig);

// Firestore database
const db = getFirestore(app);

// Firebase Storage
const storage = getStorage(app);

// Firebase Authentication
const auth = getAuth(app);

// Google Sign-In provider
const googleProvider = new GoogleAuthProvider();

export { app, db, storage, auth, googleProvider };
// redeploy trigger: Sat Aug  2 14:40:28 MDT 2025
