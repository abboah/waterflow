import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every(Boolean)
const app = firebaseConfigured ? initializeApp(config) : null
export const db = app ? getFirestore(app) : null
export const auth = app ? getAuth(app) : null

export function watchAuth(callback) {
  if (!auth) return () => callback(null)
  return onAuthStateChanged(auth, callback)
}

export function signIn(email, password) {
  if (!auth) throw new Error('Firebase is not configured.')
  return signInWithEmailAndPassword(auth, email, password)
}

export function logOut() {
  if (!auth) return Promise.resolve()
  return signOut(auth)
}

export async function readCollection(name) {
  if (!db) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.local.')
  const snapshot = await getDocs(collection(db, name))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function createReading(reading) {
  if (!db) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.local.')
  const document = await addDoc(collection(db, 'readings'), {
    ...reading,
    createdAt: serverTimestamp(),
  })
  return { id: document.id, ...reading }
}

export async function createCustomer(customer) {
  if (!db) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values to .env.local.')
  const document = await addDoc(collection(db, 'customers'), {
    ...customer,
    balance: 0,
    createdAt: serverTimestamp(),
  })
  return { id: document.id, ...customer, balance: 0 }
}
