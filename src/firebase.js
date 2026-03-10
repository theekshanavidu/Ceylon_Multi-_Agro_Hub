// Firebase configuration
// Replace these values with your Firebase project's configuration
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCCrmxX08Znc9nUZ8eqv9bTo1goiCgY_X4",
    authDomain: "chamaka-rathnayake.firebaseapp.com",
    projectId: "chamaka-rathnayake",
    storageBucket: "chamaka-rathnayake.firebasestorage.app",
    messagingSenderId: "447869743418",
    appId: "1:447869743418:web:8c6dcfe1791fa04000a003",
    measurementId: "G-VTRN313MRQ"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
