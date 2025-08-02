// === Firebase Initialization ===
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAOtuUurAXqo8S7eYKNKCJ4W1BTGlI5Lmk",
  authDomain: "mds-assist-329ca.firebaseapp.com",
  projectId: "mds-assist-329ca",
  storageBucket: "mds-assist-329ca.appspot.com",
  messagingSenderId: "48455603372",
  appId: "1:48455603372:web:3b6e43373e859bc804fb09",
};

const app = initializeApp(firebaseConfig);

// Firestore database
export const db = getFirestore(app);

// Firebase Storage
export const storage = getStorage(app);

// Firebase Authentication
export const auth = getAuth(app);

// Google Sign-In provider
export const googleProvider = new GoogleAuthProvider();
