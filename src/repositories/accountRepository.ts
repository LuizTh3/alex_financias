import { doc, runTransaction, serverTimestamp, type Firestore, type Transaction } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { financialSchemas } from './financialSchemas'
import { todayCivil } from '../domain/calendar'

export async function prepareAccountMovement(transaction: Transaction, database: Firestore, uid: string, source: 'settlementEvents' | 'invoiceEvents', eventId: string, amount: number, enabled: boolean, reverseId?: string) {
  const id = `${source}_${eventId}`
  const account = await transaction.get(doc(database, 'users', uid, 'accounts', 'main'))
  const original = reverseId ? await transaction.get(doc(database, 'users', uid, 'accountMovements', `${source}_${reverseId}`)) : null
  if (reverseId ? !original?.exists() : !enabled) return () => {}
  if (!account.exists()) throw new Error('Configure Minha conta antes de movimentar o saldo.')
  const value = reverseId ? -financialSchemas.accountMovements.parse(original!.data()).amountCents : amount
  return () => transaction.set(doc(database, 'users', uid, 'accountMovements', id), {
    amountCents: value, date: todayCivil(), source, sourceId: eventId, description: reverseId ? 'Reversão de confirmação' : amount > 0 ? 'Recebimento confirmado' : 'Pagamento confirmado',
    reversesId: reverseId ? `${source}_${reverseId}` : null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}
export async function initializeAccount(openingCents: number) {
  const uid = auth?.currentUser?.uid
  if (!db || !uid || !Number.isSafeInteger(openingCents) || Math.abs(openingCents) > 999999999) throw new Error('Saldo inválido.')
  const ref = doc(db, 'users', uid, 'accounts', 'main')
  await runTransaction(db, async tx => {
    if ((await tx.get(ref)).exists()) throw new Error('A conta já foi configurada. Use um ajuste.')
    tx.set(ref, { openingCents, startDate: todayCivil(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  })
}
export async function adjustAccount(id: string, amountCents: number, description: string) {
  const uid = auth?.currentUser?.uid
  if (!db || !uid || !Number.isSafeInteger(amountCents) || !amountCents || Math.abs(amountCents) > 999999999 || !description.trim() || description.length > 240) throw new Error('Informe valor e justificativa válidos.')
  const ref = doc(db, 'users', uid, 'accountMovements', id)
  const accountRef = doc(db, 'users', uid, 'accounts', 'main')
  await runTransaction(db, async tx => {
    const [existing, account] = await Promise.all([tx.get(ref), tx.get(accountRef)])
    if (!account.exists()) throw new Error('Configure a conta primeiro.')
    if (existing.exists()) {
      if (existing.data().amountCents === amountCents && existing.data().description === description.trim()) return
      throw new Error('Tentativa reutilizada. Reabra a página.')
    }
    tx.set(ref, { amountCents, description: description.trim(), date: todayCivil(), source: 'adjustment', sourceId: id, reversesId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  })
}
