import {
  collection, doc, onSnapshot, runTransaction, serverTimestamp, Timestamp,
  type DocumentData, type Firestore, type Unsubscribe,
} from 'firebase/firestore'
import { cardSchema, categorySchema, type CardInput, type CatalogKind, type CategoryInput } from '../domain/catalog'
import { db } from '../lib/firebase'

export type CatalogMetadata = { id: string; active: boolean; createdAt: Timestamp; updatedAt: Timestamp }
export type CardRecord = CardInput & CatalogMetadata
export type CategoryRecord = CategoryInput & CatalogMetadata
export type CatalogRecord = CardRecord | CategoryRecord
export type CatalogRecords = { cards: CardRecord; categories: CategoryRecord }
const schemas = { cards: cardSchema, categories: categorySchema }

export class CatalogConflictError extends Error {
  constructor() { super('Este cadastro foi alterado em outra aba. Feche e abra novamente para editar a versão atual.'); this.name = 'CatalogConflictError' }
}
function ownerDb(uid: string): Firestore {
  if (!db || !uid) throw new Error('Sua conta não tem acesso a estes cadastros.')
  return db
}
function parseRecord<K extends CatalogKind>(kind: K, id: string, data: DocumentData): CatalogRecords[K] {
  const { active, createdAt, updatedAt, ...fields } = data
  if (typeof active !== 'boolean' || !(createdAt instanceof Timestamp) || !(updatedAt instanceof Timestamp)) {
    throw new Error('Há um cadastro em formato incompatível. Confira seus dados antes de continuar.')
  }
  // A chave determina tanto o schema em tempo de execução quanto o tipo de retorno.
  return { ...schemas[kind].parse(fields), id, active, createdAt, updatedAt } as CatalogRecords[K]
}
export function subscribeCatalog<K extends CatalogKind>(uid: string, kind: K, onData: (rows: CatalogRecords[K][]) => void, onError: (error: Error) => void): Unsubscribe {
  try {
    return onSnapshot(collection(ownerDb(uid), 'users', uid, kind), snapshot => {
      try {
        // Somente dados confirmados: createdAt/updatedAt ainda não resolvidos não viram registros inválidos.
        if (snapshot.metadata.hasPendingWrites) return
        const rows = snapshot.docs.map(item => parseRecord(kind, item.id, item.data()))
        onData(rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)))
      } catch (error) { onError(error instanceof Error ? error : new Error('Não foi possível ler os cadastros.')) }
    }, () => onError(new Error('Não foi possível carregar os cadastros. Confira a conexão e se as regras foram publicadas.')))
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Acesso indisponível.'))
    return () => {}
  }
}
export function newCatalogId(uid: string, kind: CatalogKind): string {
  return doc(collection(ownerDb(uid), 'users', uid, kind)).id
}
// O ID é reservado uma vez por formulário e reaproveitado nas tentativas.
export async function saveCatalog(
  uid: string, kind: CatalogKind, id: string, input: CardInput | CategoryInput,
  expectedUpdatedAt?: Timestamp,
): Promise<void> {
  const data = schemas[kind].parse(input)
  const database = ownerDb(uid)
  const ref = doc(database, 'users', uid, kind, id)
  await runTransaction(database, async transaction => {
    const snapshot = await transaction.get(ref)
    if (expectedUpdatedAt) {
      if (!snapshot.exists() || !(snapshot.data().updatedAt instanceof Timestamp)
        || !snapshot.data().updatedAt.isEqual(expectedUpdatedAt)) throw new CatalogConflictError()
      // Campos financeiros existentes nunca são regravados ao alterar o cadastro.
      transaction.update(ref, { ...data, updatedAt: serverTimestamp() })
    } else if (!snapshot.exists()) {
      transaction.set(ref, { ...data, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    } else {
      // Se a resposta de um cadastro se perdeu, repetir o mesmo envio não o duplica.
      const existing = parseRecord(kind, snapshot.id, snapshot.data())
      if (!existing.active || Object.entries(data).some(([key, value]) => snapshot.data()[key] !== value)) throw new CatalogConflictError()
    }
  })
}
export async function setCatalogActive(uid: string, kind: CatalogKind, record: CatalogRecord, active: boolean): Promise<void> {
  const database = ownerDb(uid)
  const ref = doc(database, 'users', uid, kind, record.id)
  await runTransaction(database, async transaction => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists() || !(snapshot.data().updatedAt instanceof Timestamp)
      || !snapshot.data().updatedAt.isEqual(record.updatedAt)) throw new CatalogConflictError()
    transaction.update(ref, { active, updatedAt: serverTimestamp() })
  })
}
export function catalogErrorMessage(error: unknown): string {
  if (error instanceof CatalogConflictError) return error.message
  return 'Não foi possível salvar. Verifique a conexão e as regras do Firestore e tente novamente.'
}
