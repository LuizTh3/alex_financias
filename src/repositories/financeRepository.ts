import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { z } from 'zod'
import { db, personalUid } from '../lib/firebase'

const commitment = z.object({ description: z.string().min(1), amountCents: z.number().int().nonnegative(), dueDate: z.iso.date(), paid: z.boolean() })
const schemas = {
  cards: z.object({ name: z.string().min(1), closingDay: z.number().int().min(1).max(31), dueDay: z.number().int().min(1).max(31) }),
  invoices: commitment.extend({ cardId: z.string().min(1) }),
  fixedExpenses: commitment,
  receivables: commitment,
}
export type CollectionName = keyof typeof schemas
export type RecordOf<K extends CollectionName> = z.infer<(typeof schemas)[K]> & { id: string }
export function subscribeTo<K extends CollectionName>(uid: string, name: K, onData: (rows: RecordOf<K>[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db || !personalUid || uid !== personalUid) {
    onError(new Error('Acesso indisponível. Confira a configuração e a conta.'))
    return () => {}
  }
  return onSnapshot(collection(db, 'users', uid, name), snapshot => {
    try {
      // A chave genérica seleciona o mesmo schema que valida cada documento.
      const rows = snapshot.docs.map(document => ({ ...schemas[name].parse(document.data()), id: document.id }) as unknown as RecordOf<K>)
      onData(rows)
    } catch { onError(new Error('Há dados incompatíveis com o formato esperado.')) }
  }, onError)
}
