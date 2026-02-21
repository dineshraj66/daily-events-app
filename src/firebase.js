// src/firebase.js
// Firebase config is loaded from environment variables (VITE_* prefix).
// For local dev: create a .env.local file (see .env.example).
// For GitHub Pages: add each variable as a GitHub Secret.

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            "AIzaSyCXK_X1e_K_-Wz-gE_9g6dm96vMLdKViq4",
  authDomain:        "daily-events-a3151.firebaseapp.com",
  projectId:         "daily-events-a3151",
  storageBucket:     "daily-events-a3151.firebasestorage.app",
  messagingSenderId: "744894479261",
  appId:             "1:744894479261:web:ae30525105eb58830f8d74",
}

const app = initializeApp(firebaseConfig)
export const db   = getFirestore(app)
export const auth = getAuth(app)

// Auto sign-in anonymously so each browser has its own private data partition
export const initAuth = () =>
  new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user)
      } else {
        signInAnonymously(auth).then(({ user }) => resolve(user))
      }
    })
  })
