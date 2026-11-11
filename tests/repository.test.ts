import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, type Firestore } from 'firebase/firestore'

const state = vi.hoisted(() => ({ db: null as Firestore | null }))
vi.mock('../src/lib/firebase', () => ({ get db() { return state.db }, auth: null }))
import {
  createCard, createIncome, createPurchase, createReceivable, deletePurchase, removeCard, setInstallmentReceived, setInvoicePaid,
  subscribeCollection, updateCard, updateReceivable, type CollectionName, type RecordMap,
} from '../src/data/store'

const uid = 'dono'
const cardInput = { name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10 }
const receivableInput = { title: 'MAICO', totalCents: 35000, installmentCount: 5, launchDate: '2026-02-01', firstDueMonth: '2026-03', description: '', receivedIndexes: [] }

/** Primeira leitura de uma assinatura. */
function firstRows<K extends CollectionName>(name: K) {
  return new Promise<RecordMap[K][]>((resolve, reject) => {
    const stop = subscribeCollection(uid, name, rows => { stop(); resolve(rows) }, reject)
  })
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('repositórios do modelo simplificado', () => {
  let env: RulesTestEnvironment
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-alex-repository', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  })
  // Conexão nova por teste: o cache local não traz documentos do teste anterior.
  beforeEach(async () => {
    await env.clearFirestore()
    state.db = env.authenticatedContext(uid).firestore() as unknown as Firestore
  })
  afterAll(async () => { await env?.cleanup() })

  it('cria e edita cartão, e lê pelo assinante', async () => {
    const id = await createCard(uid, cardInput)
    await updateCard(uid, id, { ...cardInput, name: '  Roxinho  ' })
    expect(await firstRows('cards')).toEqual([{ ...cardInput, name: 'Roxinho', id, active: true }])
  })

  it('apaga cartão sem dados e inativa cartão com dados', async () => {
    const empty = await createCard(uid, cardInput)
    expect(await removeCard(uid, empty, false)).toBe('deleted')
    expect((await getDoc(doc(state.db!, `users/${uid}/cards/${empty}`))).exists()).toBe(false)
    const used = await createCard(uid, cardInput)
    expect(await removeCard(uid, used, true)).toBe('deactivated')
    expect((await firstRows('cards'))[0]).toMatchObject({ id: used, active: false })
  })

  it('compra é um documento só; apagar remove todas as parcelas', async () => {
    const cardId = await createCard(uid, cardInput)
    const id = await createPurchase(uid, { cardId, title: 'Compra sofá', totalCents: 67644, installmentCount: 12, purchaseDate: '2026-01-15', firstDueMonth: '2026-02', description: 'Sala' })
    expect(await firstRows('purchases')).toHaveLength(1)
    await deletePurchase(uid, id)
    expect((await getDocs(collection(state.db!, `users/${uid}/purchases`))).size).toBe(0)
  })

  it('valida antes de gravar', async () => {
    const cardId = await createCard(uid, cardInput)
    await expect(createPurchase(uid, { cardId, title: '', totalCents: 100, installmentCount: 1, purchaseDate: '2026-01-15', firstDueMonth: '2026-02', description: '' })).rejects.toThrow()
    await expect(createIncome(uid, { title: 'Salário', amountCents: 100, startMonth: '2026-05', endMonth: '2026-01' })).rejects.toThrow()
  })

  it('marca e desmarca fatura paga', async () => {
    const cardId = await createCard(uid, cardInput)
    await setInvoicePaid(uid, cardId, '2026-07', true)
    expect(await firstRows('invoiceStatus')).toEqual([{ id: `${cardId}_2026-07`, cardId, month: '2026-07' }])
    await setInvoicePaid(uid, cardId, '2026-07', false)
    expect(await firstRows('invoiceStatus')).toEqual([])
  })

  it('marca parcelas recebidas e descarta marcas fora da nova quantidade', async () => {
    const id = await createReceivable(uid, receivableInput)
    await setInstallmentReceived(uid, id, 2, true)
    await setInstallmentReceived(uid, id, 5, true)
    await setInstallmentReceived(uid, id, 2, false)
    expect((await firstRows('receivables'))[0].receivedIndexes).toEqual([5])
    await updateReceivable(uid, id, { ...receivableInput, totalCents: 30000, installmentCount: 3, receivedIndexes: [1, 5] })
    expect((await firstRows('receivables'))[0]).toMatchObject({ installmentCount: 3, receivedIndexes: [1] })
  })
})
