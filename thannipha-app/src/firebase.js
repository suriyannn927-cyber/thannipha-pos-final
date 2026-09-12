import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2jnXV67Y6hyNQhSUJSQ9sZwPG4KHLmlI",
  authDomain: "suriyan-f6309.firebaseapp.com",
  projectId: "suriyan-f6309",
  storageBucket: "suriyan-f6309.appspot.com",
  messagingSenderId: "192670390658",
  appId: "1:192670390658:web:e3ff41ff7bae6a089a179b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);