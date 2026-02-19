// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBOsjy4mEeQYe-gMo7Wn7p0Y4_yaGaj55E",
  authDomain: "kothrito.firebaseapp.com",
  projectId: "kothrito",
  storageBucket: "kothrito.firebasestorage.app",
  messagingSenderId: "478603864332",
  appId: "1:478603864332:web:e2f90e5c6597c8fbd64129",
};

// Initialize Firebase (Prevents "already initialized" errors in Next.js)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// EXPORT these so they can be imported in page.tsx
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();