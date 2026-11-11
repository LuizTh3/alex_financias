import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

const owner = 'dono'
const stamps = () => ({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
const card = () => ({ name: 'Nubank', color: '#8a05be', closingDay: 3, dueDay: 10, active: true, ...stamps() })
const purchase = (cardId = 'nu') => ({ cardId, title: 'Compra sofá', totalCents: 67644, installmentCount: 12, purchaseDate: '2026-01-15', firstDueMonth: '2026-02', description: '', ...stamps() })
const income = () => ({ title: 'Salário', amountCents: 500000, startMonth: '2026-01', endMonth: null, ...stamps() })
const receivable = () => ({ title: 'MAICO', totalCents: 35000, installmentCount: 5, launchDate: '2026-02-01', firstDueMonth: '2026-03', description: '', receivedIndexes: [], ...stamps() })
const status = (cardId = 'nu', month = '2026-07') => ({ cardId, month, paidAt: serverTimestamp() })

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('regras do modelo simplificado', () => {
  let env: RulesTestEnvironment
  let db: Firestore
  const path = (name: string, id: string) => doc(db, `users/${owner}/${name}/${id}`)
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-alex-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
  })
  beforeEach(async () => {
    await env.clearFirestore()
    db = env.authenticatedContext(owner).firestore() as unknown as Firestore
    await assertSucceeds(setDoc(path('cards', 'nu'), card()))
  })
  afterAll(async () => { await env?.cleanup() })

  it('permite ao dono criar, ler, editar e apagar em todas as coleções', async () => {
    for (const [name, data] of [['purchases', purchase()], ['incomes', income()], ['receivables', receivable()]] as const) {
      await assertSucceeds(setDoc(path(name, 'x'), data))
      await assertSucceeds(getDocs(collection(db, `users/${owner}/${name}`)))
      await assertSucceeds(updateDoc(path(name, 'x'), { title: 'Novo título', updatedAt: serverTimestamp() }))
      await assertSucceeds(deleteDoc(path(name, 'x')))
    }
    await assertSucceeds(updateDoc(path('cards', 'nu'), { name: 'Roxinho', updatedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(path('invoiceStatus', 'nu_2026-07'), status()))
    await assertSucceeds(deleteDoc(path('invoiceStatus', 'nu_2026-07')))
    await assertSucceeds(deleteDoc(path('cards', 'nu')))
  })

  it('nega acesso anônimo e de outro usuário', async () => {
    for (const other of [env.unauthenticatedContext().firestore(), env.authenticatedContext('intruso').firestore()]) {
      await assertFails(getDoc(doc(other, `users/${owner}/cards/nu`)))
      await assertFails(getDocs(collection(other, `users/${owner}/purchases`)))
      await assertFails(setDoc(doc(other, `users/${owner}/incomes/x`), income()))
      await assertFails(deleteDoc(doc(other, `users/${owner}/cards/nu`)))
    }
  })

  it('bloqueia as coleções antigas', async () => {
    await assertFails(getDocs(collection(db, `users/${owner}/entries`)))
    await assertFails(setDoc(path('categories', 'x'), { name: 'Casa', scope: 'expense', active: true, ...stamps() }))
  })

  it('exige carimbos do servidor e preserva createdAt', async () => {
    await assertFails(setDoc(path('incomes', 'x'), { ...income(), createdAt: Timestamp.fromMillis(0) }))
    await assertSucceeds(setDoc(path('incomes', 'x'), income()))
    await assertFails(updateDoc(path('incomes', 'x'), { createdAt: Timestamp.fromMillis(0), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(path('incomes', 'x'), { title: 'Sem updatedAt' }))
  })

  it('valida campos de cartão', async () => {
    await assertFails(setDoc(path('cards', 'a'), { ...card(), color: 'roxo' }))
    await assertFails(setDoc(path('cards', 'b'), { ...card(), dueDay: 32 }))
    await assertFails(setDoc(path('cards', 'c'), { ...card(), active: false }))
    await assertFails(setDoc(path('cards', 'd'), { ...card(), extra: 1 }))
    await assertFails(setDoc(path('cards', 'e'), { ...card(), name: ' Nu' }))
  })

  it('só aceita compras em cartão ativo e com campos válidos', async () => {
    await assertFails(setDoc(path('purchases', 'a'), purchase('inexistente')))
    await assertFails(setDoc(path('purchases', 'b'), { ...purchase(), installmentCount: 25 }))
    await assertFails(setDoc(path('purchases', 'c'), { ...purchase(), totalCents: 2, installmentCount: 3 }))
    await assertFails(setDoc(path('purchases', 'd'), { ...purchase(), totalCents: 10.5 }))
    await assertFails(setDoc(path('purchases', 'e'), { ...purchase(), firstDueMonth: '2026-13' }))
    await assertFails(setDoc(path('purchases', 'f'), { ...purchase(), description: 'x'.repeat(1001) }))
    await assertSucceeds(updateDoc(path('cards', 'nu'), { active: false, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(path('purchases', 'g'), purchase()))
  })

  it('marcador de fatura paga: ID coerente, sem edição, cartão ativo', async () => {
    await assertFails(setDoc(path('invoiceStatus', 'nu_2026-08'), status('nu', '2026-07')))
    await assertFails(setDoc(path('invoiceStatus', 'x_2026-07'), status('x', '2026-07')))
    await assertFails(setDoc(path('invoiceStatus', 'nu_2026-07'), { ...status(), paidAt: Timestamp.fromMillis(0) }))
    await assertSucceeds(setDoc(path('invoiceStatus', 'nu_2026-07'), status()))
    await assertFails(updateDoc(path('invoiceStatus', 'nu_2026-07'), { paidAt: serverTimestamp() }))
  })

  it('valida renda com e sem fim', async () => {
    await assertSucceeds(setDoc(path('incomes', 'a'), { ...income(), endMonth: '2026-12' }))
    await assertFails(setDoc(path('incomes', 'b'), { ...income(), endMonth: '2025-12' }))
    await assertFails(setDoc(path('incomes', 'c'), { ...income(), endMonth: 'nunca' }))
  })

  it('valida parcelas recebidas', async () => {
    await assertSucceeds(setDoc(path('receivables', 'a'), { ...receivable(), receivedIndexes: [1, 2] }))
    await assertFails(setDoc(path('receivables', 'b'), { ...receivable(), receivedIndexes: [1, 1] }))
    await assertFails(setDoc(path('receivables', 'c'), { ...receivable(), receivedIndexes: [1, 2, 3, 4, 5, 6] }))
    await assertFails(setDoc(path('receivables', 'd'), { ...receivable(), receivedIndexes: [25] }))
  })

  it('mantém a marca de boas-vindas', async () => {
    await assertSucceeds(setDoc(doc(db, `users/${owner}`), { createdAt: serverTimestamp(), welcomeSeenAt: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(db, `users/${owner}`)))
  })
})
