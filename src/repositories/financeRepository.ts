import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db, personalUid } from '../lib/firebase'
import { financialSchemas as schemas, type FinancialCollection, type FinancialRecord } from './financialSchemas'
export type CollectionName = FinancialCollection
export type RecordOf<K extends CollectionName> = FinancialRecord<K>
export function subscribeTo<K extends CollectionName>(uid: string, name: K, onData: (rows: RecordOf<K>[]) => void, onError: (error: Error) => void): Unsubscribe {
  if (!db || !personalUid || uid !== personalUid) {
    onError(new Error('Acesso indisponível. Confira a configuração e a conta.'))
    return () => {}
  }
  return onSnapshot(collection(db, 'users', uid, name), snapshot => {
    try {
      if (snapshot.metadata.hasPendingWrites) return
      const rows = snapshot.docs.map(document => ({ ...schemas[name].parse(document.data()), id: document.id }) as unknown as RecordOf<K>)
      onData(name === 'entries' ? rows.filter(row => !('deletedAt' in row) || !row.deletedAt) : rows)
    } catch { onError(new Error('Há dados incompatíveis com o formato esperado.')) }
  }, onError)
}
