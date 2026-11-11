import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { z } from 'zod'

const config = z.object({
  apiKey: z.string().min(1), authDomain: z.string().min(1),
  projectId: z.string().min(1), storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1), appId: z.string().min(1),
}).safeParse({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})
export const configurationError = !config.success
  ? 'Configuração incompleta. Confira as variáveis do arquivo .env.' : null
const app = config.success ? initializeApp(config.data) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null

/** `npm run dev:emulator`: só em desenvolvimento, usa o login e o banco do emulador local em vez do Firebase real. */
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR === 'true' && auth && db) {
  connectAuthEmulator(auth, `http://127.0.0.1:${import.meta.env.VITE_EMULATOR_AUTH_PORT || 9099}`, { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT || 8080))
}
