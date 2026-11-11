import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type DocumentData,
} from 'firebase/firestore'
import type { ZodType } from 'zod'
import { db } from '../lib/firebase'
import {
  cardSchema, incomeSchema, invoiceStatusId, purchaseSchema, receivableSchema,
  type Card, type CardInput, type Income, type IncomeInput, type InvoiceStatus, type Purchase, type PurchaseInput, type Receivable, type ReceivableInput,
} from '../domain/schemas'
import { competenceSchema } from '../domain/calendar'

/** Coleções do modelo simplificado, abaixo de `/users/{uid}`. */
export type CollectionName = 'cards' | 'purchases' | 'invoiceStatus' | 'incomes' | 'receivables'
export type RecordMap = { cards: Card; purchases: Purchase; invoiceStatus: InvoiceStatus; incomes: Income; receivables: Receivable }

function database() {
  if (!db) throw new Error('Firebase não configurado. Confira as variáveis do arquivo .env.')
  return db
}
const collectionRef = (uid: string, name: CollectionName) => collection(database(), 'users', uid, name)
const docRef = (uid: string, name: CollectionName, id: string) => doc(database(), 'users', uid, name, id)

/** Lê só os campos conhecidos e valida; documentos inválidos são ignorados. */
function parseWith<T>(schema: ZodType<T>, keys: string[]) {
  return (data: DocumentData): T | null => {
    const result = schema.safeParse(Object.fromEntries(keys.map(key => [key, data[key]])))
    return result.success ? result.data : null
  }
}
const parseCard = parseWith(cardSchema, ['name', 'color', 'closingDay', 'dueDay'])
const parsePurchase = parseWith(purchaseSchema, ['cardId', 'title', 'totalCents', 'installmentCount', 'purchaseDate', 'firstDueMonth', 'description'])
const parseIncome = parseWith(incomeSchema, ['title', 'amountCents', 'startMonth', 'endMonth'])
const parseReceivable = parseWith(receivableSchema, ['title', 'totalCents', 'installmentCount', 'launchDate', 'firstDueMonth', 'description', 'receivedIndexes'])

const readers: { [K in CollectionName]: (id: string, data: DocumentData) => RecordMap[K] | null } = {
  cards: (id, data) => { const card = parseCard(data); return card && typeof data.active === 'boolean' ? { ...card, id, active: data.active } : null },
  purchases: (id, data) => { const value = parsePurchase(data); return value && { ...value, id } },
  incomes: (id, data) => { const value = parseIncome(data); return value && { ...value, id } },
  receivables: (id, data) => { const value = parseReceivable(data); return value && { ...value, id } },
  invoiceStatus: (id, data) => typeof data.cardId === 'string' && competenceSchema.safeParse(data.month).success
    ? { id, cardId: data.cardId, month: data.month } : null,
}

export function subscribeCollection<K extends CollectionName>(uid: string, name: K, onRows: (rows: RecordMap[K][]) => void, onError: (error: Error) => void) {
  return onSnapshot(collectionRef(uid, name), snapshot => {
    const rows: RecordMap[K][] = []
    for (const item of snapshot.docs) {
      const row = readers[name](item.id, item.data())
      if (row) rows.push(row)
      else console.warn(`Documento ignorado por formato inválido: ${name}/${item.id}`)
    }
    onRows(rows)
  }, onError)
}

const stamps = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
async function create(uid: string, name: CollectionName, data: object) {
  const ref = doc(collectionRef(uid, name))
  await setDoc(ref, { ...data, ...stamps() })
  return ref.id
}
const update = (uid: string, name: CollectionName, id: string, data: object) =>
  updateDoc(docRef(uid, name, id), { ...data, updatedAt: serverTimestamp() })
const remove = (uid: string, name: CollectionName, id: string) => deleteDoc(docRef(uid, name, id))

// Cartões
export const createCard = async (uid: string, input: CardInput) => create(uid, 'cards', { ...cardSchema.parse(input), active: true })
export const updateCard = async (uid: string, id: string, input: CardInput) => update(uid, 'cards', id, cardSchema.parse(input))
/** Sem dados: apaga. Com compras ou faturas pagas: inativa, e o cartão some das telas. */
export async function removeCard(uid: string, id: string, hasData: boolean): Promise<'deleted' | 'deactivated'> {
  if (hasData) { await update(uid, 'cards', id, { active: false }); return 'deactivated' }
  await remove(uid, 'cards', id)
  return 'deleted'
}

// Compras: um documento por compra; apagar remove todas as parcelas.
export const createPurchase = async (uid: string, input: PurchaseInput) => create(uid, 'purchases', purchaseSchema.parse(input))
export const updatePurchase = async (uid: string, id: string, input: PurchaseInput) => update(uid, 'purchases', id, purchaseSchema.parse(input))
export const deletePurchase = async (uid: string, id: string) => remove(uid, 'purchases', id)

// Fatura paga: apenas um marcador, sem cálculo.
export async function setInvoicePaid(uid: string, cardId: string, month: string, paid: boolean) {
  const ref = docRef(uid, 'invoiceStatus', invoiceStatusId(cardId, month))
  if (paid) await setDoc(ref, { cardId, month, paidAt: serverTimestamp() })
  else await deleteDoc(ref)
}

// Rendas
export const createIncome = async (uid: string, input: IncomeInput) => create(uid, 'incomes', incomeSchema.parse(input))
export const updateIncome = async (uid: string, id: string, input: IncomeInput) => update(uid, 'incomes', id, incomeSchema.parse(input))
export const deleteIncome = async (uid: string, id: string) => remove(uid, 'incomes', id)

// A receber: isolado do saldo; o recebimento é marcado por parcela.
export const createReceivable = async (uid: string, input: ReceivableInput) => create(uid, 'receivables', receivableSchema.parse(input))
/** Edição mantém só as marcas de recebimento que ainda existem na nova quantidade de parcelas. */
export async function updateReceivable(uid: string, id: string, input: ReceivableInput) {
  const value = receivableSchema.parse({ ...input, receivedIndexes: input.receivedIndexes.filter(index => index <= input.installmentCount) })
  return update(uid, 'receivables', id, value)
}
export const deleteReceivable = async (uid: string, id: string) => remove(uid, 'receivables', id)
export const setInstallmentReceived = async (uid: string, id: string, index: number, received: boolean) =>
  update(uid, 'receivables', id, { receivedIndexes: received ? arrayUnion(index) : arrayRemove(index) })
