import { collection, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore'
import { z } from 'zod'
import { db, personalUid } from '../lib/firebase'
const metadata = { createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp) }
const competence = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const cents = z.number().int().nonnegative()
const schemas = {
  entries: z.object({
    type: z.enum(['expense', 'income']), description: z.string().min(1), totalCents: cents,
    categoryId: z.string(), purchaseDate: z.iso.date(), paymentMethod: z.enum(['direct', 'card']),
    cardId: z.string().optional(), installmentCount: z.number().int().positive(), firstCompetence: competence,
    ...metadata,
  }),
  installments: z.object({
    entryId: z.string(), index: z.number().int().positive(), count: z.number().int().positive(),
    amountCents: cents, competence, dueDate: z.iso.date(), cardId: z.string().optional(), recurrenceId: z.string().optional(),
    status: z.enum(['pending', 'paid', 'received']).optional(), settledAt: z.instanceof(Timestamp).nullable().optional(),
    ...metadata,
  }),
  invoices: z.object({
    cardId: z.string(), competence, dueDate: z.iso.date(), status: z.enum(['pending', 'paid']),
    paidAt: z.instanceof(Timestamp).nullable(), paidAmountCents: cents.nullable(), ...metadata,
  }),
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
      if (snapshot.metadata.hasPendingWrites) return
      const rows = snapshot.docs.map(document => ({ ...schemas[name].parse(document.data()), id: document.id }) as unknown as RecordOf<K>)
      onData(rows)
    } catch { onError(new Error('Há dados incompatíveis com o formato esperado.')) }
  }, onError)
}
