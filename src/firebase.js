// === Firebase Initialization ===
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAOtuUurAXqo8S7eYKNKCJ4W1BTGlI5Lmk",
  authDomain: "mds-assist-329ca.firebaseapp.com",
  projectId: "mds-assist-329ca",
  storageBucket: "mds-assist-329ca.firebasestorage.app",
  messagingSenderId: "48455603372",
  appId: "1:48455603372:web:3b6e43373e859bc804fb09"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
