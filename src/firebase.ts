import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAurfnq1Mz7ICSuAVY0mHcRuUofYNRz_n4",
  authDomain: "tulipa-ia.firebaseapp.com",
  projectId: "tulipa-ia",
  storageBucket: "tulipa-ia.firebasestorage.app",
  messagingSenderId: "906324381518",
  appId: "1:906324381518:web:914bedf5f2cc0dd502581f",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
