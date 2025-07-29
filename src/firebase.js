// === Firebase Initialization ===
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAOtuUurAXqo8S7eYKNKCJ4W1BTGlI5Lmk",
  authDomain: "mds-assist-329ca.firebaseapp.com",
  projectId: "mds-assist-329ca",
  storageBucket: "mds-assist-329ca.appspot.com",   // ← fixed
  messagingSenderId: "48455603372",
  appId: "1:48455603372:web:3b6e43373e859bc804fb09",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);                    // ← now after app is ready

export { app, db, storage };                        // (export app only if you need it elsewhere)
