import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
export async function needsWelcome(uid: string) {
  if (!db) throw new Error('Firebase indisponível')
  return !(await getDocFromServer(doc(db, 'users', uid))).exists()
}
export async function completeWelcome(uid: string) {
  if (!db) throw new Error('Firebase indisponível')
  const ref = doc(db, 'users', uid)
  await runTransaction(db, async transaction => {
    if (!(await transaction.get(ref)).exists()) transaction.set(ref, { createdAt: serverTimestamp(), welcomeSeenAt: serverTimestamp() })
  })
}
